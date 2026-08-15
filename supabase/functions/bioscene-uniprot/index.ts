const upstream = 'https://rest.uniprot.org/uniprotkb'
const allowedOrigins = new Set((Deno.env.get('BIOSCENE_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:4173,https://bioscene-engine.onrender.com').split(',').map((item) => item.trim()).filter(Boolean))
const allowedOrganisms = new Set([9606, 10090, 10116, 9544])
const publicGeneAliases: Record<string,string> = { IL18RB: 'IL18RAP' }
const accessionPattern = /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-\d+)?$/i

function cors(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && !allowedOrigins.has(origin)) return null
  return { 'Access-Control-Allow-Origin': origin ?? [...allowedOrigins][0], 'Access-Control-Allow-Headers': 'content-type, apikey', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' }
}
function reply(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...(cors(request) ?? {}) } })
}
async function fetchUniProt(url: URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { Accept: 'application/json', 'User-Agent': 'BioScene-Engine/0.15' } })
  const type = response.headers.get('content-type') ?? ''
  if (response.status === 404) return { status: 404, error: 'No UniProt entry found for this query.', code: 'not-found' }
  if (response.status === 429) return { status: 429, error: 'UniProt rate limit reached. Please retry shortly.', code: 'service' }
  if (response.status >= 500) return { status: 503, error: 'UniProt service is temporarily unavailable.', code: 'service' }
  if (!response.ok) return { status: 400, error: 'UniProt rejected the lookup request.', code: 'service' }
  if (!type.includes('application/json')) return { status: 502, error: 'UniProt returned an unexpected response.', code: 'parse' }
  const data: unknown = await response.json().catch(() => null)
  if (!data || typeof data !== 'object') return { status: 502, error: 'UniProt response could not be parsed.', code: 'parse' }
  return { status: 200, data }
}

Deno.serve(async (request) => {
  const headers = cors(request)
  if (!headers) return new Response('Origin not allowed', { status: 403 })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (!['GET','POST'].includes(request.method)) return reply(request, 405, { error: 'Method not allowed', code: 'service' })
  if ((Number(request.headers.get('content-length')) || 0) > 2048) return reply(request, 413, { error: 'Lookup request is too large', code: 'service' })
  try {
    const params = new URL(request.url).searchParams
    const input: unknown = request.method === 'GET' ? { action:params.get('action'), query:params.get('query'), accession:params.get('accession'), organismId:params.get('organismId') } : await request.json().catch(() => null)
    if (!input || typeof input !== 'object') return reply(request, 400, { error: 'Invalid lookup request', code: 'service' })
    const body = input as Record<string, unknown>
    if (body.action === 'entry') {
      const accession = typeof body.accession === 'string' ? body.accession.trim().toUpperCase() : ''
      if (!accessionPattern.test(accession)) return reply(request, 400, { error: 'Invalid UniProt accession', code: 'not-found' })
      const result = await fetchUniProt(new URL(`${upstream}/${encodeURIComponent(accession)}?format=json`))
      return result.data ? reply(request, 200, { entry: result.data }) : reply(request, result.status, { error: result.error, code: result.code })
    }
    if (body.action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : ''
      const organismId = Number(body.organismId)
      if (!/^[\p{L}\p{N} ._()'/-]{1,100}$/u.test(query) || !allowedOrganisms.has(organismId)) return reply(request, 400, { error: 'Invalid UniProt search query', code: 'not-found' })
      const safe = query.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
      const exact = safe.replace(/[^A-Za-z0-9_-]/g, ''); const canonical = publicGeneAliases[exact.toUpperCase()] ?? exact
      const expression = canonical ? `(reviewed:true) AND (organism_id:${organismId}) AND ((gene_exact:${canonical}) OR (gene:${canonical}) OR (${canonical}))` : `(reviewed:true) AND (organism_id:${organismId}) AND (${safe})`
      const url = new URL(`${upstream}/search`); url.searchParams.set('query', expression); url.searchParams.set('format', 'json'); url.searchParams.set('size', '8')
      const result = await fetchUniProt(url)
      if (!result.data) return reply(request, result.status, { error: result.error, code: result.code })
      const results = (result.data as { results?: unknown[] }).results
      if (!Array.isArray(results) || !results.length) return reply(request, 404, { error: 'No UniProt entry found for this query.', code: 'not-found' })
      return reply(request, 200, { results })
    }
    return reply(request, 400, { error: 'Unsupported lookup action', code: 'service' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') return reply(request, 408, { error: 'UniProt lookup timed out.', code: 'timeout' })
    console.error('UniProt proxy failure', error instanceof Error ? error.name : 'unknown')
    return reply(request, 503, { error: 'UniProt service is temporarily unavailable.', code: 'service' })
  }
})

