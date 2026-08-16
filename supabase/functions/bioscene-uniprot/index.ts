import { canonicalUniProtGene, uniProtSearchExpression } from '../_shared/uniprotQuery.ts'

const upstream = 'https://rest.uniprot.org/uniprotkb'
const allowedOrigins = new Set((Deno.env.get('BIOSCENE_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:4173,https://bioscene-engine.onrender.com').split(',').map((item) => item.trim()).filter(Boolean))
const allowedOrganisms = new Set([9606, 10090, 10116, 9544])
const accessionPattern = /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-\d+)?$/i

type Coordinate = { x:number; y:number; z:number; confidence:number }
type AlphaFoldPrediction = { entryId?:string; pdbUrl?:string }

function projectTrace(coordinates: Coordinate[]) {
  const sampled = coordinates.filter((_point,index) => index % Math.max(1,Math.ceil(coordinates.length / 150)) === 0)
  if (sampled.length < 2) return []
  const mean = sampled.reduce((sum,point) => ({x:sum.x+point.x,y:sum.y+point.y,z:sum.z+point.z}),{x:0,y:0,z:0})
  mean.x/=sampled.length; mean.y/=sampled.length; mean.z/=sampled.length
  const variances = ['x','y','z'].map((axis) => ({axis:axis as 'x'|'y'|'z',value:sampled.reduce((sum,point) => sum+(point[axis]-mean[axis])**2,0)})).sort((a,b)=>b.value-a.value)
  const horizontal=variances[0].axis; const vertical=variances[1].axis
  const raw=sampled.map((point)=>({x:point[horizontal]-mean[horizontal],y:point[vertical]-mean[vertical],confidence:point.confidence}))
  const xRange=Math.max(1,...raw.map((point)=>point.x))-Math.min(0,...raw.map((point)=>point.x)); const yRange=Math.max(1,...raw.map((point)=>point.y))-Math.min(0,...raw.map((point)=>point.y))
  const scale=Math.min(60/xRange,52/yRange); const xMid=(Math.max(...raw.map((point)=>point.x))+Math.min(...raw.map((point)=>point.x)))/2; const yMid=(Math.max(...raw.map((point)=>point.y))+Math.min(...raw.map((point)=>point.y)))/2
  return raw.map((point):[number,number,number]=>[Math.round((36+(point.x-xMid)*scale)*10)/10,Math.round((32+(point.y-yMid)*scale)*10)/10,Math.round(point.confidence)])
}

async function fetchAlphaFoldTrace(accession:string) {
  try {
    const metadataResponse=await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${encodeURIComponent(accession)}`,{signal:AbortSignal.timeout(8_000),headers:{Accept:'application/json','User-Agent':'BioScene-Engine/0.16'}})
    if (!metadataResponse.ok) return undefined
    const predictions=await metadataResponse.json().catch(()=>null) as AlphaFoldPrediction[]|null; const prediction=Array.isArray(predictions)?predictions.find((item)=>item.pdbUrl):undefined
    if (!prediction?.pdbUrl) return undefined
    const coordinateResponse=await fetch(prediction.pdbUrl,{signal:AbortSignal.timeout(10_000),headers:{Accept:'text/plain','User-Agent':'BioScene-Engine/0.16'}})
    if (!coordinateResponse.ok) return undefined
    const pdb=await coordinateResponse.text(); const coordinates:Coordinate[]=[]
    for (const line of pdb.split('\n')) {
      if (!line.startsWith('ATOM') || line.slice(12,16).trim()!=='CA') continue
      const x=Number(line.slice(30,38)); const y=Number(line.slice(38,46)); const z=Number(line.slice(46,54)); const confidence=Number(line.slice(60,66))
      if ([x,y,z,confidence].every(Number.isFinite)) coordinates.push({x,y,z,confidence})
    }
    const points=projectTrace(coordinates); if (points.length<2) return undefined
    const meanConfidence=Math.round(coordinates.reduce((sum,point)=>sum+point.confidence,0)/coordinates.length)
    const modelId=prediction.entryId??`AF-${accession}-F1`
    return {source:'AlphaFold DB' as const,modelId,entryUrl:`https://alphafold.ebi.ac.uk/entry/${encodeURIComponent(accession)}`,coordinateUrl:prediction.pdbUrl,meanConfidence,points}
  } catch { return undefined }
}

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
      const [result,structureTrace] = await Promise.all([fetchUniProt(new URL(`${upstream}/${encodeURIComponent(accession)}?format=json`)),fetchAlphaFoldTrace(accession)])
      return result.data ? reply(request, 200, { entry: result.data, structureTrace }) : reply(request, result.status, { error: result.error, code: result.code })
    }
    if (body.action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : ''
      const organismId = Number(body.organismId)
      if (!/^[\p{L}\p{N} ._()'/-]{1,100}$/u.test(query) || !allowedOrganisms.has(organismId)) return reply(request, 400, { error: 'Invalid UniProt search query', code: 'not-found' })
      const expression = uniProtSearchExpression(query, organismId)
      const url = new URL(`${upstream}/search`); url.searchParams.set('query', expression); url.searchParams.set('format', 'json'); url.searchParams.set('size', '8')
      const result = await fetchUniProt(url)
      if (!result.data) return reply(request, result.status, { error: result.error, code: result.code })
      const results = (result.data as { results?: unknown[] }).results
      if (!Array.isArray(results) || !results.length) return reply(request, 404, { error: 'No UniProt entry found for this query.', code: 'not-found' })
      const canonical = canonicalUniProtGene(query).toUpperCase()
      const exactResults = results.filter((item) => {
        if (!item || typeof item !== 'object') return false
        const genes = (item as { genes?: { geneName?: { value?: string } }[] }).genes
        return genes?.[0]?.geneName?.value?.toUpperCase() === canonical
      })
      return reply(request, 200, { results: exactResults.length ? exactResults : results })
    }
    return reply(request, 400, { error: 'Unsupported lookup action', code: 'service' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') return reply(request, 408, { error: 'UniProt lookup timed out.', code: 'timeout' })
    console.error('UniProt proxy failure', error instanceof Error ? error.name : 'unknown')
    return reply(request, 503, { error: 'UniProt service is temporarily unavailable.', code: 'service' })
  }
})

