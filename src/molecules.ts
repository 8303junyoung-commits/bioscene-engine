import type { AntibodyFormat, BioNode, ConstructArchitecture, ConstructComponent, DomainDefinition, FunctionalPortType, InteractionType, MoleculeClass, MoleculeDefinition, MoleculeEntityClass, MoleculeSpecificity, MoleculeTopology, PortDefinition, StructuralModel, StructuralTemplate } from './types'

export const biologicalFunctionVocabulary = ['Binding','Recruitment','Activation','Agonism','Antagonism','Blocking','Blockade','Neutralization','Clustering','Cell anchoring','Cell-cell bridging','Cytokine capture','Receptor recruitment','Dimerization','Oligomerization','Cleavage','Proteolysis','Phosphorylation','Dephosphorylation','Enzymatic activity','Transport','Translocation','Internalization','Trafficking','Secretion','Anchoring','Scaffolding','Adaptor recruitment','Signal initiation','Signal propagation','Transcriptional regulation','Degradation','Payload targeting','Payload delivery','Fc receptor binding','Complement engagement']

export const entityClassLabels: Record<MoleculeEntityClass,string> = { natural_protein:'Natural protein', mutant_protein:'Mutant protein', antibody:'Antibody / antibody-derived', fusion_protein:'Fusion protein', receptor_trap:'Receptor trap', cytokine_ligand:'Cytokine / ligand', enzyme:'Enzyme', peptide:'Peptide', adc:'ADC', protein_drug_conjugate:'Protein-drug conjugate', engineered_protein:'Synthetic / engineered protein', unknown_custom:'Unknown / Custom' }
export const topologyLabels: Record<MoleculeTopology,string> = { soluble:'Soluble', secreted:'Secreted', single_pass_membrane:'Single-pass membrane', multi_pass_membrane:'Multi-pass membrane', membrane_associated:'Membrane associated', intracellular:'Intracellular', nuclear:'Nuclear', organelle_associated:'Organelle-associated', unknown:'Unknown' }

const functionGrammar: Record<string,{port:FunctionalPortType;interactions:InteractionType[];semantic:PortDefinition['semantic']}> = {
  Binding:{port:'binding',interactions:['BIND'],semantic:'binding'}, Blocking:{port:'inhibition',interactions:['BLOCK','INHIBIT'],semantic:'binding'}, Blockade:{port:'inhibition',interactions:['BLOCK','INHIBIT'],semantic:'binding'}, Neutralization:{port:'inhibition',interactions:['BLOCK','INHIBIT'],semantic:'binding'}, Recruitment:{port:'recruitment',interactions:['RECRUIT'],semantic:'binding'}, 'Receptor recruitment':{port:'recruitment',interactions:['RECRUIT','CLUSTER'],semantic:'binding'}, 'Adaptor recruitment':{port:'recruitment',interactions:['RECRUIT'],semantic:'signal'}, Activation:{port:'activation',interactions:['ACTIVATE'],semantic:'signal'}, Agonism:{port:'activation',interactions:['AGONIZE','ACTIVATE'],semantic:'binding'}, Antagonism:{port:'inhibition',interactions:['INHIBIT','BLOCK'],semantic:'binding'}, Clustering:{port:'binding',interactions:['CLUSTER'],semantic:'binding'}, Dimerization:{port:'binding',interactions:['DIMERIZE'],semantic:'binding'}, Cleavage:{port:'cleavage',interactions:['CLEAVE'],semantic:'signal'}, Proteolysis:{port:'cleavage',interactions:['CLEAVE','DEGRADE'],semantic:'signal'}, Phosphorylation:{port:'phosphorylation',interactions:['PHOSPHORYLATE'],semantic:'signal'}, 'Enzymatic activity':{port:'enzymatic',interactions:['ACTIVATE','CLEAVE','PHOSPHORYLATE'],semantic:'signal'}, Transport:{port:'transport',interactions:['TRANSLOCATE','SECRETE','INTERNALIZE'],semantic:'transport'}, Translocation:{port:'translocation',interactions:['TRANSLOCATE'],semantic:'transport'}, Internalization:{port:'internalization',interactions:['INTERNALIZE'],semantic:'transport'}, Trafficking:{port:'transport',interactions:['TRANSLOCATE','INTERNALIZE'],semantic:'transport'}, Secretion:{port:'transport',interactions:['SECRETE'],semantic:'transport'}, Anchoring:{port:'membrane_anchor',interactions:['BIND'],semantic:'binding'}, 'Cell anchoring':{port:'binding',interactions:['BIND'],semantic:'binding'}, 'Cell-cell bridging':{port:'binding',interactions:['BIND','CLUSTER'],semantic:'binding'}, 'Cytokine capture':{port:'binding',interactions:['BIND','BLOCK'],semantic:'binding'}, 'Signal initiation':{port:'signal_output',interactions:['ACTIVATE'],semantic:'signal'}, 'Signal propagation':{port:'signal_output',interactions:['ACTIVATE','PHOSPHORYLATE'],semantic:'signal'}, Degradation:{port:'enzymatic',interactions:['DEGRADE'],semantic:'signal'}, 'Payload targeting':{port:'binding',interactions:['BIND','INTERNALIZE'],semantic:'binding'}, 'Payload delivery':{port:'transport',interactions:['INTERNALIZE','TRANSLOCATE'],semantic:'transport'}, 'Fc receptor binding':{port:'binding',interactions:['BIND','CLUSTER'],semantic:'binding'}, 'Complement engagement':{port:'activation',interactions:['ACTIVATE','CLUSTER'],semantic:'signal'},
}
const domain=(moleculeId:string,slug:string,label:string,kind:DomainDefinition['kind'],source:DomainDefinition['source']='template'):DomainDefinition=>({id:`domain:${moleculeId}:${slug}`,label,kind,source,confidence:source==='user'?'confirmed':'medium'})
const specificity=(id:string,label:string,valency:number,unitType:MoleculeSpecificity['unitType']='Fab'):MoleculeSpecificity=>({id,label,target:'',valency,unitType,function:'Binding'})

export function moleculeClassFor(entityClass:MoleculeEntityClass):MoleculeClass {
  if (['antibody','adc'].includes(entityClass)) return 'antibody'
  if (['fusion_protein','receptor_trap','protein_drug_conjugate','engineered_protein'].includes(entityClass)) return 'engineered_construct'
  return 'protein'
}

export function suggestedTemplate(_name:string,moleculeClass:MoleculeClass,hasTransmembrane=false):StructuralTemplate {
  if (moleculeClass==='antibody') return 'igg'
  if (moleculeClass==='engineered_construct') return 'custom_construct'
  return hasTransmembrane?'single_pass_receptor':'globular'
}

export function defaultStructuralModel(id:string,_name:string,moleculeClass:MoleculeClass,template?:StructuralTemplate):StructuralModel {
  const selected=template??(moleculeClass==='antibody'?'igg':moleculeClass==='engineered_construct'?'custom_construct':'globular')
  const common={template:selected,templateSource:'inferred' as const,templateConfidence:'low' as const,displayLevel:'functional' as const,visualScaling:'schematic' as const,modified:false}
  if (selected==='single_pass_receptor') return {...common,classification:'single_pass_receptor',topology:{signalPeptide:true,extracellular:true,transmembrane:true,cytoplasmic:true},domains:[domain(id,'extracellular','Extracellular domain','extracellular'),domain(id,'transmembrane','Transmembrane region','transmembrane'),domain(id,'cytoplasmic','Cytoplasmic domain','intracellular')]}
  if (['igg','bispecific_igg','asymmetric_bispecific'].includes(selected)) return {...common,classification:'soluble',topology:{signalPeptide:true,extracellular:true,transmembrane:false,cytoplasmic:false},domains:[domain(id,'Fab1','Fab 1','variable'),domain(id,'Fab2','Fab 2','variable'),domain(id,'Fc','Fc','constant')]}
  return {...common,classification:selected==='cytokine'?'secreted_cytokine':selected==='enzyme'?'enzyme':'soluble',topology:{signalPeptide:false,extracellular:true,transmembrane:false,cytoplasmic:false},domains:[domain(id,'protein','Protein domain','functional')]}
}

export function architectureForFormat(moleculeId:string,format:AntibodyFormat):ConstructArchitecture {
  const presets:Record<AntibodyFormat,{specificities:MoleculeSpecificity[];fc:boolean;template?:StructuralTemplate}>={
    igg:{specificities:[specificity('A','Specificity A',2)],fc:true}, fab:{specificities:[specificity('A','Specificity A',1)],fc:false}, fab2:{specificities:[specificity('A','Specificity A',2)],fc:false}, scfv:{specificities:[specificity('A','Specificity A',1,'scFv')],fc:false}, vhh:{specificities:[specificity('A','Specificity A',1,'VHH')],fc:false}, scfv_fc:{specificities:[specificity('A','Specificity A',2,'scFv')],fc:true}, fab_fc:{specificities:[specificity('A','Specificity A',2)],fc:true}, bispecific:{specificities:[specificity('A','Specificity A',1),specificity('B','Specificity B',1,'scFv')],fc:true}, trispecific:{specificities:[specificity('A','Specificity A',1),specificity('B','Specificity B',1,'scFv'),specificity('C','Specificity C',1,'VHH')],fc:true}, multispecific:{specificities:[specificity('A','Specificity A',1),specificity('B','Specificity B',1),specificity('C','Specificity C',1)],fc:true}, multivalent:{specificities:[specificity('A','Specificity A',4)],fc:true}, antibody_fusion:{specificities:[specificity('A','Specificity A',2),specificity('B','Fused specificity',1,'protein_domain')],fc:true}, custom_antibody:{specificities:[],fc:false},
  }
  const base=presets[format]
  return syncArchitecture(moleculeId,{kind:'antibody',antibodyFormat:format,iggSubtype:'IgG1',scfvOrientation:'VH-linker-VL',valencyPreset:format==='bispecific'?'1+1':'custom',symmetry:format==='bispecific'?'asymmetric':'symmetric',structuralFamily:format==='bispecific'?'igg_like':'custom',fc:base.fc,specificities:base.specificities,components:[]})
}

export function syncArchitecture(moleculeId:string,architecture:ConstructArchitecture):ConstructArchitecture {
  const extras=architecture.components.filter((item)=>item.type!=='binding_unit'&&item.type!=='Fc')
  const binding=architecture.specificities.flatMap((item)=>Array.from({length:Math.max(1,Math.min(8,item.valency))},(_,index):ConstructComponent=>({id:`component:${moleculeId}:${item.id}${index+1}`,type:'binding_unit',label:`${item.label} ${index+1}`,specificityId:item.id,target:item.target,function:item.function,attachment:item.unitType==='Fab'?'base':item.unitType==='scFv'?'C-attachment':'N-attachment',order:index})))
  const fc=architecture.fc?[{id:`component:${moleculeId}:Fc`,type:'Fc' as const,label:'Fc',attachment:'hinge-left / hinge-right',order:binding.length}]:[]
  return {...architecture,components:[...binding,...fc,...extras].map((item,index)=>({...item,order:index}))}
}

export function structuralModelForMolecule(molecule:MoleculeDefinition):StructuralModel {
  if (molecule.entityClass==='antibody'||molecule.entityClass==='adc') {
    const architecture=syncArchitecture(molecule.id,molecule.architecture??architectureForFormat(molecule.id,'igg'))
    const template:StructuralTemplate=architecture.antibodyFormat==='fab'?'fab':architecture.antibodyFormat==='fab2'?'fab2':['bispecific','trispecific','multispecific','multivalent'].includes(architecture.antibodyFormat??'')?'bispecific_igg':'igg'
    const domains:DomainDefinition[]=architecture.components.map((item)=>({id:`domain:${item.id}`,label:item.label,kind:item.type==='Fc'?'constant':'variable',function:item.function,target:item.target,source:'user',functionSource:'user',targetSource:'user',confidence:'confirmed'}))
    return {template,templateSource:'user',templateConfidence:'confirmed',displayLevel:molecule.structuralModel?.displayLevel??'functional',visualScaling:'schematic',modified:true,classification:'soluble',topology:{signalPeptide:true,extracellular:true,transmembrane:false,cytoplasmic:false},domains,architecture}
  }
  const topology=molecule.topology
  const template:StructuralTemplate=topology==='single_pass_membrane'?'single_pass_receptor':topology==='multi_pass_membrane'?'multi_pass_receptor':molecule.entityClass==='cytokine_ligand'?'cytokine':molecule.entityClass==='enzyme'?'enzyme':molecule.entityClass==='fusion_protein'||molecule.entityClass==='receptor_trap'||molecule.entityClass==='engineered_protein'?'custom_construct':'globular'
  const fallback=defaultStructuralModel(molecule.id,molecule.name,moleculeClassFor(molecule.entityClass),template)
  const preservedDomains=molecule.structuralModel?.template===template&&molecule.structuralModel.domains.length
    ? molecule.structuralModel.domains
    : fallback.domains
  return {...fallback,domains:preservedDomains,templateSource:molecule.topologySource==='UniProt'?'UniProt':molecule.identitySource==='user'?'user':'inferred',templateConfidence:molecule.topologyConfidence??'low',architecture:molecule.architecture,modified:true}
}

export function createMolecule(name:string,privacy:MoleculeDefinition['privacy']='private'):MoleculeDefinition {
  const id=`molecule:${name.trim().replace(/[^a-zA-Z0-9_-]+/g,'_')}:${crypto.randomUUID().slice(0,8)}`
  return {id,name:name.trim(),privacy,moleculeClass:'protein',entityClass:'unknown_custom',origin:'synthetic',topology:'unknown',saveStatus:'unclassified',identitySource:'user',identityConfidence:'low',topologyConfirmed:false,structuralModel:defaultStructuralModel(id,name,'protein','globular'),lookupStatus:privacy==='private'?'local':'suggested',lookupMessage:'Identity required before structure setup',updatedAt:new Date().toISOString()}
}

export function portsFromDomains(molecule:MoleculeDefinition):PortDefinition[] {
  return molecule.structuralModel.domains.flatMap((item,index)=>{
    if (!item.function) return []
    const grammar=functionGrammar[item.function]??{port:'signal_output' as const,interactions:['ACTIVATE'] as InteractionType[],semantic:'signal' as const}
    return [{id:`port:${molecule.id}:${item.id.split(':').at(-1)}:${grammar.port}`,role:'source' as const,semantic:grammar.semantic,side:index%2?'right' as const:'left' as const,domainId:item.id,allowedInteractions:grammar.interactions,functionalType:grammar.port,targetHint:item.target}]
  })
}

export function applyMoleculeToNode(node:BioNode,molecule:MoleculeDefinition):BioNode {
  const generated=portsFromDomains(molecule); const generatedIds=new Set(generated.map((port)=>port.id)); const retained=node.data.ports.filter((port)=>!port.id.startsWith(`port:${molecule.id}:`)&&!generatedIds.has(port.id)); const required=node.data.domains.filter((domain)=>retained.some((port)=>port.domainId===domain.id)||node.data.sites.some((site)=>site.domainId===domain.id)); const domainIds=new Set(molecule.structuralModel.domains.map((item)=>item.id)); const domains=[...molecule.structuralModel.domains,...required.filter((item)=>!domainIds.has(item.id))]
  return {...node,data:{...node.data,label:molecule.name,target:molecule.geneName??node.data.target,moleculeId:molecule.id,structuralModel:molecule.structuralModel,domains,ports:[...retained,...generated]}}
}
