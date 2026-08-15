import assert from 'node:assert/strict'
import { createMolecule } from '../src/molecules'

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

const byGene=await lookupUniProt(createMolecule('IL18RB'))
assert.equal(byGene.molecule?.uniprotAccession,'Q9HB29'); assert.equal(byGene.molecule?.structuralModel.classification,'single_pass_receptor'); assert.equal(byGene.molecule?.structuralModel.template,'single_pass_receptor'); assert.ok(byGene.molecule?.uniprotFeatures?.some((item)=>item.type==='Disulfide bond'))

storage.clear(); calls=0; const direct=createMolecule('receptor'); direct.uniprotAccession='Q9HB29'; await lookupUniProt(direct); await lookupUniProt(direct); assert.equal(calls,1,'accession cache should avoid duplicate requests')

storage.clear(); mode='none'; await assert.rejects(()=>lookupUniProt(createMolecule('NOTAREALPROTEIN12345')),(error:unknown)=>error instanceof UniProtLookupError&&error.code==='not-found')
mode='down'; await assert.rejects(()=>lookupUniProt(createMolecule('SERVICE-DOWN')),(error:unknown)=>error instanceof UniProtLookupError&&error.code==='service')

storage.clear(); mode='ok'; current=il18; const soluble=await lookupUniProt(createMolecule('IL18')); assert.equal(soluble.molecule?.structuralModel.classification,'secreted_cytokine'); assert.equal(soluble.molecule?.structuralModel.template,'cytokine')
const edited=soluble.molecule!; edited.structuralModel.domains[0].function='Binding'; edited.structuralModel.domains[0].functionSource='user'; edited.structuralModel.modified=true; const reloaded=JSON.parse(JSON.stringify(edited)); assert.equal(reloaded.structuralModel.domains[0].function,'Binding'); assert.equal(reloaded.structuralModel.domains[0].functionSource,'user'); assert.equal(reloaded.originalStructuralModel.modified,false)

console.log('UniProt tests passed: gene, accession/cache, not-found, unavailable, receptor, cytokine, provenance/reload')
