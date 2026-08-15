import { defaultStructuralModel } from './molecules'
import { supabaseUniProtEndpoint } from './supabaseClient'
import type { DomainDefinition, MoleculeDefinition, ProteinTopologyClass, StructuralModel, StructuralTemplate, UniProtFeatureRecord } from './types'

export type UniProtSpecies = '9606' | '10090' | '10116' | '9544'
export type UniProtStage = 'searching' | 'fetching' | 'parsing' | 'building' | 'matching' | 'done'
export type UniProtErrorCode = 'network' | 'timeout' | 'not-found' | 'ambiguous' | 'parse' | 'service' | 'configuration' | 'privacy'

export interface UniProtCandidate { accession: string; proteinName: string; geneName?: string; species: string; reviewed: boolean; length?: number }
type UniProtFeature = { type?: string; description?: string; location?: { start?: { value?: number }; end?: { value?: number } } }
type UniProtEntry = {
  primaryAccession?: string; entryType?: string
  proteinDescription?: { recommendedName?: { fullName?: { value?: string } }; submissionNames?: { fullName?: { value?: string } }[] }
  genes?: { geneName?: { value?: string }; synonyms?: { value?: string }[] }[]
  organism?: { scientificName?: string; taxonId?: number }
  sequence?: { length?: number; value?: string }
  features?: UniProtFeature[]
  comments?: { commentType?: string; texts?: { value?: string }[]; subcellularLocations?: { location?: { value?: string } }[] }[]
}

export class UniProtLookupError extends Error {
  constructor(public code: UniProtErrorCode, message: string) { super(message); this.name = 'UniProtLookupError' }
}

const CACHE_PREFIX = 'bioscene.uniprot.v1:'
const ENTRY_TTL = 30 * 24 * 60 * 60 * 1000
const speciesNames: Record<UniProtSpecies, string> = { '9606': 'Homo sapiens', '10090': 'Mus musculus', '10116': 'Rattus norvegicus', '9544': 'Macaca mulatta' }
const featureSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || 'region'

export const isUniProtAccession = (value: string) => /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-\d+)?$/i.test(value.trim())

function readCache<T>(key: string): T | undefined {
  try { const value = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) ?? 'null') as { at?: number; value?: T } | null; return value?.at && Date.now() - value.at < ENTRY_TTL ? value.value : undefined }
  catch { return undefined }
}
function staleCache<T>(key: string): T | undefined {
  try { return (JSON.parse(localStorage.getItem(CACHE_PREFIX + key) ?? 'null') as { value?: T } | null)?.value } catch { return undefined }
}
function writeCache(key: string, value: unknown) { try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value })) } catch { /* optional */ } }

async function requestProxy<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  if (!supabaseUniProtEndpoint) throw new UniProtLookupError('configuration', 'UniProt lookup service is not configured. Use Manual Setup.')
  const timeout = AbortSignal.timeout(15_000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  let response: Response
  try { response = await fetch(supabaseUniProtEndpoint, { method: 'POST', signal: requestSignal, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
  catch { if (requestSignal.aborted) throw new UniProtLookupError('timeout', 'UniProt lookup timed out. Retry or use Manual Setup.'); throw new UniProtLookupError('network', 'Could not connect to the BioScene UniProt service.') }
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new UniProtLookupError('service', 'UniProt service returned an unexpected response.')
  const payload = await response.json().catch(() => null) as ({ error?: string; code?: UniProtErrorCode } & T) | null
  if (!response.ok) throw new UniProtLookupError(payload?.code ?? (response.status === 404 ? 'not-found' : response.status === 408 ? 'timeout' : 'service'), payload?.error ?? 'UniProt service is temporarily unavailable.')
  if (!payload || typeof payload !== 'object') throw new UniProtLookupError('parse', 'UniProt response could not be validated.')
  return payload
}

function candidateFrom(entry: UniProtEntry): UniProtCandidate | undefined {
  if (!entry.primaryAccession || !entry.organism?.scientificName) return undefined
  const proteinName = entry.proteinDescription?.recommendedName?.fullName?.value ?? entry.proteinDescription?.submissionNames?.[0]?.fullName?.value ?? entry.primaryAccession
  return { accession: entry.primaryAccession, proteinName, geneName: entry.genes?.[0]?.geneName?.value, species: entry.organism.scientificName, reviewed: /Swiss-Prot/i.test(entry.entryType ?? ''), length: entry.sequence?.length }
}

export async function searchUniProt(query: string, species: UniProtSpecies = '9606', signal?: AbortSignal) {
  const normalized = query.trim()
  if (!normalized || normalized.length > 100) throw new UniProtLookupError('not-found', 'Enter a protein name, gene symbol, or UniProt accession.')
  const cacheKey = `search:${species}:${normalized.toUpperCase()}`
  const cached = readCache<UniProtCandidate[]>(cacheKey)
  if (cached) return { candidates: cached, cached: true }
  const payload = await requestProxy<{ results?: UniProtEntry[] }>({ action: 'search', query: normalized, organismId: Number(species) }, signal)
  const candidates = (payload.results ?? []).map(candidateFrom).filter((item): item is UniProtCandidate => !!item)
  if (!candidates.length) throw new UniProtLookupError('not-found', 'No UniProt entry found for this query.')
  writeCache(cacheKey, candidates)
  return { candidates, cached: false }
}

function featureRecords(features: UniProtFeature[]): UniProtFeatureRecord[] {
  return features.flatMap((feature) => feature.type ? [{ type: feature.type, description: feature.description, start: feature.location?.start?.value, end: feature.location?.end?.value, source: 'UniProt' as const }] : [])
}
function importedDomains(id: string, features: UniProtFeature[]) {
  const visibleTypes = new Set(['Domain','Topological domain','Transmembrane','Region','Repeat','Chain','Peptide'])
  return features.filter((feature) => visibleTypes.has(feature.type ?? '')).map((feature, index): DomainDefinition => {
    const description = feature.description || feature.type || `Region ${index + 1}`; const lower = `${feature.type} ${description}`.toLowerCase()
    const kind: DomainDefinition['kind'] = lower.includes('transmembrane') ? 'transmembrane' : lower.includes('cytoplas') || lower.includes('intracellular') ? 'intracellular' : lower.includes('extracellular') || lower.includes('outside') ? 'extracellular' : 'functional'
    return { id: `domain:${id}:${featureSlug(description)}_${index + 1}`, label: description, kind, start: feature.location?.start?.value, end: feature.location?.end?.value, source: 'UniProt', confidence: 'high' }
  })
}
function classify(entry: UniProtEntry, domains: DomainDefinition[]): ProteinTopologyClass {
  const features = entry.features ?? []; const tmCount = features.filter((feature) => feature.type === 'Transmembrane').length
  if (tmCount > 1) return 'multi_pass_membrane'; if (tmCount === 1) return 'single_pass_receptor'
  const name = entry.proteinDescription?.recommendedName?.fullName?.value?.toLowerCase() ?? ''
  const locations = (entry.comments ?? []).flatMap((comment) => comment.subcellularLocations ?? []).map((item) => item.location?.value?.toLowerCase() ?? '')
  const secreted = features.some((feature) => feature.type === 'Signal') && locations.some((item) => /secreted|extracellular/.test(item))
  if (secreted && /interleukin|cytokine|chemokine|growth factor/.test(name)) return 'secreted_cytokine'
  if (/enzyme|kinase|phosphatase|protease|hydrolase|transferase|oxidase|reductase/.test(name)) return 'enzyme'
  return entry.sequence?.length || domains.length ? 'soluble' : 'unknown'
}
function modelFor(molecule: MoleculeDefinition, entry: UniProtEntry): StructuralModel {
  const features = entry.features ?? []; const imported = importedDomains(molecule.id, features); const classification = classify(entry, imported)
  const template: StructuralTemplate = classification === 'single_pass_receptor' ? 'single_pass_receptor' : classification === 'multi_pass_membrane' ? 'multi_pass_receptor' : classification === 'secreted_cytokine' ? 'cytokine' : classification === 'enzyme' ? 'enzyme' : 'globular'
  const fallback = defaultStructuralModel(molecule.id, molecule.name, molecule.moleculeClass, template); const transmembrane = features.some((feature) => feature.type === 'Transmembrane')
  return { ...fallback, template, templateSource: 'UniProt', templateConfidence: imported.length ? 'high' : 'medium', classification, visualScaling: 'schematic', modified: false,
    topology: { signalPeptide: features.some((feature) => feature.type === 'Signal'), extracellular: imported.some((item) => item.kind === 'extracellular') || !transmembrane, transmembrane, cytoplasmic: imported.some((item) => item.kind === 'intracellular') || transmembrane }, domains: imported.length ? imported : fallback.domains }
}
function validateEntry(value: unknown): UniProtEntry {
  if (!value || typeof value !== 'object') throw new UniProtLookupError('parse', 'UniProt entry was retrieved, but structural annotation could not be parsed.')
  const entry = value as UniProtEntry
  if (!entry.primaryAccession || !entry.sequence || typeof entry.sequence.length !== 'number') throw new UniProtLookupError('parse', 'UniProt entry was retrieved, but structural annotation could not be parsed.')
  return entry
}

export async function importUniProtEntry(molecule: MoleculeDefinition, accession: string, onStage?: (stage: UniProtStage) => void, signal?: AbortSignal): Promise<MoleculeDefinition> {
  if (molecule.privacy === 'private') throw new UniProtLookupError('privacy', 'Private constructs are never sent to public databases.')
  onStage?.('fetching'); const key = `entry:${accession.toUpperCase()}`; let entry = readCache<UniProtEntry>(key); let cached = !!entry
  if (!entry) {
    try { const payload = await requestProxy<{ entry?: unknown }>({ action: 'entry', accession }, signal); entry = validateEntry(payload.entry); writeCache(key, entry) }
    catch (error) { const stale = staleCache<UniProtEntry>(key); if (!stale) throw error; entry = validateEntry(stale); cached = true }
  }
  onStage?.('parsing'); const features = entry.features ?? []
  const locations = (entry.comments ?? []).filter((comment) => comment.commentType === 'SUBCELLULAR LOCATION').flatMap((comment) => comment.subcellularLocations ?? []).flatMap((item) => item.location?.value ? [item.location.value] : [])
  onStage?.('building'); const structuralModel = modelFor(molecule, entry); onStage?.('matching')
  const proteinName = entry.proteinDescription?.recommendedName?.fullName?.value ?? entry.proteinDescription?.submissionNames?.[0]?.fullName?.value
  const next: MoleculeDefinition = { ...molecule, geneName: entry.genes?.[0]?.geneName?.value ?? molecule.geneName, proteinName, species: entry.organism?.scientificName, uniprotAccession: entry.primaryAccession, length: entry.sequence?.length, sequence: entry.sequence?.value, subcellularLocations: locations, uniprotFeatures: featureRecords(features), originalStructuralModel: structuredClone(structuralModel), structuralModel, uniprotFetchedAt: new Date().toISOString(), uniprotCached: cached, lookupStatus: 'enriched', lookupMessage: cached ? `Using cached UniProt annotation · ${entry.primaryAccession}` : `Imported from UniProt ${entry.primaryAccession}`, updatedAt: new Date().toISOString() }
  onStage?.('done'); return next
}

export async function lookupUniProt(molecule: MoleculeDefinition, species: UniProtSpecies = '9606', onStage?: (stage: UniProtStage) => void, signal?: AbortSignal) {
  if (molecule.privacy === 'private') throw new UniProtLookupError('privacy', 'Private constructs are never sent to public databases.')
  const raw = molecule.uniprotAccession?.trim() || molecule.geneName?.trim() || molecule.name.trim(); onStage?.('searching')
  if (isUniProtAccession(raw)) return { molecule: await importUniProtEntry(molecule, raw, onStage, signal), candidates: [] as UniProtCandidate[] }
  const result = await searchUniProt(raw, species, signal); const exact = result.candidates.filter((item) => item.geneName?.toUpperCase() === raw.toUpperCase())
  if (result.candidates.length === 1 || exact.length === 1) return { molecule: await importUniProtEntry(molecule, (exact[0] ?? result.candidates[0]).accession, onStage, signal), candidates: [] as UniProtCandidate[] }
  return { molecule: undefined, candidates: result.candidates }
}

export const uniProtSpeciesOptions = (Object.entries(speciesNames) as [UniProtSpecies, string][]).map(([id, label]) => ({ id, label }))
