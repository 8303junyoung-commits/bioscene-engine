import type { EvidenceAppraisal, LiteratureRecord, LiteratureSourceType } from './types'
import { uid } from './identity'

export const appraisalWeights: Record<keyof EvidenceAppraisal, number> = {
  peerReviewed: 20,
  directMechanism: 30,
  humanRelevant: 20,
  replicated: 20,
  fullTextAvailable: 10,
}

export const defaultAppraisal: EvidenceAppraisal = {
  peerReviewed: false,
  directMechanism: false,
  humanRelevant: false,
  replicated: false,
  fullTextAvailable: false,
}

export function scoreAppraisal(value?: Partial<EvidenceAppraisal>) {
  if (!value) return 0
  return (Object.keys(appraisalWeights) as (keyof EvidenceAppraisal)[]).reduce((sum, key) => sum + (value[key] ? appraisalWeights[key] : 0), 0)
}

export function parseLiteratureInput(raw: string): LiteratureRecord {
  const input = raw.trim()
  const doi = input.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0]?.replace(/[.,;:)\]]+$/, '')
  const pubmedUrlId = input.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{6,9})/i)?.[1]
  const pmid = pubmedUrlId ?? input.match(/(?:PMID\s*[:#]?\s*)?(\d{6,9})/i)?.[1]
  const url = input.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, '')
  let sourceType: LiteratureSourceType = 'internal'
  let identifier = input
  let sourceUrl: string | undefined
  if (doi) { sourceType = 'doi'; identifier = doi; sourceUrl = `https://doi.org/${doi}` }
  else if (pmid && (pubmedUrlId || /pmid/i.test(input) || /^\d+$/.test(input))) { sourceType = 'pubmed'; identifier = pmid; sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` }
  else if (url) { sourceType = 'url'; identifier = url; sourceUrl = url }
  return {
    id: uid('literature'), title: sourceType === 'internal' ? (input || 'Untitled source') : `${sourceType.toUpperCase()} ${identifier} — title pending`, sourceType, identifier, url: sourceUrl,
    importedAt: new Date().toISOString(), appraisal: { ...defaultAppraisal }, score: 0,
  }
}
