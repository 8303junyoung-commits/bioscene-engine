import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { build, preview } from 'vite'
import { createResult, assertion } from '../result.mjs'

const slug=(value)=>value.replace(/[^A-Za-z0-9_-]+/g,'_')
const relevantNetwork=(url)=>/uniprot|ebi\.ac\.uk|alphafold|supabase|generativelanguage|\/assets\//i.test(url)

export async function createQaController(config,run) {
  process.env.VITE_BIOSCENE_QA='true'
  const qaOutDir=join(process.cwd(),'qa','.cache','dist')
  // QA runs the production bundle. This exercises the same optimized output
  // users receive and avoids development-only dependency pre-bundling drift.
  await build({
    configLoader:'runner',
    build:{outDir:qaOutDir,emptyOutDir:true},
    logLevel:'error',
  })
  const server=await preview({
    configLoader:'runner',
    build:{outDir:qaOutDir},
    preview:{host:'127.0.0.1',port:config.port,strictPort:true},
    clearScreen:false,
    logLevel:'error',
  })
  const { chromium }=await import('@playwright/test')
  const browser=await chromium.launch({headless:config.headless})
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,locale:'en-US',colorScheme:'light'})
  const page=await context.newPage(); const baseUrl=`http://127.0.0.1:${config.port}`
  let consoleErrors=[]; let networkErrors=[]; const starts=new Map()
  page.on('dialog',(dialog)=>dialog.accept())
  page.on('console',(message)=>{if(message.type()==='error') consoleErrors.push(message.text())})
  page.on('pageerror',(error)=>consoleErrors.push(`uncaught: ${error.message}`))
  page.on('request',(request)=>starts.set(request,Date.now()))
  page.on('requestfailed',(request)=>{networkErrors.push({url:request.url(),method:request.method(),status:0,error:request.failure()?.errorText??'request failed',duration:Date.now()-(starts.get(request)??Date.now())})})
  page.on('response',(response)=>{const request=response.request(); if(response.status()>=400&&relevantNetwork(response.url())) networkErrors.push({url:response.url(),method:request.method(),status:response.status(),error:response.statusText(),duration:Date.now()-(starts.get(request)??Date.now())})})

  const resetCollectors=()=>{consoleErrors=[];networkErrors=[];starts.clear()}
  const qaState=async(method,arg)=>page.evaluate(({method,arg})=>{const api=window.__BIOSCENE_QA__; if(!api) throw new Error('BioScene QA API unavailable'); const fn=api[method]; if(typeof fn!=='function') throw new Error(`Unknown QA method ${method}`); return fn.call(api,arg)}, {method,arg})
  const waitQa=async()=>page.waitForFunction(()=>window.__BIOSCENE_QA__?.version===1)
  const canvasPoint=async(offset={x:.5,y:.55})=>{const box=await page.locator('.react-flow__pane').boundingBox(); if(!box) throw new Error('React Flow pane unavailable'); return {x:box.x+box.width*offset.x,y:box.y+box.height*offset.y,box}}
  const screenshot=async(result,label)=>{const path=join(run.screenshots,`${result.id}_${slug(label)}.png`); await mkdir(run.screenshots,{recursive:true}); await page.screenshot({path,fullPage:false}); result.screenshots.push(path); return path}
  const assert=(result,name,condition,expected,actual)=>{result.assertions.push(assertion(name,!!condition,expected,actual)); if(!condition) throw new Error(`${name}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)}
  const step=async(result,name,action)=>{const started=Date.now(); try{const value=await action(); result.steps.push(`${name} (${Date.now()-started} ms)`); return value}catch(error){result.steps.push(`${name} FAILED (${Date.now()-started} ms)`); throw error}}

  const actions={
    page,baseUrl,qaState,waitQa,assert,step,screenshot,
    clickTestId:(id)=>page.getByTestId(id).click(),
    clickText:(text)=>page.getByText(text,{exact:true}).click(),
    typeText:(selector,value)=>page.locator(selector).fill(value),
    selectOption:(selector,value)=>page.locator(selector).selectOption(value),
    pressKey:(key)=>page.keyboard.press(key),
    waitForText:(text)=>page.getByText(text,{exact:false}).waitFor({state:'visible'}),
    waitForTestId:(id)=>page.getByTestId(id).waitFor({state:'visible'}),
    getVisibleText:()=>page.locator('body').innerText(),
    getConsoleErrors:()=>[...consoleErrors],getNetworkErrors:()=>[...networkErrors],
    async startEmpty(){
      await page.goto(baseUrl)
      await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()})
      await page.reload()
      await waitQa()
      await page.getByTestId('new-figure').click()
      await page.getByTestId('new-figure-scene').selectOption('empty')
      await page.getByTestId('start-empty-canvas').click()
      await page.getByRole('button',{name:/Create \/ Resize Workspace/}).click()
      await page.getByRole('dialog',{name:'Figure Workspace Setup'}).waitFor({state:'hidden'})
      await page.waitForTimeout(150)
    },
    async activateTool(tool){await page.getByTestId(`tool-${tool}`).click()},
    async drawMembrane(points){await actions.activateTool('freehand_membrane'); const {box}=await canvasPoint(); const absolute=points.map((point)=>({x:box.x+box.width*point.x,y:box.y+box.height*point.y})); await page.mouse.move(absolute[0].x,absolute[0].y); await page.mouse.down(); for(const point of absolute.slice(1)) await page.mouse.move(point.x,point.y,{steps:3}); await page.mouse.up(); await page.waitForTimeout(450)},
    async addObject(tool,offset){await actions.activateTool(tool); const point=await canvasPoint(offset); await page.mouse.click(point.x,point.y); await page.waitForTimeout(180)},
    async dragObject(id,targetOffset){const locator=page.locator(`.react-flow__node[data-id="${id}"]`); const box=await locator.boundingBox(); if(!box) throw new Error(`Object ${id} is not visible`); const point=await canvasPoint(targetOffset); await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(point.x,point.y,{steps:12}); await page.mouse.up(); await page.waitForTimeout(450)},
    async selectObject(id){await page.locator(`.react-flow__node[data-id="${id}"]`).click()},
    async deleteSelected(){await page.keyboard.press('Delete'); await page.waitForTimeout(450)},
    async undo(){await page.getByTestId('undo').click(); await page.waitForTimeout(450)},
    async redo(){await page.getByTestId('redo').click(); await page.waitForTimeout(450)},
    async openProteinSetup(){await page.getByTestId('protein-setup').click(); await page.getByRole('dialog',{name:'Protein and Construct Setup'}).waitFor()},
    async lookupUniProt(){await page.getByRole('button',{name:/Lookup UniProt/}).click()},
    async saveMolecule(){await page.getByRole('button',{name:/Save Molecule/}).click()},
    async saveJson(name='scene.json'){const downloadPromise=page.waitForEvent('download'); await page.getByTestId('save-json').click(); const download=await downloadPromise; const path=join(run.dir,name); await download.saveAs(path); return path},
    async loadJson(path){await page.locator('input[type=file][accept*="json"]').setInputFiles(path); await page.waitForTimeout(650)},
  }

  return {
    actions,
    async runScenario(meta,body){const result=createResult(meta); const started=Date.now(); resetCollectors(); try{await screenshot(result,'start'); await body(actions,result); result.status=result.assertions.some((item)=>!item.passed)?'FAIL':'PASS'}catch(error){result.status='FAIL'; const failure=await screenshot(result,'failure').catch(()=>undefined); result.issues.push({id:`${result.id}-FAIL`,severity:meta.severity??'MAJOR',description:error instanceof Error?error.message:String(error),steps:[...result.steps],expected:'Scenario completes with all deterministic assertions passing',component:meta.component,screenshot:failure});}finally{result.durationMs=Date.now()-started; result.consoleErrors=[...consoleErrors]; result.networkErrors=[...networkErrors]; const appErrors=await qaState('getAppErrors').catch(()=>[]); result.consoleErrors.push(...appErrors); if(result.status==='PASS'&&result.consoleErrors.length){result.status='FAIL';result.issues.push({id:`${result.id}-CONSOLE`,severity:'CRITICAL',description:`Unhandled application errors: ${result.consoleErrors.join('; ')}`,steps:[...result.steps],component:'Application runtime'})} await screenshot(result,'final').catch(()=>undefined)} return result},
    async close(){await context.close();await browser.close();await new Promise((resolve,reject)=>server.httpServer.close((error)=>error?reject(error):resolve()))},
  }
}
