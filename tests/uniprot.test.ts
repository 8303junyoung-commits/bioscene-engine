import assert from 'node:assert/strict'
import { architectureForFormat, createMolecule, portsFromDomains, structuralModelForMolecule } from '../src/molecules'
import { parseSceneFile } from '../src/utils'
import { defaultVisualizationProfile } from '../src/sceneViews'
import { defaultFigureWorkspace } from '../src/workspace'
import './core.test'

const storage = new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{ value:{ getItem:(key:string)=>storage.get(key)??null, setItem:(key:string,value:string)=>storage.set(key,value), removeItem:(key:string)=>storage.delete(key) }, configurable:true })

type EntryOptions = { accession:string; gene:string; protein:string; tm?:number; signal?:boolean; secreted?:boolean }
const entry = ({accession,gene,protein,tm=0,signal=false,secreted=false}:EntryOptions) => ({
  primaryAccession:accession, entryType:'UniProtKB reviewed (Swiss-Prot)', proteinDescription:{recommendedName:{fullName:{value:protein}}}, genes:[{geneName:{value:gene}}], organism:{scientificName:'Homo sapiens',taxonId:9606}, sequence:{length:356,value:'M'.repeat(356)},
  features:[...(signal?[{type:'Signal',location:{start:{value:1},end:{value:19}}}]:[]),...(tm?[{type:'Topological domain',description:'Extracellular',location:{start:{value:20},end:{value:200}}},...Array.from({length:tm},(_,i)=>({type:'Transmembrane',description:`Helical ${i+1}`,location:{start:{value:201+i*30},end:{value:220+i*30}}})),{type:'Topological domain',description:'Cytoplasmic',location:{start:{value:221},end:{value:356}}}]:[{type:'Domain',description:'Mature chain',location:{start:{value:20},end:{value:170}}}]),{type:'Disulfide bond',location:{start:{value:40},end:{value:88}}}],
  comments:secreted?[{commentType:'SUBCELLULAR LOCATION',subcellularLocations:[{location:{value:'Secreted'}}]}]:[],
})

const il18rb=entry({accession:'Q9HB29',gene:'IL18RAP',protein:'Interleukin-18 receptor accessory protein',tm:1,signal:true})
const il18=entry({accession:'Q14116',gene:'IL18',protein:'Interleukin-18',signal:true,secreted:true})
let mode:'ok'|'none'|'down'='ok'; let current=il18rb; let calls=0
globalThis.fetch=(async (_input:RequestInfo|URL,init?:RequestInit)=>{ calls++; const body=JSON.parse(String(init?.body??'{}')) as {action:string}; if(mode==='none') return new Response(JSON.stringify({error:'No UniProt entry found for this query.',code:'not-found'}),{status:404,headers:{'Content-Type':'application/json'}}); if(mode==='down') return new Response(JSON.stringify({error:'UniProt service is temporarily unavailable.',code:'service'}),{status:503,headers:{'Content-Type':'application/json'}}); return new Response(JSON.stringify(body.action==='search'?{results:[current]}:{entry:current}),{status:200,headers:{'Content-Type':'application/json'}}) }) as typeof fetch

const { lookupUniProt, UniProtLookupError } = await import('../src/uniprot')

const byGene=await lookupUniProt(createMolecule('IL18RB','public'))
assert.equal(byGene.molecule?.uniprotAccession,'Q9HB29'); assert.equal(byGene.molecule?.structuralModel.classification,'single_pass_receptor'); assert.equal(byGene.molecule?.structuralModel.template,'single_pass_receptor'); assert.ok(byGene.molecule?.uniprotFeatures?.some((item)=>item.type==='Disulfide bond'))
assert.equal(byGene.molecule?.entityClass,'unknown_custom','UniProt must suggest, not silently accept, identity'); assert.equal(byGene.molecule?.suggestedEntityClass,'natural_protein'); assert.equal(byGene.molecule?.suggestedTopology,'single_pass_membrane'); assert.equal(byGene.molecule?.topologyConfirmed,false)

storage.clear(); calls=0; const direct=createMolecule('receptor','public'); direct.uniprotAccession='Q9HB29'; await lookupUniProt(direct); await lookupUniProt(direct); assert.equal(calls,1,'accession cache should avoid duplicate requests')

storage.clear(); mode='none'; await assert.rejects(()=>lookupUniProt(createMolecule('NOTAREALPROTEIN12345','public')),(error:unknown)=>error instanceof UniProtLookupError&&error.code==='not-found')
mode='down'; await assert.rejects(()=>lookupUniProt(createMolecule('SERVICE-DOWN','public')),(error:unknown)=>error instanceof UniProtLookupError&&error.code==='service')

storage.clear(); mode='ok'; current=il18; const soluble=await lookupUniProt(createMolecule('IL18','public')); assert.equal(soluble.molecule?.structuralModel.classification,'secreted_cytokine'); assert.equal(soluble.molecule?.structuralModel.template,'cytokine')
const edited=soluble.molecule!; edited.structuralModel.domains[0].function='Binding'; edited.structuralModel.domains[0].functionSource='user'; edited.structuralModel.modified=true; const reloaded=JSON.parse(JSON.stringify(edited)); assert.equal(reloaded.structuralModel.domains[0].function,'Binding'); assert.equal(reloaded.structuralModel.domains[0].functionSource,'user'); assert.equal(reloaded.originalStructuralModel.modified,false)
const { uniProtProvider } = await import('../src/integrations/uniprot')
const normalizedProtein=uniProtProvider.normalize(edited); assert.equal(normalizedProtein?.accession,'Q14116'); assert.equal(normalizedProtein?.name,'Interleukin-18'); assert.ok(normalizedProtein?.features.some((item)=>item.type==='Domain'&&item.start===20&&item.source==='UniProt'))
assert.equal(uniProtProvider.normalize(createMolecule('Local only')),undefined,'provider must not invent a remote protein definition')

const nameOnly=createMolecule('IL18RB receptor bispecific antibody')
assert.equal(nameOnly.entityClass,'unknown_custom'); assert.equal(nameOnly.topology,'unknown'); assert.equal(nameOnly.saveStatus,'unclassified')

const formatCases = [
  ['igg',2,true],['fab',1,false],['fab2',2,false],['scfv',1,false],['vhh',1,false],['scfv_fc',2,true],['fab_fc',2,true],['bispecific',2,true],['trispecific',3,true],['multispecific',3,true],['multivalent',4,true],['antibody_fusion',3,true],['custom_antibody',0,false],
] as const
for (const [format,units,fc] of formatCases) { const architecture=architectureForFormat('m:test',format); assert.equal(architecture.components.filter((item)=>item.type==='binding_unit').length,units,`${format} binding units`); assert.equal(architecture.fc,fc,`${format} Fc`) }

const bispecific=createMolecule('BsAb'); bispecific.entityClass='antibody'; bispecific.origin='engineered'; bispecific.topology='soluble'; bispecific.topologyConfirmed=true; bispecific.architecture=architectureForFormat(bispecific.id,'bispecific'); bispecific.architecture.specificities[0].target='PD-1'; bispecific.architecture.specificities[0].function='Blocking'; bispecific.architecture.specificities[1].target='VEGF'; bispecific.architecture.specificities[1].function='Neutralization'; bispecific.structuralModel=structuralModelForMolecule(bispecific)
const bsPorts=portsFromDomains(bispecific); assert.equal(bsPorts.length,2); assert.deepEqual(new Set(bsPorts.map((port)=>port.targetHint)),new Set(['PD-1','VEGF']))

const legacy=createMolecule('Legacy proprietary receptor'); const legacyMolecule=structuredClone(legacy) as unknown as Record<string,unknown>; for (const field of ['entityClass','origin','topology','saveStatus','identitySource','identityConfidence','topologySource','topologyConfidence','topologyConfirmed','architecture']) delete legacyMolecule[field]
const migrated=parseSceneFile({schema:'bioscene.scene.v0.13',title:'Legacy',createdAt:new Date().toISOString(),constraintMode:'biological',nodes:[],edges:[],stylePreset:'scientific-clean',review:{status:'draft',reviewers:[],notes:'',updatedAt:new Date().toISOString()},literature:[],collaboration:{participants:[],comments:[],activity:[]},visualizationProfile:defaultVisualizationProfile,views:[],moleculeLibrary:[legacyMolecule],customFunctions:[],workspace:defaultFigureWorkspace})
assert.equal(migrated?.schema,'bioscene.scene.v0.14'); assert.equal(migrated?.moleculeLibrary[0].entityClass,'unknown_custom'); assert.equal(migrated?.moleculeLibrary[0].saveStatus,'needs_review'); assert.equal(migrated?.moleculeLibrary[0].topologyConfirmed,false)

console.log('Model tests passed: identity, confirmation, topology, format, valency, specificity, ports, provenance, provider normalization, privacy, and migration scenarios')

