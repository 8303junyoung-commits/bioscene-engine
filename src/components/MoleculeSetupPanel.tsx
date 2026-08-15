import { Database, LockKeyhole, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { biologicalFunctionVocabulary, createMolecule, defaultStructuralModel, portsFromDomains } from '../molecules'
import { lookupUniProt } from '../uniprot'
import type { DomainDefinition, MoleculeDefinition, StructuralTemplate } from '../types'
import { uid } from '../identity'
import { StructureGlyph } from './StructureGlyph'

interface Props {
  molecules: MoleculeDefinition[]
  customFunctions: string[]
  initialMoleculeId?: string
  canApply: boolean
  onChange: (items: MoleculeDefinition[]) => void
  onCustomFunctions: (items: string[]) => void
  onApply: (molecule: MoleculeDefinition) => void
  onClose: () => void
}

const templates: StructuralTemplate[] = ['globular','cytokine','enzyme','single_pass_receptor','multi_pass_receptor','gpcr','ion_channel','receptor_complex','igg','fab','fab2','bispecific_igg','asymmetric_bispecific','fc_fusion','receptor_trap','custom_construct']

export function MoleculeSetupPanel(props: Props) {
  const [bulk, setBulk] = useState('IL18\nIL18RA\nIL18RB\nIL4RA\nBispecific-X')
  const [selectedId, setSelectedId] = useState(props.initialMoleculeId ?? props.molecules[0]?.id)
  const [busyId, setBusyId] = useState<string>()
  const customFunctionTimer = useRef<number | undefined>(undefined)
  const selected = props.molecules.find((item) => item.id === selectedId)
  const vocabulary = useMemo(() => Array.from(new Set([...biologicalFunctionVocabulary, ...props.customFunctions])).sort(), [props.customFunctions])
  const update = (patch: Partial<MoleculeDefinition>) => selected && props.onChange(props.molecules.map((item) => item.id === selected.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item))
  const updateDomain = (domainId: string, patch: Partial<DomainDefinition>) => selected && update({ structuralModel: { ...selected.structuralModel, domains: selected.structuralModel.domains.map((domain) => domain.id === domainId ? { ...domain, ...patch } : domain) } })
  const addBulk = () => {
    const existing = new Set(props.molecules.map((item) => item.name.toLowerCase()))
    const additions = bulk.split(/[\n,;]+/).map((item) => item.trim()).filter((item) => item && !existing.has(item.toLowerCase())).map((name) => createMolecule(name, /^(slc[-_]|bispecific|construct|adc)/i.test(name) ? 'private' : 'public'))
    if (!additions.length) return
    props.onChange([...props.molecules, ...additions]); setSelectedId(additions[0].id)
  }
  const enrich = async (molecule: MoleculeDefinition) => {
    setBusyId(molecule.id)
    try { const enriched = await lookupUniProt(molecule); props.onChange(props.molecules.map((item) => item.id === molecule.id ? enriched : item)) }
    catch (error) { props.onChange(props.molecules.map((item) => item.id === molecule.id ? { ...item, lookupStatus: 'failed', lookupMessage: error instanceof Error ? error.message : 'Lookup failed' } : item)) }
    finally { setBusyId(undefined) }
  }
  const addCustomFunction = (value: string) => {
    window.clearTimeout(customFunctionTimer.current)
    customFunctionTimer.current = window.setTimeout(() => { const term = value.trim(); if (term && !vocabulary.includes(term)) props.onCustomFunctions([...props.customFunctions, term]) }, 500)
  }

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Protein and Construct Setup">
    <section className="molecule-setup-panel"><header><div><span className="eyebrow">MOLECULE BUILDER</span><h2>Protein &amp; Construct Setup</h2><p>Identity, structure, domains, functions, targets and ports are stored independently from the Scene view.</p></div><button className="icon-button" onClick={props.onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="molecule-workspace">
        <aside className="molecule-library"><label data-help="단백질·항체·construct 이름을 줄바꿈, 쉼표 또는 세미콜론으로 여러 개 붙여넣으세요. SLC/Custom construct는 기본적으로 Private로 생성되어 외부 조회되지 않습니다.">Protein / construct list<textarea rows={7} value={bulk} onChange={(event) => setBulk(event.target.value)}/></label><button className="wide-action" onClick={addBulk}><Plus size={15}/> Add to project library</button><h3>My Molecule Library</h3><div className="molecule-list">{props.molecules.map((item) => <button className={item.id === selectedId ? 'selected' : ''} key={item.id} onClick={() => setSelectedId(item.id)}><span>{item.privacy === 'private' ? <LockKeyhole size={13}/> : <Database size={13}/>}<strong>{item.name}</strong></span><small>{item.structuralModel.template.replaceAll('_',' ')} · {item.lookupStatus}</small></button>)}</div></aside>
        <main className="molecule-editor">{!selected ? <div className="empty-card">왼쪽에서 molecule을 추가하거나 선택하세요.</div> : <>
          <div className="molecule-identity"><div className="molecule-preview"><StructureGlyph data={{ kind: selected.moleculeClass === 'antibody' || selected.structuralModel.template.includes('igg') ? 'antibody' : selected.structuralModel.template.includes('receptor') ? 'receptor' : 'ligand', label: selected.name, compartment: 'extracellular', domains: selected.structuralModel.domains, sites: [], ports: [], anchors: [], states: [], allowedCompartments: ['extracellular'], structuralModel: selected.structuralModel }}/></div><div><h3>{selected.name}</h3><p>{selected.proteinName ?? 'User-defined biological entity'}</p><span className={`lookup-status status-${selected.lookupStatus}`}>{selected.lookupMessage ?? 'Structure is an editable suggestion'}</span></div>{selected.privacy === 'public' ? <button data-help="이름 또는 accession을 공식 UniProt REST API에 전송해 reviewed human entry의 topology와 feature annotation을 가져옵니다. 가져온 domain은 UniProt provenance로 표시되며 수정 가능합니다." onClick={() => enrich(selected)} disabled={busyId === selected.id}><RefreshCw size={14}/>{busyId === selected.id ? ' Looking up…' : ' UniProt lookup'}</button> : <span className="private-badge"><ShieldCheck size={14}/> No external lookup</span>}</div>
          <div className="identity-fields"><label>Name<input value={selected.name} onChange={(event) => update({ name: event.target.value })}/></label><label>Privacy<select value={selected.privacy} onChange={(event) => update({ privacy: event.target.value as 'public'|'private', lookupStatus: event.target.value === 'private' ? 'local' : 'suggested' })}><option value="public">Public biological entity</option><option value="private">Private construct</option></select></label><label>Class<select value={selected.moleculeClass} onChange={(event) => { const moleculeClass = event.target.value as MoleculeDefinition['moleculeClass']; update({ moleculeClass, structuralModel: defaultStructuralModel(selected.id,selected.name,moleculeClass) }) }}><option value="protein">Protein</option><option value="antibody">Antibody</option><option value="engineered_construct">Engineered construct</option></select></label><label>Visual template<select value={selected.structuralModel.template} onChange={(event) => update({ structuralModel: { ...selected.structuralModel, template: event.target.value as StructuralTemplate, templateSource: 'user', templateConfidence: 'confirmed' } })}>{templates.map((item) => <option key={item} value={item}>{item.replaceAll('_',' ')}</option>)}</select></label><label>UniProt accession<input value={selected.uniprotAccession ?? ''} onChange={(event) => update({ uniprotAccession: event.target.value })} disabled={selected.privacy === 'private'}/></label><label>Species<input value={selected.species ?? ''} readOnly placeholder="Imported from UniProt"/></label></div>
          <div className="topology-row"><span>Topology</span>{(['extracellular','transmembrane','cytoplasmic'] as const).map((key) => <label key={key}><input type="checkbox" checked={selected.structuralModel.topology[key]} onChange={(event) => update({ structuralModel: { ...selected.structuralModel, topology: { ...selected.structuralModel.topology, [key]: event.target.checked } } })}/>{key}</label>)}</div>
          <section className="domain-builder"><div className="domain-heading"><div><h3>Functional domains</h3><small>Function을 지정하면 compatible interaction port가 자동 생성됩니다.</small></div><button onClick={() => update({ structuralModel: { ...selected.structuralModel, domains: [...selected.structuralModel.domains, { id: `domain:${selected.id}:${uid('custom')}`, label: 'New domain', kind: 'functional', source: 'user', confidence: 'confirmed' }] } })}><Plus size={14}/> Domain</button></div><datalist id="function-vocabulary">{vocabulary.map((item) => <option key={item} value={item}/>)}</datalist><div className="domain-list">{selected.structuralModel.domains.map((domain) => <article key={domain.id}><div className="domain-id"><code>{domain.id}</code><span>{domain.source ?? 'user'} · {domain.confidence ?? 'confirmed'}</span></div><label>Name<input value={domain.label} onChange={(event) => updateDomain(domain.id,{ label:event.target.value, source:'user', confidence:'confirmed' })}/></label><label>Region<select value={domain.kind} onChange={(event) => updateDomain(domain.id,{ kind:event.target.value as DomainDefinition['kind'], source:'user' })}><option value="extracellular">Extracellular</option><option value="transmembrane">Transmembrane</option><option value="intracellular">Cytoplasmic</option><option value="variable">Variable / Fab</option><option value="constant">Constant / Fc</option><option value="functional">Functional</option></select></label><label>Function<input list="function-vocabulary" value={domain.function ?? ''} onChange={(event) => { updateDomain(domain.id,{ function:event.target.value, functionSource:'user' }); addCustomFunction(event.target.value) }}/></label><label>Target<input list="molecule-targets" value={domain.target ?? ''} onChange={(event) => updateDomain(domain.id,{ target:event.target.value, targetSource:'user' })}/></label><label>Highlight<input type="checkbox" checked={!!domain.highlighted} onChange={(event) => updateDomain(domain.id,{ highlighted:event.target.checked })}/></label><button className="icon-button" aria-label={`Delete ${domain.label}`} onClick={() => update({ structuralModel: { ...selected.structuralModel, domains: selected.structuralModel.domains.filter((item) => item.id !== domain.id) } })}><Trash2 size={14}/></button></article>)}</div><datalist id="molecule-targets">{props.molecules.filter((item) => item.id !== selected.id).map((item) => <option key={item.id} value={item.name}/>)}</datalist></section>
          <div className="port-preview"><strong>Auto-generated ports</strong>{portsFromDomains(selected).length ? portsFromDomains(selected).map((port) => <code key={port.id}>{port.id} → {port.allowedInteractions.join('/')}{port.targetHint ? ` · ${port.targetHint}` : ''}</code>) : <small>Domain function을 입력하면 port가 생성됩니다.</small>}</div>
          <footer><button className="primary-button" disabled={!props.canApply} data-help="현재 선택한 캔버스 object에 이 molecule의 structure, domains, functions와 자동 port를 연결합니다. Scene scope가 바뀌어도 structure는 project library에 유지됩니다." onClick={() => props.onApply(selected)}><Save size={15}/> Apply structure to selected canvas object</button></footer>
        </>}</main>
      </div>
    </section>
  </div>
}
