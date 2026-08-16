import type { AnnotationConfidence, AnnotationSource, MoleculeDefinition } from '../../types'
import type { UniProtSpecies, UniProtStage } from '../../uniprot'

export interface ProteinFeature {
  id: string
  type: string
  label: string
  start?: number
  end?: number
  source: AnnotationSource
  confidence?: AnnotationConfidence
}

export interface ProteinDefinition {
  accession: string
  name: string
  geneName?: string
  species?: string
  length?: number
  sequence?: string
  features: ProteinFeature[]
  fetchedAt?: string
  cached: boolean
}

export interface ProteinSearchResult {
  accession: string
  name: string
  geneName?: string
  species: string
  reviewed: boolean
  length?: number
}

export interface ProteinAnnotationProvider {
  readonly id: string
  readonly label: string
  search(query: string, species?: UniProtSpecies, signal?: AbortSignal): Promise<ProteinSearchResult[]>
  importInto(molecule: MoleculeDefinition, accession: string, onStage?: (stage: UniProtStage) => void, signal?: AbortSignal): Promise<MoleculeDefinition>
  lookupFor(molecule: MoleculeDefinition, species?: UniProtSpecies, onStage?: (stage: UniProtStage) => void, signal?: AbortSignal): Promise<{ molecule?: MoleculeDefinition; candidates: ProteinSearchResult[] }>
  normalize(molecule: MoleculeDefinition): ProteinDefinition | undefined
}

