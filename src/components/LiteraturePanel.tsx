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
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Literature evidence"><section className="phase9-panel"><header><div><span className="eyebrow">EVIDENCE LIBRARY</span><h2><BookOpen size={21} /> Literature ingestion</h2><p>Import identifiers locally, then optionally enrich trusted metadata through the configured production backend.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="phase9-body"><div className="import-row" data-help="PMID 숫자, DOI, http(s) 논문 주소 또는 자유 형식 내부 인용을 붙여넣고 Import를 누르세요. 형식을 판별해 문헌 카드로 만들며 입력 원문도 보존합니다."><textarea aria-label="Literature source" rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste PMID, DOI, URL, or citation"/><button onClick={add}><Plus size={15}/> Import</button></div><small className="scoring-note">Score = peer review 20 + direct mechanism 30 + human relevance 20 + replication 20 + full text 10.</small><div className="record-list">{records.length === 0 && <div className="empty-card">No literature imported yet.</div>}{records.map((record) => <article className="literature-card" key={record.id}><div className="record-heading"><span className="score-badge">{record.score}</span><input aria-label="Literature title" value={record.title} onChange={(e) => update(record.id, { title: e.target.value })}/><button aria-label="Delete literature" onClick={() => onChange(records.filter((item) => item.id !== record.id))}><Trash2 size={14}/></button></div><div className="record-meta"><span>{record.sourceType.toUpperCase()}</span><code>{record.identifier}</code>{safeHttpUrl(record.url) && <a href={safeHttpUrl(record.url)} target="_blank" rel="noreferrer"><Link2 size={13}/> source</a>}<span className={`metadata-status status-${record.metadataStatus ?? 'local'}`}>{record.metadataStatus ?? 'local'}</span></div>{(record.authors || record.year) && <p className="literature-byline">{record.authors}{record.authors && record.year ? ' · ' : ''}{record.year}</p>}{record.abstract && <p className="literature-abstract">{record.abstract}</p>}<button className="enrich-button" data-help="PMID/DOI/URL을 서버에서 조회해 제목·저자·연도·초록 같은 신뢰 메타데이터를 보완합니다. 내부 인용이나 백엔드 미연결 상태에서는 사용할 수 없습니다." disabled={!canEnrich || enrichingId === record.id || record.sourceType === 'internal'} onClick={() => onEnrich(record.id)}><RefreshCw size={13}/>{enrichingId === record.id ? ' Enriching…' : ' Enrich metadata'}</button><div className="appraisal-grid" data-help="해당되는 품질 조건을 체크하면 표시된 가중치가 합산되어 100점 만점 점수가 계산됩니다. 점수는 연결한 상호작용의 evidence.csv에도 반영됩니다.">{(Object.keys(appraisalLabels) as (keyof EvidenceAppraisal)[]).map((key) => <label key={key}><input type="checkbox" checked={record.appraisal[key]} onChange={(e) => update(record.id, { appraisal: { ...record.appraisal, [key]: e.target.checked } })}/>{appraisalLabels[key]} <small>+{appraisalWeights[key]}</small></label>)}</div><button className={attachedIds.includes(record.id) ? 'attach-button attached' : 'attach-button'} data-help="캔버스에서 상호작용 선을 먼저 선택한 뒤 누르면 이 문헌이 그 선의 근거로 연결됩니다. 한 문헌을 여러 상호작용에 연결할 수 있습니다." disabled={!selectedEdgeId || attachedIds.includes(record.id)} onClick={() => onAttach(record.id)}>{attachedIds.includes(record.id) ? 'Attached to selected interaction' : selectedEdgeId ? 'Attach to selected interaction' : 'Select an interaction to attach'}</button></article>)}</div></div></section></div>
}
