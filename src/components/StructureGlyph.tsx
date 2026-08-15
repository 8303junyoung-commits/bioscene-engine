import type { BioNodeData, StructuralTemplate } from '../types'

const inferredTemplate = (data: BioNodeData): StructuralTemplate => data.kind === 'receptor' ? 'single_pass_receptor' : data.kind === 'antibody' ? 'igg' : data.kind === 'ligand' ? 'cytokine' : 'globular'

export function StructureGlyph({ data }: { data: BioNodeData }) {
  const model = data.structuralModel
  const template = model?.template ?? inferredTemplate(data)
  const domains = model?.domains ?? data.domains
  const highlighted = new Set(domains.filter((domain) => domain.highlighted).map((domain) => domain.id))
  const opacity = (id?: string) => highlighted.size && (!id || !highlighted.has(id)) ? .28 : 1
  if (['igg','bispecific_igg','asymmetric_bispecific','fab2'].includes(template)) {
    const left = domains.find((domain) => /fab.?1/i.test(domain.label))
    const right = domains.find((domain) => /fab.?2/i.test(domain.label))
    const fc = domains.find((domain) => /^fc$/i.test(domain.label))
    const bispecific = template !== 'igg'
    return <svg className="structure-glyph antibody-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}>
      <path className="structure-backbone" d="M36 56V34M36 36 17 15M36 36 55 15"/>
      <path className="domain-arm arm-one" style={{opacity:opacity(left?.id)}} d="M12 19 20 11M52 11l8 8"/>
      <circle className="domain-tip tip-one" style={{opacity:opacity(left?.id)}} cx="12" cy="19" r="5"/><circle className={`domain-tip ${bispecific ? 'tip-two' : 'tip-one'}`} style={{opacity:opacity(right?.id)}} cx="60" cy="19" r="5"/>
      <rect className="domain-fc" style={{opacity:opacity(fc?.id)}} x="29" y="48" width="14" height="11" rx="5"/>
      {model?.displayLevel !== 'hidden' && <><text x="4" y="9">Fab1</text><text x="49" y="9">Fab2</text><text x="45" y="59">Fc</text></>}
    </svg>
  }
  if (template === 'single_pass_receptor' || template === 'multi_pass_receptor' || template === 'gpcr' || template === 'ion_channel') {
    const extracellular = domains.filter((domain) => domain.kind === 'extracellular' || domain.kind === 'functional')
    const tm = domains.find((domain) => domain.kind === 'transmembrane')
    const intracellular = domains.find((domain) => domain.kind === 'intracellular')
    return <svg className="structure-glyph receptor-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}>
      <path className="membrane-line" d="M4 38h64M4 43h64"/>
      <rect className="domain-tm" style={{opacity:opacity(tm?.id)}} x="31" y="34" width="10" height="14" rx="3"/>
      {(extracellular.length ? extracellular : [{id:'fallback'}]).slice(0,3).map((domain,index) => <ellipse key={domain.id} className="domain-ecd" style={{opacity:opacity(domain.id)}} cx="36" cy={28-index*10} rx={12-index*2} ry="6"/>)}
      <path className="domain-icd" style={{opacity:opacity(intracellular?.id)}} d="M36 48v12m0-7 10 6m-10-3-8 5"/>
      {model?.displayLevel === 'full' && <><text x="50" y="16">ECD</text><text x="45" y="46">TM</text><text x="42" y="61">ICD</text></>}
    </svg>
  }
  return <svg className="structure-glyph soluble-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}>
    <path className="protein-blob" d="M17 33c-6-9 2-20 12-17 6-10 21-4 20 6 12 1 14 17 4 22-5 11-20 9-24 3-11 4-19-5-12-14Z"/>
    <path className="protein-fold" d="M21 32c7-9 15 11 23 0s15 4 8 10M28 20c2 7 10 8 15 3"/>
    {model?.displayLevel === 'full' && <text x="24" y="58">{template}</text>}
  </svg>
}
