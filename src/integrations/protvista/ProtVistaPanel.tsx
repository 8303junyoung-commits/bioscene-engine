import { ExternalLink, Layers3, LoaderCircle, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DomainDefinition, MoleculeDefinition, UniProtFeatureRecord } from '../../types'
import { isUniProtAccession } from '../../uniprot'

type ViewerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'failed'
type NightingaleFeature = { accession?: string; type?: string; category?: string; description?: string; start?: number; end?: number; begin?: number; stop?: number }

interface Props {
  molecule: MoleculeDefinition
  onAddDomain: (domain: DomainDefinition) => void
}

const selectableTypes = new Set(['Domain', 'Topological domain', 'Transmembrane', 'Region', 'Repeat', 'Chain', 'Peptide'])
const featureKey = (feature: Pick<UniProtFeatureRecord, 'type'|'description'|'start'|'end'>) => `${feature.type}:${feature.start ?? 'x'}:${feature.end ?? 'x'}:${feature.description ?? ''}`
const domainKind = (feature: Pick<UniProtFeatureRecord, 'type'|'description'>): DomainDefinition['kind'] => {
  const value = `${feature.type} ${feature.description ?? ''}`.toLowerCase()
  if (value.includes('transmembrane')) return 'transmembrane'
  if (/cytoplas|intracellular/.test(value)) return 'intracellular'
  if (/extracellular|outside/.test(value)) return 'extracellular'
  return 'functional'
}

function normalizeEventFeature(value: NightingaleFeature | undefined): UniProtFeatureRecord | undefined {
  if (!value) return undefined
  const type = value.type || value.category || 'Selected feature'
  const start = Number(value.start ?? value.begin) || undefined
  const end = Number(value.end ?? value.stop) || start
  return { type, description: value.description || value.accession || type, start, end, source: 'UniProt' }
}

export function ProtVistaPanel({ molecule, onAddDomain }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ViewerStatus>('idle')
  const [selected, setSelected] = useState<UniProtFeatureRecord>()
  const [message, setMessage] = useState('')
  const accession = molecule.uniprotAccession
  const features = useMemo(() => (molecule.uniprotFeatures ?? []).filter((feature) => selectableTypes.has(feature.type)), [molecule.uniprotFeatures])

  useEffect(() => {
    if (!open || !accession || !hostRef.current) return
    const host = hostRef.current
    let cancelled = false
    let element: HTMLElement | undefined
    setStatus('loading')
    setMessage('ProtVista annotation tracks 불러오는 중…')
    void import('protvista-uniprot').then(() => {
      if (cancelled) return
      element = document.createElement('protvista-uniprot')
      element.setAttribute('accession', accession)
      element.setAttribute('nostructure', '')
      element.setAttribute('aria-label', `ProtVista annotation viewer for ${accession}`)
      const onReady = (event: Event) => {
        const detail = (event as CustomEvent<{ hasData?: boolean }>).detail
        setStatus(detail?.hasData ? 'ready' : 'empty')
        setMessage(detail?.hasData ? 'ProtVista tracks loaded' : 'ProtVista에서 표시 가능한 annotation이 없습니다.')
      }
      const onChange = (event: Event) => {
        const detail = (event as CustomEvent<{ eventType?: string; feature?: NightingaleFeature }>).detail
        if (detail?.eventType !== 'click') return
        const feature = normalizeEventFeature(detail.feature)
        if (feature) setSelected(feature)
      }
      element.addEventListener('protvista-event', onReady)
      element.addEventListener('change', onChange)
      host.replaceChildren(element)
      window.setTimeout(() => { if (!cancelled) { setStatus((current) => current === 'loading' ? 'ready' : current); setMessage((current) => current || 'ProtVista viewer loaded') } }, 2500)
    }).catch((error: unknown) => {
      if (cancelled) return
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'ProtVista를 불러오지 못했습니다.')
    })
    return () => { cancelled = true; element?.remove(); host.replaceChildren() }
  }, [accession, open])

  const addSelected = () => {
    if (!selected || !accession) return
    onAddDomain({
      id: `domain:${molecule.id}:protvista_${crypto.randomUUID().slice(0, 8)}`,
      label: selected.description || selected.type,
      kind: domainKind(selected),
      start: selected.start,
      end: selected.end,
      source: 'UniProt',
      confidence: 'high',
    })
    setMessage(`${selected.description || selected.type}을 BioScene domain으로 추가했습니다.`)
  }

  if (!accession || !isUniProtAccession(accession)) return <div className="protvista-placeholder">유효한 UniProt accession을 입력하거나 lookup을 완료하면 ProtVista annotation reference viewer를 사용할 수 있습니다.</div>

  return <div className="protvista-integration">
    <div className="protvista-heading">
      <div><strong><Layers3 size={14}/> ProtVista annotation reference</strong><small>외부 viewer의 선택은 BioScene domain으로 명시적으로 변환할 때만 저장됩니다.</small></div>
      <button onClick={() => setOpen((value) => !value)}>{open ? 'Close viewer' : 'Open viewer'}</button>
      <a href={`https://www.uniprot.org/uniprotkb/${encodeURIComponent(accession)}/entry`} target="_blank" rel="noreferrer">UniProt <ExternalLink size={11}/></a>
    </div>
    {open && <>
      <div className={`protvista-status status-${status}`}>{status === 'loading' && <LoaderCircle size={13}/>} {message}</div>
      <div className="protvista-host" ref={hostRef}/>
      <div className="protvista-feature-bridge">
        <div><b>Domain bridge</b><span>트랙 또는 아래 UniProt feature를 선택한 뒤 BioScene domain으로 추가하세요.</span></div>
        <select aria-label="Select UniProt feature" value={selected ? featureKey(selected) : ''} onChange={(event) => setSelected(features.find((feature) => featureKey(feature) === event.target.value))}>
          <option value="">Select feature…</option>
          {features.map((feature) => <option key={featureKey(feature)} value={featureKey(feature)}>{feature.type} · {feature.description || 'unnamed'} {feature.start && feature.end ? `(${feature.start}–${feature.end} aa)` : ''}</option>)}
        </select>
        <button disabled={!selected} onClick={addSelected}><Plus size={12}/> Add as BioScene domain</button>
      </div>
    </>}
  </div>
}

