import type { BioNodeData, StructuralTemplate } from '../types'

const inferredTemplate = (data: BioNodeData): StructuralTemplate => data.kind === 'receptor' ? 'single_pass_receptor' : data.kind === 'antibody' ? 'igg' : data.kind === 'ligand' ? 'cytokine' : 'globular'
const confidenceColor = (value:number) => value >= 90 ? '#2458d3' : value >= 70 ? '#20a7db' : value >= 50 ? '#f0c928' : '#ed6a35'
const antibodyColors = ['#7753a5','#d4773c','#278ea3','#b44d78','#4e9361']

function FabGlyph({color,label}:{color:string;label:string}) {
  return <svg className="structure-glyph antibody-structure fab-structure" viewBox="0 0 72 64" aria-label={label}>
    <path className="antibody-heavy-chain" d="M27 53C29 43 31 34 36 25L43 12"/><path className="antibody-light-chain" d="M38 49C39 39 43 29 48 21L53 13"/>
    <rect className="antibody-variable-domain" style={{fill:color}} x="38" y="6" width="22" height="10" rx="5" transform="rotate(-43 49 11)"/><path className="antibody-domain-seam" d="M33 39l10 5M38 29l10 5"/><text className="antibody-label" x="7" y="59">Fab</text>
  </svg>
}

function IgGGlyph({leftColor,rightColor,withFc=true,label,showLabels=false,extraColors=[],leftOpacity=1,rightOpacity=1,fcOpacity=1}:{leftColor:string;rightColor:string;withFc?:boolean;label:string;showLabels?:boolean;extraColors?:string[];leftOpacity?:number;rightOpacity?:number;fcOpacity?:number}) {
  return <svg className="structure-glyph antibody-structure igg-structure" viewBox="0 0 72 64" aria-label={label}>
    <g style={{opacity:leftOpacity}}><path className="antibody-heavy-chain" d="M34 38C29 34 24 27 17 17"/><path className="antibody-light-chain" d="M29 34C24 29 19 22 13 15"/><rect className="antibody-variable-domain" style={{fill:leftColor}} x="6" y="7" width="18" height="10" rx="5" transform="rotate(-43 15 12)"/><path className="antibody-domain-seam" d="M21 23l8-6M27 31l7-5"/></g>
    <g style={{opacity:rightOpacity}}><path className="antibody-heavy-chain" d="M38 38C43 34 48 27 55 17"/><path className="antibody-light-chain" d="M43 34C48 29 53 22 59 15"/><rect className="antibody-variable-domain" style={{fill:rightColor}} x="48" y="7" width="18" height="10" rx="5" transform="rotate(43 57 12)"/><path className="antibody-domain-seam" d="M51 23l-8-6M45 31l-7-5"/></g>
    <g className="antibody-hinge"><circle cx="34" cy="38" r="2"/><circle cx="38" cy="38" r="2"/><path d="M34 38h4"/></g>
    {withFc&&<g style={{opacity:fcOpacity}}><path className="antibody-fc-chain" d="M34 40C33 47 31 53 30 60M38 40C39 47 41 53 42 60"/><path className="antibody-fc-seam" d="M31.5 49h9M30.5 56h11"/></g>}
    {!withFc&&<path className="antibody-fab2-tail" d="M32 41q4 4 8 0"/>}{extraColors.slice(0,4).map((color,index)=><circle key={`${color}-${index}`} className="antibody-extra-unit" style={{fill:color}} cx={28+index%2*16} cy={17+Math.floor(index/2)*8} r="3.5"/>)}
    {showLabels&&<><text className="antibody-label" x="3" y="7">Fab</text><text className="antibody-label" x="58" y="7">Fab</text>{withFc&&<text className="antibody-label" x="46" y="60">Fc</text>}</>}
  </svg>
}

export function StructureGlyph({ data }: { data: BioNodeData }) {
  const model = data.structuralModel
  const template = model?.template ?? inferredTemplate(data)
  const domains = model?.domains ?? data.domains
  const highlighted = new Set(domains.filter((domain) => domain.highlighted).map((domain) => domain.id))
  const opacity = (id?: string) => highlighted.size && (!id || !highlighted.has(id)) ? .28 : 1
  const architecture = model?.architecture
  if (architecture?.kind === 'antibody') {
    const units = architecture.components.filter((item) => item.type === 'binding_unit').slice(0,8)
    const unitColors=units.map((unit)=>antibodyColors[Math.max(0,architecture.specificities.findIndex((item)=>item.id===unit.specificityId))%antibodyColors.length])
    const label=`${architecture.antibodyFormat ?? 'custom'} antibody architecture`
    if (units.length<=1&&!architecture.fc) return <FabGlyph color={unitColors[0]??antibodyColors[0]} label={label}/>
    return <IgGGlyph leftColor={unitColors[0]??antibodyColors[0]} rightColor={unitColors[1]??unitColors[0]??antibodyColors[0]} withFc={architecture.fc} label={label} showLabels={model?.displayLevel==='full'} extraColors={unitColors.slice(2)}/>
  }
  if (template === 'fab') return <FabGlyph color={antibodyColors[0]} label="Fab structural representation"/>
  if (['igg','bispecific_igg','asymmetric_bispecific','fab2'].includes(template)) {
    const left = domains.find((domain) => /fab.?1/i.test(domain.label)); const right = domains.find((domain) => /fab.?2/i.test(domain.label)); const fc = domains.find((domain) => /^fc$/i.test(domain.label)); const bispecific = template !== 'igg'
    return <IgGGlyph leftColor={antibodyColors[0]} rightColor={bispecific?antibodyColors[1]:antibodyColors[0]} withFc={template!=='fab2'} label={`${template} structural representation`} showLabels={model?.displayLevel==='full'} leftOpacity={opacity(left?.id)} rightOpacity={opacity(right?.id)} fcOpacity={opacity(fc?.id)}/>
  }
  const trace=model?.structureTrace
  if (model?.displayLevel === 'full' && trace?.points && trace.points.length>1) return <svg className="structure-glyph protein-structure-trace" viewBox="0 0 72 64" role="img" aria-label={`${data.label} actual AlphaFold structure, mean confidence ${Math.round(trace.meanConfidence??0)} pLDDT`}><title>{`${data.label} · ${trace.source} ${trace.modelId} · mean ${Math.round(trace.meanConfidence??0)} pLDDT`}</title><g className="protein-trace-shadow">{trace.points.slice(1).map((point,index)=><line key={`shadow-${index}`} x1={trace.points[index][0]} y1={trace.points[index][1]} x2={point[0]} y2={point[1]}/>)}</g><g>{trace.points.slice(1).map((point,index)=><line key={index} className="protein-trace-segment" style={{stroke:confidenceColor((trace.points[index][2]+point[2])/2)}} x1={trace.points[index][0]} y1={trace.points[index][1]} x2={point[0]} y2={point[1]}/>)}</g><text className="structure-source-badge" x="69" y="61" textAnchor="end">AF</text></svg>

  const membrane = data.membraneAnchor ? null : <><path className="membrane-line" d="M4 38h64"/><path className="membrane-line" d="M4 43h64"/></>
  if (template === 'single_pass_receptor' || template === 'receptor_complex') {
    const extracellular = domains.filter((domain) => domain.kind === 'extracellular' || domain.kind === 'functional'); const tm = domains.find((domain) => domain.kind === 'transmembrane'); const intracellular = domains.find((domain) => domain.kind === 'intracellular'); const chains = template === 'receptor_complex' ? [27,45] : [36]
    return <svg className="structure-glyph receptor-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}>{membrane}{chains.map((x,chainIndex)=><g key={x}><rect className="domain-tm" style={{opacity:opacity(tm?.id)}} x={x-3.5} y="34" width="7" height="14" rx="3"/>{(extracellular.length ? extracellular : [{id:'fallback'}]).slice(0,3).map((domain,index) => <rect key={`${domain.id}-${chainIndex}`} className="domain-ecd" style={{opacity:opacity(domain.id)}} x={x-(9-index)} y={27-index*9} width={(9-index)*2} height="8" rx="4"/>)}<path className="domain-icd" style={{opacity:opacity(intracellular?.id)}} d={`M${x} 48v12m0-7 ${chainIndex ? 7 : -7} 6`}/></g>)}{template === 'receptor_complex' && <path className="receptor-complex-link" d="M30 27q6 5 12 0"/>}{model?.displayLevel === 'full' && <><text x="50" y="16">ECD</text><text x="45" y="46">TM</text><text x="42" y="61">ICD</text></>}</svg>
  }
  if (template === 'multi_pass_receptor' || template === 'gpcr' || template === 'ion_channel') {
    const count=template==='gpcr'?7:template==='ion_channel'?4:5; const xs=Array.from({length:count},(_,index)=>16+index*(40/Math.max(1,count-1)))
    return <svg className={`structure-glyph receptor-structure ${template}`} viewBox="0 0 72 64" aria-label={`${template} structural representation`}>{membrane}{xs.map((x,index)=><rect key={x} className="domain-tm helix" x={x-2.7} y={index%2?31:34} width="5.4" height="18" rx="2.7"/>)}<path className="multipass-loop extracellular-loop" d={xs.slice(1).map((x,index)=>`M${xs[index]} ${index%2?34:31}Q${(xs[index]+x)/2} ${index%2?24:28} ${x} ${index%2?31:34}`).join(' ')}/><path className="multipass-loop intracellular-loop" d={xs.slice(1).map((x,index)=>`M${xs[index]} ${index%2?49:52}Q${(xs[index]+x)/2} ${index%2?58:55} ${x} ${index%2?52:49}`).join(' ')}/>{template==='ion_channel'&&<path className="ion-pore" d="M32 31v22M40 31v22"/>}{model?.displayLevel==='full'&&<text x="36" y="12" textAnchor="middle">{template==='gpcr'?'7TM':template==='ion_channel'?'PORE':'MULTI-PASS'}</text>}</svg>
  }
  if (data.kind === 'receptor' && !model?.topology.transmembrane) return <svg className="structure-glyph peripheral-membrane-structure" viewBox="0 0 72 64" aria-label="membrane-associated protein structural representation">{membrane}<path className="peripheral-anchor" d="M36 36v5"/><path className="protein-blob" d="M18 28c-4-9 5-18 13-14 6-8 19-3 18 6 10 1 12 14 3 19-6 7-18 6-22 1-8 3-16-5-12-12Z"/></svg>
  if (template === 'fc_fusion' || template === 'receptor_trap') return <svg className="structure-glyph fusion-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}><rect className="fusion-binding-domain" x="8" y="7" width="20" height="12" rx="6"/><rect className="fusion-binding-domain" x="44" y="7" width="20" height="12" rx="6"/><path className="fusion-linker" d="M18 19l15 19M54 19L39 38"/><path className="fusion-fc" d="M33 38v22M39 38v22M32 49h8"/></svg>
  if (template === 'custom_construct') return <svg className="structure-glyph construct-structure" viewBox="0 0 72 64" aria-label="custom construct structural representation">{domains.slice(0,4).map((domain,index)=><g key={domain.id}><rect className={`construct-domain construct-${domain.kind}`} x={6+index*16} y={18+(index%2)*12} width="14" height="20" rx="5"/>{index<domains.slice(0,4).length-1&&<path className="construct-linker" d={`M${20+index*16} ${28+(index%2)*12}h2`}/>}</g>)}</svg>
  if (template === 'cytokine') return <svg className="structure-glyph cytokine-structure" viewBox="0 0 72 64" aria-label="cytokine structural representation"><path className="cytokine-lobe" d="M11 33c0-10 10-17 19-12 4-10 20-8 23 2 13 0 15 18 5 23-8 10-21 5-24-1-10 9-23 1-23-12Z"/><path className="protein-fold" d="M20 31c6-8 13 8 20 0s14 3 9 10"/></svg>
  if (template === 'enzyme') return <svg className="structure-glyph enzyme-structure" viewBox="0 0 72 64" aria-label="enzyme structural representation"><path className="protein-blob" d="M12 34c-4-15 11-25 23-17 10-10 28 1 24 15 9 12-5 25-17 19-12 11-31-2-30-17Z"/><path className="enzyme-cleft" d="M39 14c-8 8-9 17 1 22 8 4 8 12 2 18"/></svg>
  return <svg className="structure-glyph soluble-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}><path className="protein-blob" d="M17 33c-6-9 2-20 12-17 6-10 21-4 20 6 12 1 14 17 4 22-5 11-20 9-24 3-11 4-19-5-12-14Z"/><path className="protein-fold" d="M21 32c7-9 15 11 23 0s15 4 8 10M28 20c2 7 10 8 15 3"/>{model?.displayLevel === 'full' && <text x="24" y="58">{template}</text>}</svg>
}

