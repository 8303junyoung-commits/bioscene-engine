import { importUniProtEntry, lookupUniProt, searchUniProt } from '../../uniprot'
import type { MoleculeDefinition } from '../../types'
import type { ProteinAnnotationProvider, ProteinDefinition, ProteinSearchResult } from './types'

const toSearchResult = (item: Awaited<ReturnType<typeof searchUniProt>>['candidates'][number]): ProteinSearchResult => ({
  accession: item.accession,
  name: item.proteinName,
  geneName: item.geneName,
  species: item.species,
  reviewed: item.reviewed,
  length: item.length,
})

export class UniProtProvider implements ProteinAnnotationProvider {
  readonly id = 'uniprot'
  readonly label = 'UniProtKB'

  async search(query: string, species?: Parameters<ProteinAnnotationProvider['search']>[1], signal?: AbortSignal) {
    const result = await searchUniProt(query, species, signal)
    return result.candidates.map(toSearchResult)
  }

  importInto(...args: Parameters<ProteinAnnotationProvider['importInto']>) {
    return importUniProtEntry(...args)
  }

  async lookupFor(...args: Parameters<ProteinAnnotationProvider['lookupFor']>) {
    const result = await lookupUniProt(...args)
    return { molecule: result.molecule, candidates: result.candidates.map(toSearchResult) }
  }

  normalize(molecule: MoleculeDefinition): ProteinDefinition | undefined {
    if (!molecule.uniprotAccession) return undefined
    return {
      accession: molecule.uniprotAccession,
      name: molecule.proteinName ?? molecule.name,
      geneName: molecule.geneName,
      species: molecule.species,
      length: molecule.length,
      sequence: molecule.sequence,
      features: (molecule.uniprotFeatures ?? []).map((feature, index) => ({
        id: `uniprot:${molecule.uniprotAccession}:${feature.type}:${feature.start ?? 'x'}:${feature.end ?? index}`,
        type: feature.type,
        label: feature.description || feature.type,
        start: feature.start,
        end: feature.end,
        source: feature.source,
        confidence: 'high',
      })),
      fetchedAt: molecule.uniprotFetchedAt,
      cached: !!molecule.uniprotCached,
    }
  }
}

export const uniProtProvider = new UniProtProvider()

