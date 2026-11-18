import { useState } from 'react'
import type { AntibodyFormat, BioEdge, BioNode, MoleculeDefinition } from '../types'
import { cellChoices, counts, densityCounts, makeDrug, normalizeName, proteinPresets, type CellDraft, type Density, type SimpleRelation } from '../simpleMoa'
import { createMolecule } from '../molecules'
import { importUniProtEntry, lookupUniProt, uniProtSpeciesOptions, type UniProtCandidate, type UniProtSpecies } from '../uniprot'

export function CountPicker({ value, density, onChange }:{value:number;density?:Density;onChange:(count:number,density?:Density)=>void}) {
  return <div className="count-picker" aria-label="Visual Representation Count">{counts.map(n=><button key={n} aria-label={`Count ${n}`} aria-pressed={!density&&n===value} onClick={()=>onChange(n)}>{n}</button>)}<select aria-label="Density" value={density??''} onChange={e=>{const d=e.target.value as Density;if(d)onChange(densityCounts[d],d)}}><option value="">Density</option>{Object.keys(densityCounts).map(d=><option key={d}>{d}</option>)}</select></div>
}

export function SimpleMoaPanel({ panel, library, nodes, onGenerate, onDrug, onAdvanced, onCancel }:{panel:'cell'|'drug';library:MoleculeDefinition[];nodes:BioNode[];onGenerate:(drafts:CellDraft[])=>void;onDrug:(m:MoleculeDefinition)=>void;onAdvanced:()=>void;onCancel:()=>void}) {
  const [drafts,setDrafts]=useState<CellDraft[]>([])
  const [active,setActive]=useState(-1)
  const [query,setQuery]=useState('')
  const [custom,setCustom]=useState(false)
  const [cellName,setCellName]=useState('')
  const [quick,setQuick]=useState(false)
  const [species,setSpecies]=useState<UniProtSpecies>('9606')
  const [candidate,setCandidate]=useState<MoleculeDefinition>()
  const [candidates,setCandidates]=useState<UniProtCandidate[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [format,setFormat]=useState<AntibodyFormat|'ligand'>('igg')
  const [name,setName]=useState('')
  const [targets,setTargets]=useState(['','',''])
  const [valency,setValency]=useState('1+1')
  const proteins=[...library.filter(m=>m.saveStatus==='saved'&&m.entityClass!=='antibody'),...proteinPresets].filter((m,i,a)=>a.findIndex(t=>normalizeName(t.name)===normalizeName(m.name))===i)
  const chooseCell=(name:string)=>{setDrafts([...drafts,{key:crypto.randomUUID(),name,proteins:[]}]);setActive(drafts.length);setQuery('');setCustom(false)}
  const addProtein=(molecule:MoleculeDefinition)=>{setDrafts(items=>items.map((d,i)=>i!==active?d:{...d,proteins:d.proteins.some(p=>p.molecule.id===molecule.id)?d.proteins:[...d.proteins,{molecule,count:1}]}));setQuick(false);setCandidate(undefined);setQuery('')}
  const lookup=async(accession?:string)=>{setBusy(true);setMessage('Looking up natural protein…');setCandidate(undefined);try{const m={...createMolecule(query,'public'),origin:'natural' as const};const result=accession?{molecule:await importUniProtEntry(m,accession),candidates:[]}:await lookupUniProt(m,species);setCandidate(result.molecule);setCandidates(result.candidates);setMessage(result.molecule?'Suggested: '+result.molecule.suggestedTopology?.replaceAll('_',' '):result.candidates.length?'Choose the matching protein.':'No match. Refine the name or use Advanced Setup.')}catch(e){setMessage(e instanceof Error?e.message:'Lookup failed')}finally{setBusy(false)}}
  const receptorNames=[...new Set(nodes.filter(n=>n.data.kind==='receptor').map(n=>n.data.label))]
  return <aside className="simple-panel"><header><h2>{panel==='cell'?'Build a MoA':'Add Drug / Ligand'}</h2><button aria-label="Close builder" onClick={onCancel}>×</button></header>
    {panel==='cell'?<>
      <p className="simple-step">{active<0?'1 · Choose Cell':'2 · Proteins + Count'}</p>
      {drafts.length>0&&<div className="simple-chips">{drafts.map((d,i)=><button key={d.key} aria-pressed={i===active} onClick={()=>{setActive(i);setQuery('')}}>{d.name}</button>)}<button onClick={()=>{setActive(-1);setQuery('')}}>+ Add cell</button></div>}
      <input aria-label={active<0?'Search cells':'Search proteins'} placeholder={active<0?'Search cells…':'Search proteins…'} value={query} onChange={e=>{setQuery(e.target.value);setCandidate(undefined);setCandidates([])}}/>
      {active<0?<><div className="simple-options">{cellChoices.filter(c=>c.toLowerCase().includes(query.toLowerCase())).map(c=><button key={c} onClick={()=>chooseCell(c)}>{c}</button>)}</div><button onClick={()=>setCustom(true)}>Custom Cell</button>{custom&&<form onSubmit={e=>{e.preventDefault();if(cellName.trim())chooseCell(cellName.trim())}}><input aria-label="Custom cell name" value={cellName} onChange={e=>setCellName(e.target.value)}/><button disabled={!cellName.trim()}>Use cell</button></form>}</>:<>
        <div className="simple-options protein-options">{proteins.filter(m=>normalizeName(m.name+' '+m.geneName).includes(normalizeName(query))).map(m=><button key={m.id} disabled={drafts[active].proteins.some(p=>p.molecule.id===m.id)} onClick={()=>addProtein(m)}>{m.name}</button>)}</div>
        <small>Built-in proteins are schematic presets. Tumor antigen is a generic placeholder. Saved definitions take priority.</small>
        {query&&<section className="quick-setup"><p>{query} is not configured yet.</p><button onClick={()=>setQuick(true)}>Quick Setup</button><button onClick={onAdvanced}>Advanced Setup</button><button onClick={()=>{setQuery('');setQuick(false)}}>Cancel</button>{quick&&<><small>Natural proteins only. Lookup sends name and species to UniProt through the existing service. Use Advanced Setup for private constructs.</small><label>Species<select aria-label="Species" value={species} onChange={e=>setSpecies(e.target.value as UniProtSpecies)}>{uniProtSpeciesOptions.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><button disabled={busy} onClick={()=>lookup()}>Lookup</button><p role="status">{message}</p>{candidates.map(c=><button key={c.accession} disabled={busy} onClick={()=>lookup(c.accession)}>{c.accession} · {c.geneName}</button>)}{candidate&&<button disabled={!candidate.suggestedTopology||candidate.suggestedTopology==='unknown'} onClick={()=>addProtein({...candidate,entityClass:candidate.suggestedEntityClass??'natural_protein',topology:candidate.suggestedTopology!,topologyConfirmed:true,saveStatus:'saved'})}>Accept</button>}</>}</section>}
        {drafts[active].proteins.map(p=><section className="protein-count" key={p.molecule.id} aria-label={`${p.molecule.name} representation`}><header><strong>{p.molecule.name}</strong><button aria-label={`Remove ${p.molecule.name}`} onClick={()=>setDrafts(ds=>ds.map((d,i)=>i===active?{...d,proteins:d.proteins.filter(v=>v!==p)}:d))}>×</button></header><CountPicker value={p.count} density={p.density} onChange={(count,density)=>setDrafts(ds=>ds.map((d,i)=>i===active?{...d,proteins:d.proteins.map(v=>v===p?{...v,count,density}:v)}:d))}/></section>)}
        <p className="simple-note">Visual Representation Count — schematic display only, not biological copy number.</p>
      </>}
      {drafts.length>0&&<button className="primary-button simple-generate" onClick={()=>onGenerate(drafts)}>Generate</button>}
    </>:<>
      <p>Quick choices based on your scene. Connections are always your choice.</p>
      <div className="simple-options">{receptorNames.map(target=><button key={target} onClick={()=>onDrug(makeDrug(`anti-${target}`,'igg',[target]))}>anti-{target}</button>)}{receptorNames.some(n=>n.startsWith('IL18'))&&<button onClick={()=>onDrug(makeDrug('IL-18','ligand',[]))}>IL-18</button>}{receptorNames.length>=2&&<button onClick={()=>onDrug(makeDrug(`${receptorNames[0]} × ${receptorNames[1]}`,'bispecific',receptorNames.slice(0,2),'1+1'))}>Bispecific 1+1 · {receptorNames.slice(0,2).join(' / ')}</button>}</div>
      <label>Antibody Type<select aria-label="Antibody Type" value={format} onChange={e=>setFormat(e.target.value as typeof format)}>{Object.entries({igg:'IgG',fab:'Fab',scfv:'scFv',bispecific:'Bispecific',trispecific:'Trispecific',custom_antibody:'Custom',ligand:'Cytokine / Ligand'}).map(([f,label])=><option key={f} value={f}>{label}</option>)}</select></label>
      <label>Name<input aria-label="Drug name" value={name} onChange={e=>setName(e.target.value)}/></label>
      {format!=='ligand'&&targets.slice(0,format==='trispecific'?3:format==='bispecific'?2:1).map((t,i)=><label key={i}>Target {format==='bispecific'||format==='trispecific'?String.fromCharCode(65+i):''}<input aria-label={`Target ${String.fromCharCode(65+i)}`} list="simple-targets" value={t} onChange={e=>setTargets(ts=>ts.map((v,j)=>j===i?e.target.value:v))}/></label>)}<datalist id="simple-targets">{receptorNames.map(n=><option key={n}>{n}</option>)}</datalist>
      {format==='bispecific'&&<label>Valency<div className="simple-chips">{['1+1','2+1','1+2','2+2'].map(v=><button key={v} aria-pressed={v===valency} onClick={()=>setValency(v)}>{v}</button>)}</div></label>}
      <button className="primary-button" disabled={!name.trim()||(format!=='ligand'&&targets.slice(0,format==='trispecific'?3:format==='bispecific'?2:1).some(t=>!t.trim()))} onClick={()=>onDrug(makeDrug(name.trim(),format,targets,valency))}>Add to scene</button><button onClick={onAdvanced}>Advanced Structure</button>
    </>}
  </aside>
}

export function SimpleInspector({ nodes, edges, selected, edge, onSelect, onChange, onCount, onDelete, onConnect }:{nodes:BioNode[];edges:BioEdge[];selected?:BioNode;edge?:BioEdge;onSelect:(id:string)=>void;onChange:(patch:{label?:string;showName?:boolean})=>void;onCount:(n:number,d?:Density)=>void;onDelete:()=>void;onConnect:(source:string,targets:string[],r:SimpleRelation)=>void}) {
  const architecture=selected?.data.structuralModel?.architecture
  const moleculeTargets=architecture?.specificities.map(s=>normalizeName(s.target))??[]
  const targets=moleculeTargets.map(t=>nodes.find(n=>n.id!==selected?.id&&normalizeName(n.data.label)===t)).filter((n):n is BioNode=>!!n)
  const list=selected?.data.kind==='cell'?nodes.filter(n=>n.parentId===selected.id):nodes.filter(n=>n.data.kind==='cell')
  return <aside className="simple-inspector"><h2>{selected?.data.kind==='cell'?'Cell':selected?'Molecule':edge?'Relationship':'MoA Summary'}</h2>{selected?<><label>Name<input aria-label="Object name" value={selected.data.label} onChange={e=>onChange({label:e.target.value})}/></label><label className="simple-check"><input type="checkbox" checked={selected.data.showName!==false} onChange={e=>onChange({showName:e.target.checked})}/>Label</label>{selected.data.kind==='receptor'&&<><p>Visual Representation Count</p><CountPicker value={selected.data.visualRepresentation?.count??1} density={selected.data.visualRepresentation?.density} onChange={onCount}/><small>Not biological copy number.</small></>}{selected.data.kind==='antibody'&&<><p>Basic type: {architecture?.antibodyFormat??'Antibody'}</p><p>Target: {architecture?.specificities.map(s=>s.target).join(' / ')||'Not set'}</p></>}{targets.length>0&&<section className="smart-target"><p>Connect to {targets.map(t=>t.data.label).join(' / ')}?</p><button onClick={()=>onConnect(selected.id,targets.map(t=>t.id),'Bind')}>{targets.length>1?'Bind both targets':'Bind target'}</button><button onClick={()=>onConnect(selected.id,targets.map(t=>t.id),'Block')}>Show blockade</button></section>}<button className="danger" onClick={onDelete}>Delete selected</button></>:edge?<><p>{edge.data?.indirect?'Indirect':edge.data?.interaction}</p><button className="danger" onClick={onDelete}>Delete selected</button></>:<p>{nodes.filter(n=>n.data.kind==='cell').length} cells · {nodes.filter(n=>!['cell','annotation','membrane'].includes(n.data.kind)).length} molecules · {edges.length} relationships</p>}
    <h3>{selected?.data.kind==='cell'?'Proteins':'Cells'}</h3><div className="summary-list">{list.map(n=><button key={n.id} onClick={()=>onSelect(n.id)}>{n.data.label}</button>)}</div>
  </aside>
}
