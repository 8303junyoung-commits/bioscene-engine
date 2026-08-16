import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const git=(args,fallback='unknown')=>{try{return execFileSync('git',args,{encoding:'utf8'}).trim()}catch{return fallback}}
const safeStamp=()=>new Date().toISOString().replace(/[:.]/g,'-')

async function previousResult(currentDir) {
  const root=resolve('qa/reports'); if(!existsSync(root)) return undefined
  const dirs=(await readdir(root,{withFileTypes:true})).filter((entry)=>entry.isDirectory()&&join(root,entry.name)!==currentDir).map((entry)=>entry.name).sort().reverse()
  for(const name of dirs){try{return JSON.parse(await readFile(join(root,name,'QA_RESULT.json'),'utf8'))}catch{/* ignore partial run */}}
}

function regression(current,previous) {
  const prior=new Map((previous?.tests??[]).map((test)=>[test.id,test.status])); const now=new Map(current.tests.map((test)=>[test.id,test.status]))
  return {
    newFailures:[...now].filter(([id,status])=>status==='FAIL'&&prior.get(id)!=='FAIL').map(([id])=>id),
    resolvedFailures:[...prior].filter(([id,status])=>status==='FAIL'&&now.get(id)&&now.get(id)!=='FAIL').map(([id])=>id),
    persistentFailures:[...now].filter(([id,status])=>status==='FAIL'&&prior.get(id)==='FAIL').map(([id])=>id),
  }
}

export async function createRun(mode) {
  const runId=`run_${safeStamp()}`; const dir=resolve('qa/reports',runId); const screenshots=join(dir,'screenshots'); await mkdir(screenshots,{recursive:true})
  return { runId,dir,screenshots,mode,commit:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),startedAt:new Date().toISOString() }
}

export async function writeReport(run,tests,aiObservations=[],trace=[]) {
  const summary={total:tests.length,pass:tests.filter((x)=>x.status==='PASS').length,fail:tests.filter((x)=>x.status==='FAIL').length,warnings:tests.filter((x)=>x.status==='WARNING').length,skipped:tests.filter((x)=>x.status==='SKIPPED').length}
  const qaStatus=tests.some((test)=>test.critical&&test.status==='FAIL')?'FAILED':summary.fail?'UNSTABLE':'PASSED'
  const result={runId:run.runId,mode:run.mode,build:{commit:run.commit,branch:run.branch},startedAt:run.startedAt,completedAt:new Date().toISOString(),qaStatus,summary,tests,aiObservations,exploratoryTrace:trace}
  result.regression=regression(result,await previousResult(run.dir))
  await writeFile(join(run.dir,'QA_RESULT.json'),JSON.stringify(result,null,2))
  await writeFile(join(run.dir,'console.log'),tests.flatMap((test)=>test.consoleErrors.map((error)=>`[${test.id}] ${error}`)).join('\n'))
  await writeFile(join(run.dir,'network.log'),tests.flatMap((test)=>test.networkErrors.map((error)=>`[${test.id}] ${JSON.stringify(error)}`)).join('\n'))
  const issues=tests.flatMap((test)=>test.issues.map((issue)=>({test,...issue})))
  const section=(severity)=>issues.filter((item)=>item.severity===severity).map((item)=>`### ${item.id||item.test.id}\n\n- Severity: ${severity}\n- Feature: ${item.test.title}\n- Steps: ${(item.steps??item.test.steps).join(' → ')}\n- Expected: ${item.expected??'Scenario assertions pass'}\n- Actual: ${item.description}\n- Component: ${item.component??'See scenario'}\n- Screenshot: ${item.screenshot??'—'}\n`).join('\n')||'None.'
  const markdown=`# BioScene QA Report\n\nBuild: ${run.commit}\nBranch: ${run.branch}\nDate: ${result.completedAt}\nMode: ${run.mode}\nQA STATUS: **${qaStatus}**\n\n## Summary\n\nTotal: ${summary.total} · Pass: ${summary.pass} · Fail: ${summary.fail} · Warnings: ${summary.warnings} · Skipped: ${summary.skipped}\n\n## Critical Issues\n\n${section('CRITICAL')}\n\n## Major Issues\n\n${section('MAJOR')}\n\n## Visual / UX Issues\n\n${section('VISUAL')}\n\n${section('UX')}\n\n## Regression Issues\n\n- New failures: ${result.regression.newFailures.join(', ')||'None'}\n- Resolved failures: ${result.regression.resolvedFailures.join(', ')||'None'}\n- Persistent failures: ${result.regression.persistentFailures.join(', ')||'None'}\n\n## Gemini Exploratory Findings\n\n${aiObservations.length?aiObservations.map((item)=>`- AI OBSERVATION: ${item.status} — ${(item.issues??[]).map((x)=>x.description).join('; ')||item.message||'No issue'}`).join('\n'):'Gemini review unavailable or disabled. Deterministic results completed.'}\n\n## Console Errors\n\n${tests.flatMap((test)=>test.consoleErrors).join('\n')||'None.'}\n\n## Network Errors\n\n${tests.flatMap((test)=>test.networkErrors.map((x)=>JSON.stringify(x))).join('\n')||'None.'}\n\n## Screenshot References\n\n${tests.flatMap((test)=>test.screenshots.map((path)=>`- ${relative(run.dir,path)}`)).join('\n')||'None.'}\n\n## Recommended Fix Priority\n\n1. Critical deterministic failures\n2. Major functional regressions\n3. Persistent failures\n4. Visual and UX observations\n`
  await writeFile(join(run.dir,'QA_REPORT.md'),markdown)
  return result
}
