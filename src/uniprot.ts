import { defaultStructuralModel, suggestedTemplate } from './molecules'
import type { DomainDefinition, MoleculeDefinition } from './types'

type UniProtFeature = { type?: string; description?: string; location?: { start?: { value?: number }; end?: { value?: number } } }
type UniProtEntry = {
  primaryAccession?: string
  proteinDescription?: { recommendedName?: { fullName?: { value?: string } }; submissionNames?: { fullName?: { value?: string } }[] }
  genes?: { geneName?: { value?: string } }[]
  organism?: { scientificName?: string }
  sequence?: { length?: number }
  features?: UniProtFeature[]
  comments?: { commentType?: string; subcellularLocations?: { location?: { value?: string } }[] }[]
}

const featureSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || 'region'

function importedDomains(id: string, features: UniProtFeature[]) {
  const relevant = features.filter((feature) => ['Domain','Topological domain','Transmembrane','Region','Repeat','Signal'].includes(feature.type ?? ''))
  return relevant.map((feature, index): DomainDefinition => {
    const description = feature.description || feature.type || `Region ${index + 1}`
    const lower = `${feature.type} ${description}`.toLowerCase()
    const kind: DomainDefinition['kind'] = lower.includes('transmembrane') ? 'transmembrane' : lower.includes('cytoplas') || lower.includes('intracellular') ? 'intracellular' : lower.includes('extracellular') || lower.includes('outside') ? 'extracellular' : 'functional'
    return { id: `domain:${id}:${featureSlug(description)}_${index + 1}`, label: description, kind, start: feature.location?.start?.value, end: feature.location?.end?.value, source: 'UniProt', confidence: 'high' }
  })
}

export async function lookupUniProt(molecule: MoleculeDefinition, signal?: AbortSignal): Promise<MoleculeDefinition> {
  if (molecule.privacy === 'private') throw new Error('Private constructs are never sent to public databases.')
  const raw = molecule.uniprotAccession?.trim() || molecule.geneName?.trim() || molecule.name.trim()
  const isAccession = /^[A-NR-Z0-9][A-Z0-9]{5,9}$/i.test(raw)
  const query = isAccession ? `accession:${raw}` : `(gene_exact:${raw.replace(/[^A-Za-z0-9_-]/g,'')}) AND organism_id:9606 AND reviewed:true`
  const response = await fetch(`https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}&format=json&size=1`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`UniProt returned ${response.status}`)
  const payload = await response.json() as { results?: UniProtEntry[] }
  const entry = payload.results?.[0]
  if (!entry) throw new Error(`No reviewed human UniProt entry found for ${raw}`)
  const features = entry.features ?? []
  const transmembrane = features.some((feature) => feature.type === 'Transmembrane')
  const imported = importedDomains(molecule.id, features)
  const template = suggestedTemplate(molecule.name, molecule.moleculeClass, transmembrane)
  const fallback = defaultStructuralModel(molecule.id, molecule.name, molecule.moleculeClass, template)
  const domains = imported.length ? imported : fallback.domains
  const locations = (entry.comments ?? []).filter((comment) => comment.commentType === 'SUBCELLULAR LOCATION').flatMap((comment) => comment.subcellularLocations ?? []).flatMap((item) => item.location?.value ? [item.location.value] : [])
  return {
    ...molecule,
    geneName: entry.genes?.[0]?.geneName?.value ?? molecule.geneName,
    proteinName: entry.proteinDescription?.recommendedName?.fullName?.value ?? entry.proteinDescription?.submissionNames?.[0]?.fullName?.value,
    species: entry.organism?.scientificName,
    uniprotAccession: entry.primaryAccession,
    length: entry.sequence?.length,
    subcellularLocations: locations,
    structuralModel: {
      ...fallback,
      templateSource: 'UniProt',
      templateConfidence: 'high',
      topology: {
        signalPeptide: features.some((feature) => feature.type === 'Signal'),
        extracellular: domains.some((item) => item.kind === 'extracellular') || !transmembrane,
        transmembrane,
        cytoplasmic: domains.some((item) => item.kind === 'intracellular') || transmembrane,
      },
      domains,
    },
    lookupStatus: 'enriched',
    lookupMessage: `Imported from UniProt ${entry.primaryAccession ?? ''}`.trim(),
    updatedAt: new Date().toISOString(),
  }
}
