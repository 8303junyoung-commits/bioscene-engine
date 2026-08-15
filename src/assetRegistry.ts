import type { AssetReference, BioKind } from './types'

export interface ManifestAsset {
  id: string
  name: string
  category: string
  author: string
  license: { spdx: string; url: string }
  file: string
  sourceUrl: string
}

export function safeAssetFile(file: string) {
  if (!file.toLowerCase().endsWith('.svg') || file.startsWith('/') || file.includes('..') || file.includes('\\')) return undefined
  return file.split('/').every((part) => part.length > 0) ? file : undefined
}

type RegistryEntry = { synonyms: string[]; identifiers: AssetReference['identifiers'] }

const registry: Record<string, RegistryEntry> = {
  il18: {
    synonyms: ['IL-18', 'interleukin 18', 'interferon gamma-inducing factor', 'IGIF', 'IL1F4', '인터루킨 18'],
    identifiers: [
      { database: 'UniProt', id: 'Q14116', url: 'https://www.uniprot.org/uniprotkb/Q14116/entry' },
      { database: 'Reactome', id: 'R-HSA-448446', url: 'https://reactome.org/content/detail/R-HSA-448446' },
    ],
  },
  il18r1: {
    synonyms: ['IL-18Rα', 'IL18RA', 'CD218a', 'interleukin-18 receptor 1', 'IL-18 receptor alpha'],
    identifiers: [{ database: 'UniProt', id: 'Q13478', url: 'https://www.uniprot.org/uniprotkb/Q13478/entry' }],
  },
  il18rap: {
    synonyms: ['IL-18Rβ', 'IL18RB', 'IL-18RAcP', 'CD218b', 'interleukin-18 receptor accessory protein'],
    identifiers: [{ database: 'UniProt', id: 'O95256', url: 'https://www.uniprot.org/uniprotkb/O95256/entry' }],
  },
  pathway: {
    synonyms: ['IL-18 signaling', 'interleukin-18 pathway', 'NF-kB signaling', '염증 신호'],
    identifiers: [{ database: 'Reactome', id: 'R-HSA-9012546', url: 'https://reactome.org/content/detail/R-HSA-9012546' }],
  },
}

const kindTerms: Record<BioKind, string[]> = {
  membrane: ['membrane', 'bilayer', 'biological boundary'],
  cell: ['cell', '세포'], receptor: ['receptor', '수용체', 'membrane protein'], ligand: ['ligand', 'cytokine', '리간드', 'interleukin'],
  antibody: ['antibody', 'immunoglobulin', '항체', 'IgG'], signal: ['signal', 'kinase', 'pathway', '신호'], transcription: ['transcription', 'DNA', 'gene', '전사'],
  annotation: ['annotation', 'callout', 'note', '주석'],
}

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, '') }

export function metadataFor(label: string, kind: BioKind) {
  const key = normalized(label)
  const entry = Object.entries(registry).find(([name]) => key.includes(name) || name.includes(key))?.[1]
  return {
    synonyms: Array.from(new Set([label, ...kindTerms[kind], ...(entry?.synonyms ?? [])])),
    identifiers: entry?.identifiers ?? (kind === 'signal' ? registry.pathway.identifiers : []),
  }
}

export function bindManifestAsset(asset: ManifestAsset, label: string, kind: BioKind): AssetReference {
  const metadata = metadataFor(label, kind)
  return {
    id: asset.id, name: asset.name, category: asset.category, author: asset.author,
    licenseSpdx: asset.license.spdx, licenseUrl: asset.license.url, file: asset.file, sourceUrl: asset.sourceUrl,
    synonyms: metadata.synonyms, identifiers: metadata.identifiers,
    svgDomains: [{ id: 'whole-asset', label: 'Whole SVG visual', selector: 'svg', mappingStatus: 'whole-asset' }],
  }
}

export function searchText(asset: ManifestAsset) {
  return normalized(`${asset.name} ${asset.category} ${asset.author} ${asset.id}`)
}

export { normalized }
