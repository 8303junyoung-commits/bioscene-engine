import type { LiteratureRecord, RoomConfig, SceneFile } from './types'
import { parseSceneFile, safeHttpUrl } from './utils'

export class BackendConflictError extends Error {
  constructor() { super('Room changed on the server. Pull the latest revision before pushing again.') }
}

export function sanitizedEndpoint(raw: string) {
  const url = new URL(raw)
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !localHttp) throw new Error('Backend endpoint must use HTTPS')
  url.username = ''; url.password = ''; url.search = ''; url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function requestHeaders(room: RoomConfig, token: string, json = false) {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-BioScene-Schema': 'bioscene.scene.v0.14' }
  if (json) headers['Content-Type'] = 'application/json'
  if (room.authMode === 'bearer' && token) headers.Authorization = `Bearer ${token}`
  if (room.authMode === 'api-key' && token) {
    const forbidden = new Set(['accept', 'authorization', 'connection', 'content-length', 'content-type', 'cookie', 'host', 'origin', 'referer', 'sec-fetch-site'])
    const name = /^[A-Za-z][A-Za-z0-9-]{1,63}$/.test(room.apiKeyHeader) && !forbidden.has(room.apiKeyHeader.toLowerCase()) ? room.apiKeyHeader : 'X-API-Key'
    headers[name] = token
  }
  return headers
}

function responseRevision(response: Response, body?: unknown) {
  const etag = response.headers.get('etag')?.replace(/^W\//, '').replaceAll('"', '')
  if (etag) return etag
  if (body && typeof body === 'object' && 'revision' in body && typeof body.revision === 'string') return body.revision
  return undefined
}

export async function pushRoom(room: RoomConfig, token: string, scene: SceneFile) {
  const endpoint = sanitizedEndpoint(room.endpoint)
  const headers = requestHeaders(room, token, true)
  if (room.revision) headers['If-Match'] = `"${room.revision.replaceAll('"', '')}"`
  const response = await fetch(`${endpoint}/rooms/${encodeURIComponent(room.roomId)}`, {
    method: 'PUT', signal: AbortSignal.timeout(15000), headers, body: JSON.stringify({ scene, revision: room.revision }),
  })
  if (response.status === 409 || response.status === 412) throw new BackendConflictError()
  if (response.status === 401 || response.status === 403) throw new Error('Backend authentication failed')
  if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`)
  let body: unknown
  if (response.headers.get('content-type')?.includes('application/json')) body = await response.json()
  return { endpoint, revision: responseRevision(response, body) ?? room.revision }
}

export async function pullRoom(room: RoomConfig, token: string) {
  const endpoint = sanitizedEndpoint(room.endpoint)
  const response = await fetch(`${endpoint}/rooms/${encodeURIComponent(room.roomId)}`, {
    signal: AbortSignal.timeout(15000), headers: requestHeaders(room, token),
  })
  if (response.status === 401 || response.status === 403) throw new Error('Backend authentication failed')
  if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`)
  const body: unknown = await response.json()
  const payload = body && typeof body === 'object' && 'scene' in body ? body.scene : body
  const scene = parseSceneFile(payload)
  if (!scene) throw new Error('Backend returned an invalid BioScene payload')
  return { endpoint, scene, revision: responseRevision(response, body) }
}

export async function enrichLiterature(room: RoomConfig, token: string, record: LiteratureRecord) {
  const endpoint = sanitizedEndpoint(room.endpoint)
  const response = await fetch(`${endpoint}/literature/enrich`, {
    method: 'POST', signal: AbortSignal.timeout(15000), headers: requestHeaders(room, token, true),
    body: JSON.stringify({ sourceType: record.sourceType, identifier: record.identifier, url: record.url }),
  })
  if (response.status === 401 || response.status === 403) throw new Error('Backend authentication failed')
  if (!response.ok) throw new Error(`Metadata service returned HTTP ${response.status}`)
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object') throw new Error('Metadata service returned invalid JSON')
  const item = value as Record<string, unknown>
  const url = safeHttpUrl(item.url)
  return {
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : record.title,
    authors: typeof item.authors === 'string' ? item.authors : record.authors,
    year: typeof item.year === 'number' && Number.isInteger(item.year) && item.year > 1600 && item.year < 2200 ? item.year : record.year,
    abstract: typeof item.abstract === 'string' ? item.abstract.slice(0, 20_000) : record.abstract,
    url: url ?? record.url,
    metadataStatus: 'enriched' as const,
    enrichedAt: new Date().toISOString(),
  }
}

