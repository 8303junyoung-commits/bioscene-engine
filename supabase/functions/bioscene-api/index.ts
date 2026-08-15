import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const allowedOrigins = new Set((Deno.env.get('BIOSCENE_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:4173,https://bioscene-engine.onrender.com').split(',').map((item) => item.trim()).filter(Boolean))
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && !allowedOrigins.has(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin ?? [...allowedOrigins][0] ?? 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'authorization, content-type, if-match, x-bioscene-schema',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'etag',
    'Vary': 'Origin',
  }
}

function json(request: Request, status: number, body: unknown, headers: Record<string, string> = {}) {
  const cors = corsHeaders(request)
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(cors ?? {}), ...headers } })
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return null
  const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } })
  const { data, error } = await client.auth.getUser()
  return error ? null : data.user
}

function revisionFrom(request: Request) {
  const value = request.headers.get('if-match')?.replace(/^W\//, '').replaceAll('"', '').trim()
  if (!value || !/^\d+$/.test(value)) return undefined
  return Number(value)
}

async function roomAccess(roomId: string, userId: string) {
  const { data: room, error } = await admin.from('bioscene_rooms').select('room_id, owner_id, scene, revision').eq('room_id', roomId).maybeSingle()
  if (error) throw error
  if (!room) return { room: null, role: null }
  if (room.owner_id === userId) return { room, role: 'owner' as const }
  const { data: membership, error: membershipError } = await admin.from('bioscene_room_members').select('role').eq('room_id', roomId).eq('user_id', userId).maybeSingle()
  if (membershipError) throw membershipError
  return { room, role: membership?.role as 'viewer' | 'editor' | undefined ?? null }
}

async function handleRoom(request: Request, roomId: string, userId: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$/.test(roomId)) return json(request, 400, { error: 'Invalid room ID' })
  const access = await roomAccess(roomId, userId)
  if (request.method === 'GET') {
    if (!access.room) return json(request, 404, { error: 'Room not found' })
    if (!access.role) return json(request, 403, { error: 'Room access denied' })
    return json(request, 200, { scene: access.room.scene, revision: String(access.room.revision) }, { ETag: `"${access.room.revision}"` })
  }
  if (request.method !== 'PUT') return json(request, 405, { error: 'Method not allowed' })
  if (access.room && !['owner', 'editor'].includes(access.role ?? '')) return json(request, 403, { error: 'Room is read-only' })
  if ((Number(request.headers.get('content-length')) || 0) > 5_000_000) return json(request, 413, { error: 'Scene payload is too large' })
  const payload: unknown = await request.json().catch(() => null)
  const scene = payload && typeof payload === 'object' && 'scene' in payload ? (payload as { scene: unknown }).scene : null
  if (!scene || typeof scene !== 'object' || (scene as { schema?: unknown }).schema !== 'bioscene.scene.v0.10') return json(request, 400, { error: 'Invalid BioScene v0.10 payload' })
  if (JSON.stringify(scene).length > 5_000_000) return json(request, 413, { error: 'Scene payload is too large' })
  if (!access.room) {
    const { data, error } = await admin.from('bioscene_rooms').insert({ room_id: roomId, owner_id: userId, updated_by: userId, scene, revision: 1 }).select('revision').single()
    if (error) return json(request, error.code === '23505' ? 409 : 500, { error: 'Room creation failed' })
    await admin.from('bioscene_room_audit').insert({ room_id: roomId, actor_id: userId, revision: data.revision, action: 'create' })
    return json(request, 201, { revision: String(data.revision) }, { ETag: `"${data.revision}"` })
  }
  const expectedRevision = revisionFrom(request)
  if (expectedRevision === undefined) return json(request, 428, { error: 'If-Match is required for an existing room' })
  if (expectedRevision !== access.room.revision) return json(request, 412, { error: 'Revision conflict', revision: String(access.room.revision) }, { ETag: `"${access.room.revision}"` })
  const nextRevision = access.room.revision + 1
  const { data, error } = await admin.from('bioscene_rooms').update({ scene, revision: nextRevision, updated_by: userId, updated_at: new Date().toISOString() }).eq('room_id', roomId).eq('revision', expectedRevision).select('revision').maybeSingle()
  if (error) return json(request, 500, { error: 'Room update failed' })
  if (!data) return json(request, 412, { error: 'Revision conflict' })
  await admin.from('bioscene_room_audit').insert({ room_id: roomId, actor_id: userId, revision: data.revision, action: 'update' })
  return json(request, 200, { revision: String(data.revision) }, { ETag: `"${data.revision}"` })
}

function cleanText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : undefined
}

async function enrichLiterature(request: Request) {
  const input: unknown = await request.json().catch(() => null)
  if (!input || typeof input !== 'object') return json(request, 400, { error: 'Invalid metadata request' })
  const { sourceType, identifier, url } = input as Record<string, unknown>
  if (sourceType === 'doi' && typeof identifier === 'string') {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(identifier)}`, { headers: { 'User-Agent': 'BioScene-Engine/0.11 (mailto:support@example.invalid)' } })
    if (!response.ok) return json(request, 502, { error: 'Crossref lookup failed' })
    const data = await response.json()
    const item = data?.message ?? {}
    const authors = Array.isArray(item.author) ? item.author.map((author: Record<string, unknown>) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean).join(', ') : undefined
    return json(request, 200, { title: cleanText(item.title?.[0], 500), authors: cleanText(authors, 1000), year: item.published?.['date-parts']?.[0]?.[0], abstract: cleanText(item.abstract, 20_000), url: `https://doi.org/${encodeURIComponent(identifier)}` })
  }
  if (sourceType === 'pmid' && typeof identifier === 'string' && /^\d{1,12}$/.test(identifier)) {
    const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${identifier}&retmode=json`)
    if (!response.ok) return json(request, 502, { error: 'PubMed lookup failed' })
    const data = await response.json(); const item = data?.result?.[identifier] ?? {}
    const authors = Array.isArray(item.authors) ? item.authors.map((author: Record<string, unknown>) => author.name).filter(Boolean).join(', ') : undefined
    const year = Number.parseInt(String(item.pubdate ?? '').slice(0, 4), 10)
    return json(request, 200, { title: cleanText(item.title, 500), authors: cleanText(authors, 1000), year: Number.isInteger(year) ? year : undefined, url: `https://pubmed.ncbi.nlm.nih.gov/${identifier}/` })
  }
  if (sourceType === 'url' && typeof url === 'string' && /^https?:\/\//i.test(url)) return json(request, 200, { url })
  return json(request, 400, { error: 'Unsupported literature identifier' })
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request)
  if (!cors) return new Response('Origin not allowed', { status: 403 })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    const user = await authenticatedUser(request)
    if (!user) return json(request, 401, { error: 'Authentication required' })
    const path = new URL(request.url).pathname.replace(/^\/bioscene-api/, '')
    const roomMatch = path.match(/^\/rooms\/([^/]+)$/)
    if (roomMatch) return await handleRoom(request, decodeURIComponent(roomMatch[1]), user.id)
    if (path === '/literature/enrich' && request.method === 'POST') return await enrichLiterature(request)
    return json(request, 404, { error: 'Not found' })
  } catch (error) {
    console.error(error)
    return json(request, 500, { error: 'Internal server error' })
  }
})
