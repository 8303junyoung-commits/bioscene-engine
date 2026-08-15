import type { BioNode, DomainDefinition, FunctionalPortType, InteractionType, MoleculeClass, MoleculeDefinition, PortDefinition, StructuralModel, StructuralTemplate } from './types'

export const biologicalFunctionVocabulary = [
  'Binding','Recruitment','Activation','Agonism','Antagonism','Blockade','Neutralization','Clustering','Dimerization','Oligomerization','Cleavage','Proteolysis','Phosphorylation','Dephosphorylation','Enzymatic activity','Transport','Translocation','Internalization','Trafficking','Secretion','Anchoring','Scaffolding','Adaptor recruitment','Signal initiation','Signal propagation','Transcriptional regulation','Degradation','Payload delivery','Fc receptor binding','Complement engagement',
]

const functionGrammar: Record<string, { port: FunctionalPortType; interactions: InteractionType[]; semantic: PortDefinition['semantic'] }> = {
  Binding: { port: 'binding', interactions: ['BIND'], semantic: 'binding' },
  Recruitment: { port: 'recruitment', interactions: ['RECRUIT'], semantic: 'binding' },
  'Adaptor recruitment': { port: 'recruitment', interactions: ['RECRUIT'], semantic: 'signal' },
  Activation: { port: 'activation', interactions: ['ACTIVATE'], semantic: 'signal' },
  Agonism: { port: 'activation', interactions: ['AGONIZE','ACTIVATE'], semantic: 'binding' },
  Antagonism: { port: 'inhibition', interactions: ['INHIBIT','BLOCK'], semantic: 'binding' },
  Blockade: { port: 'inhibition', interactions: ['BLOCK','INHIBIT'], semantic: 'binding' },
  Neutralization: { port: 'inhibition', interactions: ['BLOCK','INHIBIT'], semantic: 'binding' },
  Clustering: { port: 'binding', interactions: ['CLUSTER'], semantic: 'binding' },
  Dimerization: { port: 'binding', interactions: ['DIMERIZE'], semantic: 'binding' },
  Cleavage: { port: 'cleavage', interactions: ['CLEAVE'], semantic: 'signal' },
  Proteolysis: { port: 'cleavage', interactions: ['CLEAVE','DEGRADE'], semantic: 'signal' },
  Phosphorylation: { port: 'phosphorylation', interactions: ['PHOSPHORYLATE'], semantic: 'signal' },
  'Enzymatic activity': { port: 'enzymatic', interactions: ['ACTIVATE','CLEAVE','PHOSPHORYLATE'], semantic: 'signal' },
  Transport: { port: 'transport', interactions: ['TRANSLOCATE','SECRETE','INTERNALIZE'], semantic: 'transport' },
  Translocation: { port: 'translocation', interactions: ['TRANSLOCATE'], semantic: 'transport' },
  Internalization: { port: 'internalization', interactions: ['INTERNALIZE'], semantic: 'transport' },
  Trafficking: { port: 'transport', interactions: ['TRANSLOCATE','INTERNALIZE'], semantic: 'transport' },
  Secretion: { port: 'transport', interactions: ['SECRETE'], semantic: 'transport' },
  Anchoring: { port: 'membrane_anchor', interactions: ['BIND'], semantic: 'binding' },
  'Signal initiation': { port: 'signal_output', interactions: ['ACTIVATE'], semantic: 'signal' },
  'Signal propagation': { port: 'signal_output', interactions: ['ACTIVATE','PHOSPHORYLATE'], semantic: 'signal' },
  Degradation: { port: 'enzymatic', interactions: ['DEGRADE'], semantic: 'signal' },
  'Payload delivery': { port: 'transport', interactions: ['INTERNALIZE','TRANSLOCATE'], semantic: 'transport' },
  'Fc receptor binding': { port: 'binding', interactions: ['BIND','CLUSTER'], semantic: 'binding' },
  'Complement engagement': { port: 'activation', interactions: ['ACTIVATE','CLUSTER'], semantic: 'signal' },
}

const domain = (moleculeId: string, slug: string, label: string, kind: DomainDefinition['kind'], source: DomainDefinition['source'] = 'template'): DomainDefinition => ({ id: `domain:${moleculeId}:${slug}`, label, kind, source, confidence: source === 'user' ? 'confirmed' : 'medium' })

export function suggestedTemplate(name: string, moleculeClass: MoleculeClass, hasTransmembrane = false): StructuralTemplate {
  const normalized = name.toLowerCase()
  if (moleculeClass === 'antibody' || /igg|antibody|mab/.test(normalized)) return /bispecific|bisp|dual/.test(normalized) ? 'bispecific_igg' : 'igg'
  if (moleculeClass === 'engineered_construct') return /trap/.test(normalized) ? 'receptor_trap' : /fc/.test(normalized) ? 'fc_fusion' : /bispecific/.test(normalized) ? 'bispecific_igg' : 'custom_construct'
  if (hasTransmembrane || /r[ab]$|receptor|cd\d+|pd-?1|ctla/.test(normalized)) return 'single_pass_receptor'
  return /il-?\d+|cxcl|ccl|cytokine|chemokine/.test(normalized) ? 'cytokine' : 'globular'
}

export function defaultStructuralModel(id: string, name: string, moleculeClass: MoleculeClass, template?: StructuralTemplate): StructuralModel {
  const selected = template ?? suggestedTemplate(name, moleculeClass)
  const common = { template: selected, templateSource: 'inferred' as const, templateConfidence: 'low' as const, displayLevel: 'functional' as const }
  if (selected === 'single_pass_receptor') return { ...common, topology: { signalPeptide: true, extracellular: true, transmembrane: true, cytoplasmic: true }, domains: [domain(id,'extracellular','Extracellular domain','extracellular'),domain(id,'transmembrane','Transmembrane region','transmembrane'),domain(id,'cytoplasmic','Cytoplasmic domain','intracellular')] }
  if (selected === 'igg' || selected === 'bispecific_igg' || selected === 'asymmetric_bispecific') return { ...common, topology: { signalPeptide: true, extracellular: true, transmembrane: false, cytoplasmic: false }, domains: [domain(id,'Fab1','Fab 1','variable'),domain(id,'Fab2','Fab 2','variable'),domain(id,'Fc','Fc','constant')] }
  return { ...common, topology: { signalPeptide: true, extracellular: true, transmembrane: false, cytoplasmic: false }, domains: [domain(id,'protein','Protein domain','functional')] }
}

export function createMolecule(name: string, privacy: MoleculeDefinition['privacy'] = 'public'): MoleculeDefinition {
  const id = (privacy === 'private' ? 'construct' : 'protein') + ':' + name.trim().replace(/[^a-zA-Z0-9_-]+/g,'_')
  const moleculeClass: MoleculeClass = privacy === 'private' || /bispecific|construct|slc-|fusion|trap/i.test(name) ? 'engineered_construct' : /igg|antibody|mab/i.test(name) ? 'antibody' : 'protein'
  return { id, name: name.trim(), privacy, moleculeClass, structuralModel: defaultStructuralModel(id,name,moleculeClass), lookupStatus: privacy === 'private' ? 'local' : 'suggested', updatedAt: new Date().toISOString() }
}

export function portsFromDomains(molecule: MoleculeDefinition): PortDefinition[] {
  return molecule.structuralModel.domains.flatMap((item, index) => {
    if (!item.function) return []
    const grammar = functionGrammar[item.function] ?? { port: 'signal_output' as const, interactions: ['ACTIVATE'] as InteractionType[], semantic: 'signal' as const }
    return [{ id: `port:${molecule.id}:${item.id.split(':').at(-1)}:${grammar.port}`, role: 'source' as const, semantic: grammar.semantic, side: index % 2 ? 'right' as const : 'left' as const, domainId: item.id, allowedInteractions: grammar.interactions, functionalType: grammar.port, targetHint: item.target }]
  })
}

export function applyMoleculeToNode(node: BioNode, molecule: MoleculeDefinition): BioNode {
  const generated = portsFromDomains(molecule)
  const generatedIds = new Set(generated.map((port) => port.id))
  const retained = node.data.ports.filter((port) => !port.id.startsWith(`port:${molecule.id}:`) && !generatedIds.has(port.id))
  const requiredLegacyDomains = node.data.domains.filter((domain) => retained.some((port) => port.domainId === domain.id) || node.data.sites.some((site) => site.domainId === domain.id))
  const domainIds = new Set(molecule.structuralModel.domains.map((domain) => domain.id))
  const domains = [...molecule.structuralModel.domains, ...requiredLegacyDomains.filter((domain) => !domainIds.has(domain.id))]
  return { ...node, data: { ...node.data, label: molecule.name, target: molecule.geneName ?? node.data.target, moleculeId: molecule.id, structuralModel: molecule.structuralModel, domains, ports: [...retained, ...generated] } }
}
