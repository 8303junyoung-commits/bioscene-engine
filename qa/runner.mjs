import { mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { qaConfig } from './config.mjs'
import { createRun, writeReport } from './reporter.mjs'
import { createQaController } from './playwright/controller.mjs'
import { deterministicScenarios } from './scenarios/deterministic.mjs'
import { reviewVisualCheckpoint } from './agent/visualReviewer.mjs'
import { runExploratoryMission } from './agent/explorer.mjs'
import { GeminiQaClient } from './agent/geminiClient.mjs'
import { missions } from './missions.mjs'

const mode=process.argv.find((value)=>value.startsWith('--mode='))?.split('=')[1]??process.argv[process.argv.indexOf('--mode')+1]??'smoke'
const tag=process.argv.find((value)=>value.startsWith('--tag='))?.split('=')[1]??(process.argv.includes('--tag')?process.argv[process.argv.indexOf('--tag')+1]:undefined)
if(!['smoke','full','visual','explore'].includes(mode)) throw new Error(`Unknown QA mode: ${mode}`)
const run=await createRun(mode); const tests=[]; const aiObservations=[]; let trace=[]; let controller

try {
  controller=await createQaController(qaConfig,run)
  const selected=(mode==='smoke'||mode==='visual' ? deterministicScenarios.filter((scenario)=>scenario.tags.includes('smoke')) : mode==='full' ? deterministicScenarios : []).filter((scenario)=>!tag||scenario.tags.includes(tag))
  for(const scenario of selected) tests.push(await controller.runScenario(scenario,scenario.run))

  if(mode==='visual') {
    let checkpoint
    const visual=await controller.runScenario({id:'TC_VISUAL_001',title:'Canonical membrane mechanism checkpoint',tags:['visual'],severity:'VISUAL',component:'Canvas renderer'},async(a,r)=>{
      await a.startEmpty(); await a.drawMembrane([{x:.25,y:.53},{x:.38,y:.48},{x:.52,y:.52},{x:.7,y:.47}]); await a.addObject('place_receptor',{x:.49,y:.39}); await a.addObject('place_ligand',{x:.38,y:.29}); await a.addObject('place_antibody',{x:.63,y:.29}); checkpoint=await a.screenshot(r,'visual_checkpoint'); const objects=await a.qaState('getSceneObjects'); a.assert(r,'Canonical objects rendered',objects.length===4,4,objects.length)
    }); tests.push(visual)
    if(checkpoint){const baseline=resolve('qa/baselines/canonical-membrane.png'); if(qaConfig.updateBaselines){await mkdir(resolve('qa/baselines'),{recursive:true});await copyFile(checkpoint,baseline)} aiObservations.push(await reviewVisualCheckpoint(checkpoint,`Canonical membrane mechanism. Baseline ${existsSync(baseline)?'exists':'not yet established'}.`,new GeminiQaClient()))}
  }

  if(mode==='explore') {
    const mission=process.env.QA_MISSION||missions[0]
    const exploratory=await controller.runScenario({id:'TC_EXPLORE_001',title:'Bounded first-user exploratory mission',tags:['explore'],severity:'UX',component:'Cross-feature UX'},async(a,r)=>{trace=await runExploratoryMission(a,r,mission,new GeminiQaClient()); a.assert(r,'Exploratory trace was recorded',trace.length>0,'at least one action',trace.length)})
    if(trace.some((item)=>item.action==='stop')) exploratory.status='WARNING'
    tests.push(exploratory); aiObservations.push({status:exploratory.status,issues:[],message:`Mission: ${mission}. ${trace.length} bounded actions recorded.`})
  }
} finally {
  if(controller) await controller.close()
}

const result=await writeReport(run,tests,aiObservations,trace)
console.log(`BioScene QA ${result.qaStatus}: ${run.dir}`)
console.log(`Pass ${result.summary.pass}/${result.summary.total} · Fail ${result.summary.fail} · Warning ${result.summary.warnings}`)
if(result.qaStatus==='FAILED'||(mode==='full'&&result.summary.fail>0)) process.exitCode=1
