import { createBioData, validateConnection } from './biology'
import { applyMoleculeToNode, architectureForFormat, createMolecule, scenePlacementForMolecule, structuralModelForMolecule, syncArchitecture } from './molecules'
import { uid } from './identity'
import { markerForInteraction } from './visualGrammar'
import type { AntibodyFormat, BioEdge, BioNode, MoleculeDefinition, MoleculeTopology, PortDefinition } from './types'

export const cellChoices = ['T cell','CD4 T cell','CD8 T cell','Treg','B cell','NK cell','Macrophage','Dendritic cell','Tumor cell','Fibroblast']
export const counts = [1,2,3,5,10]
export type Density = 'Low' | 'Medium' | 'High' | 'Clustered'
export const densityCounts: Record<Density, number> = { Low:5, Medium:10, High:15, Clustered:8 }
export type SimpleRelation = 'Bind' | 'Signal' | 'Block' | 'Indirect'
// Creation form only. Generated objects use the existing BioNode/MoleculeDefinition model.
export interface CellDraft { key: string; name: string; proteins: { molecule: MoleculeDefinition; count: number; density?: Density }[] }
export const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g,'')

function preset(name: string, geneName: string, topology: MoleculeTopology): MoleculeDefinition {
  const molecule: MoleculeDefinition = { ...createMolecule(name), privacy:'public', id:`preset:${geneName}`, geneName, entityClass:topology==='secreted'?'cytokine_ligand':'natural_protein', origin:'natural', topology, topologyConfirmed:true, topologySource:'BioScene inference', topologyConfidence:'medium', identitySource:'BioScene inference', identityConfidence:'medium', saveStatus:'saved', lookupStatus:'local', lookupMessage:'Schematic preset; not a UniProt annotation', species:'Homo sapiens' }
  molecule.structuralModel = { ...structuralModelForMolecule(molecule), displayLevel:'simplified' }
  return molecule
}
// Small schematic presets for the existing receptor/ligand/signal vocabulary, not new biology types.
export const proteinPresets = [preset('PD-1','PDCD1','single_pass_membrane'),preset('CD3','CD3','single_pass_membrane'),preset('CD28','CD28','single_pass_membrane'),preset('IL18RA','IL18R1','single_pass_membrane'),preset('IL18RB','IL18RAP','single_pass_membrane'),preset('PD-L1','CD274','single_pass_membrane'),preset('Tumor antigen','Tumor antigen','single_pass_membrane'),preset('IL-18','IL18','secreted'),preset('IL-2','IL2','secreted'),preset('STAT5','STAT5','nuclear'),preset('MyD88','MYD88','intracellular')]

export function makeDrug(name: string, format: AntibodyFormat | 'ligand', targets: string[], valency='1+1'): MoleculeDefinition {
  const molecule: MoleculeDefinition = { ...createMolecule(name), id:uid('molecule'), entityClass:format==='ligand'?'cytokine_ligand':'antibody', moleculeClass:format==='ligand'?'protein':'antibody', origin:format==='ligand'?'natural':'engineered', privacy:format==='ligand'?'public':'private', topology:'soluble', topologyConfirmed:true, topologySource:'user', topologyConfidence:'confirmed', identityConfidence:'confirmed', saveStatus:'saved', savedAt:new Date().toISOString() }
  if (format !== 'ligand') {
    const architecture = architectureForFormat(molecule.id,format)
    const values = valency.split('+').map(Number)
    molecule.architecture = syncArchitecture(molecule.id,{...architecture, specificities:architecture.specificities.map((s,i)=>({...s,target:targets[i]??targets[0]??'',valency:format==='bispecific'?values[i]??1:s.valency})), valencyPreset:format==='bispecific'?valency as '1+1':architecture.valencyPreset})
  }
  molecule.structuralModel = { ...structuralModelForMolecule(molecule), displayLevel:'simplified' }
  return molecule
}

export function generateCells(drafts: CellDraft[]): BioNode[] {
  const nodes: BioNode[]=[]
  let x=60
  for (const draft of drafts) {
    const id=uid('cell')
    const n=draft.proteins.filter(p=>scenePlacementForMolecule(p.molecule).anchorToMembrane).reduce((sum,p)=>sum+p.count,0)
    const width=Math.max(580,n*126+120)
    const membrane={id,name:`${draft.name} membrane`,boundaryType:'plasma_membrane' as const,path:[{x:35,y:219},{x:width-35,y:219}],sideA:'extracellular' as const,sideB:'cytoplasm' as const,closed:false,style:'standard' as const,thickness:14,smoothing:0,anchors:[]}
    nodes.push({id,type:'cell',position:{x,y:70},style:{width,height:520},data:createBioData('cell',draft.name,{simpleCell:true,membrane,showOrganelles:false,sceneType:'full_signaling',panelId:'single',positionMode:'auto',visibility:'visible'})})
    for(const p of draft.proteins) {
      const groupId=uid('representation')
      for(let i=0;i<p.count;i++) {
        const node=applyMoleculeToNode({id:uid('protein'),type:'bio',parentId:id,extent:'parent',position:{x:0,y:0},data:createBioData('receptor',p.molecule.name)},p.molecule)
        nodes.push({...node,data:{...node.data,visibility:'visible',positionMode:'auto',showName:true,visualRepresentation:{groupId,count:p.count,density:p.density}}})
      }
    }
    x+=width+150
  }
  return layoutSimpleCells(nodes,false)
}

export function layoutSimpleCells(nodes: BioNode[], respectManual=true): BioNode[] {
  const result=structuredClone(nodes)
  let nextX=60
  for(const cell of result.filter(n=>n.data.simpleCell)) {
    const children=result.filter(n=>n.parentId===cell.id && !n.hidden)
    const membraneChildren=children.filter(n=>n.data.compartment==='membrane')
    const largest=Math.max(1,...['membrane','extracellular','cytoplasm'].map(c=>children.filter(n=>n.data.compartment===c).length))
    const nuclearCount=children.filter(n=>n.data.compartment==='nucleus').length
    const width=Math.max(Number(cell.style?.width??580),largest*126+120,nuclearCount>1?nuclearCount*310+180:580)
    cell.style={...cell.style,width}
    if(!respectManual || cell.data.positionMode==='auto') cell.position={x:nextX,y:70}
    nextX=cell.position.x+width+150
    if(cell.data.membrane) cell.data.membrane={...cell.data.membrane,path:[{x:35,y:219},{x:width-35,y:219}],anchors:[]}
    for(const compartment of ['membrane','extracellular','cytoplasm','nucleus','endosome','mitochondria']) {
      const members=children.filter(n=>n.data.compartment===compartment)
      members.forEach((node,i)=>{
        const start=compartment==='nucleus'?width*.42+10:50
        const end=compartment==='nucleus'?width*.84-104:width-145
        const clustered=members.some(n=>n.data.visualRepresentation?.density==='Clustered')
        const step=members.length>1?Math.min(clustered?106:180,(end-start)/(members.length-1)):0
        const px=(start+end-step*(members.length-1))/2+i*step
        if(!respectManual || node.data.positionMode==='auto') node.position={x:px,y:compartment==='membrane'?170:compartment==='extracellular'?65:compartment==='nucleus'?390:285}
        if(compartment==='membrane') {
          // Child-local center on the parent's membrane. Same anchor structure as Advanced.
          node.position.y=170
          const pathPosition=Math.max(0,Math.min(1,(node.position.x+46-35)/(width-70)))
          node.data.membraneAnchor={membraneId:cell.id,pathPosition,orientation:'normal',angle:0}
          cell.data.membrane?.anchors.push({objectId:node.id,pathPosition,orientation:'normal'})
        }
      })
    }
    if(membraneChildren.length===0 && cell.data.membrane) cell.data.membrane.anchors=[]
  }
  for(const node of result)if(node.data.visualRepresentation)node.data.visualRepresentation.count=result.filter(n=>n.data.visualRepresentation?.groupId===node.data.visualRepresentation?.groupId).length
  return result
}

export function pruneSimpleEdges(nodes:BioNode[],edges:BioEdge[]) {
  const ids=new Set(nodes.map(n=>n.id))
  let next=edges.filter(e=>ids.has(e.source)&&ids.has(e.target))
  while(true){const edgeIds=new Set(next.map(e=>e.id));const filtered=next.filter(e=>typeof e.data?.blockedEdgeId!=='string'||edgeIds.has(e.data.blockedEdgeId));if(filtered.length===next.length)return next;next=filtered}
}

export function changeRepresentation(nodes: BioNode[], id: string, count: number, density?: Density): BioNode[] {
  const node=nodes.find(n=>n.id===id)
  if(!node) return nodes
  const groupId=node.data.visualRepresentation?.groupId??uid('representation')
  const members=nodes.filter(n=>n.id===id || n.data.visualRepresentation?.groupId===groupId)
  const n=Math.max(1,Math.min(15,Math.round(count)))
  const keep=new Set(members.slice(0,n).map(n=>n.id))
  const next=nodes.filter(item=>!members.includes(item)||keep.has(item.id)).map(item=>keep.has(item.id)?{...item,data:{...item.data,positionMode:'auto' as const,visualRepresentation:{groupId,count:n,density}}}:item)
  for(let i=members.length;i<n;i++) next.push({...structuredClone(node),id:uid('protein'),selected:false,data:{...structuredClone(node.data),positionMode:'auto',visualRepresentation:{groupId,count:n,density}}})
  return layoutSimpleCells(next)
}

export function addSimpleDrug(nodes: BioNode[], molecule: MoleculeDefinition, preferredCellId?: string): { nodes: BioNode[]; id: string } {
  const targets=molecule.architecture?.specificities.map(s=>normalizeName(s.target))??[]
  const target=nodes.find(n=>targets.includes(normalizeName(n.data.label)))
  const cell=nodes.find(n=>n.id===(preferredCellId??target?.parentId))??nodes.find(n=>n.data.kind==='cell')
  const node=applyMoleculeToNode({id:uid('drug'),type:'bio',parentId:cell?.id,...(cell?{extent:'parent' as const}:{}),position:{x:100,y:60},data:createBioData(molecule.entityClass==='antibody'?'antibody':'ligand',molecule.name,{showName:true,positionMode:'auto',visibility:'visible'})},molecule)
  const targetCells=nodes.filter(n=>n.data.kind==='cell'&&nodes.some(p=>p.parentId===n.id&&targets.includes(normalizeName(p.data.label))))
  if(targetCells.length>1){node.parentId=undefined;node.extent=undefined;const left=targetCells[0],right=targetCells.at(-1)!;node.position={x:(left.position.x+Number(left.style?.width??580)+right.position.x)/2-46,y:Math.min(left.position.y,right.position.y)+55}}
  return {nodes:layoutSimpleCells([...nodes,node]),id:node.id}
}

export function simpleConnection(nodes: BioNode[], sourceId: string, targetId: string, relation: SimpleRelation, blockedEdgeId?: string): { nodes: BioNode[]; edge: BioEdge } {
  const source=nodes.find(n=>n.id===sourceId), target=nodes.find(n=>n.id===targetId)
  if(!source || !target || source===target || ['cell','membrane','annotation'].includes(source.data.kind) || ['cell','membrane','annotation'].includes(target.data.kind)) throw new Error('Choose two different molecules.')
  const interaction=relation==='Block'?'BLOCK':relation==='Signal'?'ACTIVATE':'BIND'
  let out=source.data.ports.find(p=>p.role==='source'&&p.allowedInteractions.includes(interaction)&&target.data.ports.some(t=>t.role==='target'&&t.semantic===p.semantic&&t.allowedInteractions.includes(interaction)))
  let input=out&&target.data.ports.find(p=>p.role==='target'&&p.semantic===out!.semantic&&p.allowedInteractions.includes(interaction))
  const next=structuredClone(nodes)
  // Resolve existing generic molecule ports behind the UI (e.g. cytokine capture needs an incoming binding port).
  if(!out || !input) {
    const semantic=interaction==='ACTIVATE'?'signal':'binding'
    const port=(role:'source'|'target'):PortDefinition=>({id:`simple:${semantic}:${role}`,role,semantic,side:role==='source'?'right':'left',allowedInteractions:semantic==='signal'?['ACTIVATE']:['BIND','BLOCK']})
    out=port('source'); input=port('target')
    for(const [id,p] of [[sourceId,out],[targetId,input]] as const) {const n=next.find(n=>n.id===id)!; if(!n.data.ports.some(t=>t.id===p.id)) n.data.ports.push(p)}
  }
  const error=validateConnection(next.find(n=>n.id===sourceId),next.find(n=>n.id===targetId),out.id,input.id,interaction)
  if(error) throw new Error(error)
  return {nodes:next,edge:{id:uid('edge'),source:sourceId,target:targetId,sourceHandle:out.id,targetHandle:input.id,type:'interaction',data:{interaction,indirect:relation==='Indirect',blockedEdgeId},markerEnd:markerForInteraction(interaction)}}
}

export function treatedComparison(nodes: BioNode[], edges: BioEdge[]) {
  const ids=new Map(nodes.map(n=>[n.id,uid(n.data.kind)]))
  const edgeIds=new Map(edges.map(e=>[e.id,uid('edge')]))
  const offset=Math.max(700,...nodes.filter(n=>!n.parentId).map(n=>n.position.x+Number(n.style?.width??160)))+150
  const clones=nodes.map(n=>({...structuredClone(n),id:ids.get(n.id)!,parentId:n.parentId?ids.get(n.parentId):undefined,position:{x:n.position.x+(n.parentId?0:offset),y:n.position.y},selected:false,data:{...structuredClone(n.data),panelId:'treated' as const,label:n.data.kind==='cell'?`Treated ${n.data.label}`:n.data.label,visualRepresentation:n.data.visualRepresentation?{...n.data.visualRepresentation,groupId:`treated:${n.data.visualRepresentation.groupId}`}:undefined,membrane:n.data.membrane?{...structuredClone(n.data.membrane),id:ids.get(n.id)!,anchors:n.data.membrane.anchors.map(a=>({...a,objectId:ids.get(a.objectId)!}))}:undefined,membraneAnchor:n.data.membraneAnchor?{...n.data.membraneAnchor,membraneId:ids.get(n.data.membraneAnchor.membraneId)!}:undefined}}))
  return {nodes:[...nodes,...clones],edges:[...edges,...edges.map(e=>({...structuredClone(e),id:edgeIds.get(e.id)!,source:ids.get(e.source)!,target:ids.get(e.target)!,selected:false,data:e.data?{...e.data,blockedEdgeId:typeof e.data.blockedEdgeId==='string'?edgeIds.get(e.data.blockedEdgeId):undefined}:undefined}))]}
}
