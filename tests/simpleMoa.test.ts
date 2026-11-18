import assert from 'node:assert/strict'
import { addSimpleDrug, changeRepresentation, densityCounts, generateCells, layoutSimpleCells, makeDrug, proteinPresets, pruneSimpleEdges, simpleConnection, treatedComparison } from '../src/simpleMoa'
import { parseSceneFile } from '../src/utils'
import { defaultVisualizationProfile } from '../src/sceneViews'
import { defaultFigureWorkspace } from '../src/workspace'
import type { AntibodyFormat, BioNode } from '../src/types'
import { Position, type InternalNode } from '@xyflow/react'
import { blockadeJunction, interactionPath } from '../src/interactionGeometry'
import { assertVisibleBlocksForCapture, blueprintRelationship } from '../src/exportGraphics'

const pd1=proteinPresets.find(m=>m.name==='PD-1')!
let nodes=generateCells([{key:'t',name:'T cell',proteins:[{molecule:pd1,count:3}]}])
const cell=nodes[0],first=nodes[1]
assert.equal(nodes.length,4)
assert(nodes.slice(1).every(n=>n.parentId===cell.id&&n.data.compartment==='membrane'&&n.data.membraneAnchor?.membraneId===cell.id))
assert.equal(cell.data.membrane?.anchors.length,3)
for(const count of [1,2,3,5,10]){const next=changeRepresentation(nodes,first.id,count);assert.equal(next.length,count+1);assert(next.slice(1).every(n=>n.data.visualRepresentation?.count===count));assert.equal(next[0].data.membrane?.anchors.length,count)}
for(const [density,count] of Object.entries(densityCounts)){const next=changeRepresentation(nodes,first.id,count,density as keyof typeof densityCounts);assert.equal(next.length,count+1);const positions=next.slice(1).map(n=>n.position.x).sort((a,b)=>a-b);assert(positions.slice(1).every((x,i)=>x-positions[i]>=92),'No glyph overlap')}
const varied=generateCells([{key:'nk',name:'NK cell',proteins:proteinPresets.filter(m=>['IL18RA','IL-18','STAT5','MyD88'].includes(m.name)).map(molecule=>({molecule,count:2}))}])
for(const [name,compartment] of [['IL18RA','membrane'],['IL-18','extracellular'],['STAT5','nucleus'],['MyD88','cytoplasm']])assert(varied.filter(n=>n.data.label===name).every(n=>n.data.compartment===compartment),name)
for(const format of ['igg','fab','scfv','bispecific','trispecific','custom_antibody'] as AntibodyFormat[]){const molecule=makeDrug('Test',format,['PD-1','CD3','PD-L1']);assert.equal(molecule.architecture?.antibodyFormat,format);assert.equal(molecule.privacy,'private')}
for(const valency of ['1+1','2+1','1+2','2+2']){const m=makeDrug('Bispecific','bispecific',['PD-1','CD3'],valency);assert.deepEqual(m.architecture?.specificities.map(s=>s.valency),valency.split('+').map(Number));assert.equal(m.architecture?.components.filter(c=>c.type==='binding_unit').length,valency.split('+').map(Number).reduce((a,b)=>a+b))}
const antibody=makeDrug('anti-PD-1','igg',['PD-1'])
const added=addSimpleDrug(nodes,antibody);nodes=added.nodes
const block=simpleConnection(nodes,added.id,first.id,'Block');assert.equal(block.edge.data?.interaction,'BLOCK');assert.equal(block.nodes.find(n=>n.id===first.id)?.data.moleculeId,pd1.id)
const indirect=simpleConnection(nodes,added.id,first.id,'Indirect');assert.equal(indirect.edge.data?.indirect,true);assert.equal(indirect.edge.data?.interaction,'BIND','No extra interaction enum introduced')
const signal=simpleConnection(varied,varied[1].id,varied.at(-1)!.id,'Signal');assert.equal(signal.edge.data?.interaction,'ACTIVATE')
assert.throws(()=>simpleConnection(nodes,first.id,first.id,'Bind'))
const edgeBlock=simpleConnection(block.nodes,added.id,first.id,'Block',block.edge.id)
assert.equal(pruneSimpleEdges(nodes,[edgeBlock.edge]).length,0)
assert.equal(pruneSimpleEdges(nodes.filter(n=>n.id!==first.id),[block.edge,edgeBlock.edge]).length,0)
const comparison=treatedComparison(block.nodes,[block.edge,edgeBlock.edge]);assert.equal(comparison.nodes.length,nodes.length*2);assert.equal(comparison.edges.length,4);assert.deepEqual(comparison.nodes.slice(0,nodes.length),block.nodes)
const ids=new Set(comparison.nodes.map(n=>n.id));assert.equal(ids.size,comparison.nodes.length);assert(comparison.nodes.every(n=>!n.parentId||ids.has(n.parentId)));assert.equal(comparison.edges[3].data?.blockedEdgeId,comparison.edges[2].id)
const moved=layoutSimpleCells(block.nodes.map(n=>n.id===first.id?{...n,position:{x:200,y:500},data:{...n.data,positionMode:'manual'}}:n));assert.equal(moved[1].position.x,200);assert.equal(moved[1].position.y,170)
const serialized={schema:'bioscene.scene.v0.14',title:'Simple round trip',templateId:'t-cell-activation',createdAt:new Date().toISOString(),constraintMode:'biological',nodes:comparison.nodes,edges:comparison.edges,moleculeLibrary:[pd1,antibody],visualizationProfile:{...defaultVisualizationProfile,detailLevel:4},workspace:defaultFigureWorkspace}
const loaded=parseSceneFile(JSON.parse(JSON.stringify(serialized)))!;assert(loaded);assert.equal(loaded.nodes.length,comparison.nodes.length);assert.equal(loaded.edges.length,4);assert.equal(loaded.nodes[1].data.visualRepresentation?.count,3);assert.equal(loaded.nodes[0].data.simpleCell,true);assert.equal(loaded.nodes[1].data.membraneAnchor?.membraneId,cell.id);assert.equal(loaded.moleculeLibrary.find(m=>m.id===antibody.id)?.architecture?.specificities[0].target,'PD-1');assert.equal(loaded.edges[3].data?.blockedEdgeId,comparison.edges[2].id)
console.log('Simple MoA model tests passed: counts, density, compartments, valencies, ports, comparison, drag, serialization')

// Positive receptor controls and the soluble-target dynamic-port regression.
const internalNodes = (items: BioNode[]) => {
  const absolute = (n: BioNode): {x:number;y:number} => {const parent=items.find(p=>p.id===n.parentId);const a=parent?absolute(parent):{x:0,y:0};return{x:a.x+n.position.x,y:a.y+n.position.y}}
  return new Map(items.map(n=>[n.id,{...n,measured:{width:92,height:78},internals:{positionAbsolute:absolute(n),handleBounds:{source:n.data.ports.filter(p=>p.role==='source').map(p=>({id:p.id,x:90,y:34,width:2,height:2,position:Position.Right})),target:n.data.ports.filter(p=>p.role==='target').map(p=>({id:p.id,x:0,y:34,width:2,height:2,position:Position.Left}))}}} as InternalNode<BioNode>]))
}
for (const label of ['PD-1','IL18RB','IL-18']) {
  const molecule=proteinPresets.find(m=>m.name===label)!
  const initial=generateCells([{key:'block',name:'NK cell',proteins:[{molecule,count:1}]}])
  const drug=addSimpleDrug(initial,makeDrug(`anti-${label}`,'igg',[label]))
  const connected=simpleConnection(drug.nodes,drug.id,initial[1].id,'Block')
  const internals=internalNodes(connected.nodes)
  assert(connected.nodes.find(n=>n.id===connected.edge.target)?.data.ports.some(p=>p.id===connected.edge.targetHandle))
  const path=interactionPath(connected.edge,id=>internals.get(id),()=>undefined,true)
  assert(path && path[0].startsWith('M') && Number.isFinite(path[1]) && Number.isFinite(path[2]),`${label} BLOCK path`)
  const roundtrip=parseSceneFile({...serialized,nodes:connected.nodes,edges:[connected.edge]})!
  assert.equal(roundtrip.edges[0].data?.interaction,'BLOCK');assert.equal(roundtrip.edges[0].targetHandle,connected.edge.targetHandle)
}
const ra=proteinPresets.find(m=>m.name==='IL18RA')!,myd=proteinPresets.find(m=>m.name==='MyD88')!
const base=generateCells([{key:'edge-block',name:'NK cell',proteins:[{molecule:ra,count:1},{molecule:myd,count:1}]}])
const drug=addSimpleDrug(base,makeDrug('anti-IL18RA','igg',['IL18RA']))
const activation=simpleConnection(drug.nodes,base[1].id,base[2].id,'Signal')
const inhibition=simpleConnection(activation.nodes,drug.id,base[2].id,'Block',activation.edge.id)
const internal=internalNodes(inhibition.nodes),lookup=(id:string)=>internal.get(id)
for(const simple of [true,false]) {
  const signalPath=interactionPath(activation.edge,lookup,()=>undefined,simple)!
  const blockPath=interactionPath(inhibition.edge,lookup,id=>id===activation.edge.id?activation.edge:undefined,simple)!
  const junction=blockadeJunction(signalPath)
  assert(blockPath[0].endsWith(`${junction.x},${junction.y}`),'Block terminates on the actual Signal curve in both modes')
  assert(junction.y>signalPath[2],'Inhibition bar stays below the receptor-label midpoint')
}
assert.equal(interactionPath(inhibition.edge,lookup,()=>undefined,true),undefined,'Missing blocked relationship cannot silently fall back to a different molecule target')
assert.equal(blueprintRelationship(inhibition.edge,inhibition.nodes,[activation.edge,inhibition.edge]),'anti-IL18RA BLOCK [IL18RA ACTIVATE MyD88]')
const emptyCapture = {querySelectorAll:()=>[]} as unknown as HTMLElement
assert.throws(()=>assertVisibleBlocksForCapture(emptyCapture,[inhibition.edge.id]),/Export stopped/,'Missing live BLOCK geometry must fail closed before capture')
assert.doesNotThrow(()=>assertVisibleBlocksForCapture(emptyCapture,[]))
console.log('BLOCK geometry regression passed: PD1, IL18RB, soluble IL18, exact Signal junction, invalid reference')
