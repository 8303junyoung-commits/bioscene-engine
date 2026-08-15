import { BookOpen, Link2, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { appraisalWeights, parseLiteratureInput, scoreAppraisal } from '../evidence'
import type { EvidenceAppraisal, LiteratureRecord } from '../types'
import { safeHttpUrl } from '../utils'

interface Props {
  records: LiteratureRecord[]
  selectedEdgeId?: string
  attachedIds: string[]
  enrichingId?: string
  canEnrich: boolean
  onChange: (items: LiteratureRecord[]) => void
  onAttach: (id: string) => void
  onEnrich: (id: string) => void
  onClose: () => void
}

export function LiteraturePanel({ records, selectedEdgeId, attachedIds, enrichingId, canEnrich, onChange, onAttach, onEnrich, onClose }: Props) {
  const [input, setInput] = useState('')
  const add = () => { if (!input.trim()) return; onChange([{ ...parseLiteratureInput(input), metadataStatus: 'local' }, ...records]); setInput('') }
  const update = (id: string, patch: Partial<LiteratureRecord>) => onChange(records.map((record) => {
    if (record.id !== id) return record
    const next = { ...record, ...patch }
    return { ...next, score: scoreAppraisal(next.appraisal) }
  }))
  const appraisalLabels: Record<keyof EvidenceAppraisal, string> = { peerReviewed: 'Peer reviewed', directMechanism: 'Direct mechanism', humanRelevant: 'Human relevant', replicated: 'Replicated', fullTextAvailable: 'Full text' }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Literature evidence"><section className="phase9-panel"><header><div><span className="eyebrow">EVIDENCE LIBRARY</span><h2><BookOpen size={21} /> Literature ingestion</h2><p>Import identifiers locally, then optionally enrich trusted metadata through the configured production backend.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="phase9-body"><div className="import-row"><textarea aria-label="Literature source" rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste PMID, DOI, URL, or citation"/><button onClick={add}><Plus size={15}/> Import</button></div><small className="scoring-note">Score = peer review 20 + direct mechanism 30 + human relevance 20 + replication 20 + full text 10.</small><div className="record-list">{records.length === 0 && <div className="empty-card">No literature imported yet.</div>}{records.map((record) => <article className="literature-card" key={record.id}><div className="record-heading"><span className="score-badge">{record.score}</span><input aria-label="Literature title" value={record.title} onChange={(e) => update(record.id, { title: e.target.value })}/><button aria-label="Delete literature" onClick={() => onChange(records.filter((item) => item.id !== record.id))}><Trash2 size={14}/></button></div><div className="record-meta"><span>{record.sourceType.toUpperCase()}</span><code>{record.identifier}</code>{safeHttpUrl(record.url) && <a href={safeHttpUrl(record.url)} target="_blank" rel="noreferrer"><Link2 size={13}/> source</a>}<span className={`metadata-status status-${record.metadataStatus ?? 'local'}`}>{record.metadataStatus ?? 'local'}</span></div>{(record.authors || record.year) && <p className="literature-byline">{record.authors}{record.authors && record.year ? ' · ' : ''}{record.year}</p>}{record.abstract && <p className="literature-abstract">{record.abstract}</p>}<button className="enrich-button" disabled={!canEnrich || enrichingId === record.id || record.sourceType === 'internal'} onClick={() => onEnrich(record.id)}><RefreshCw size={13}/>{enrichingId === record.id ? ' Enriching…' : ' Enrich metadata'}</button><div className="appraisal-grid">{(Object.keys(appraisalLabels) as (keyof EvidenceAppraisal)[]).map((key) => <label key={key}><input type="checkbox" checked={record.appraisal[key]} onChange={(e) => update(record.id, { appraisal: { ...record.appraisal, [key]: e.target.checked } })}/>{appraisalLabels[key]} <small>+{appraisalWeights[key]}</small></label>)}</div><button className={attachedIds.includes(record.id) ? 'attach-button attached' : 'attach-button'} disabled={!selectedEdgeId || attachedIds.includes(record.id)} onClick={() => onAttach(record.id)}>{attachedIds.includes(record.id) ? 'Attached to selected interaction' : selectedEdgeId ? 'Attach to selected interaction' : 'Select an interaction to attach'}</button></article>)}</div></div></section></div>
}
