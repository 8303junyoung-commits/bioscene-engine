import { strict as assert } from 'node:assert'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import JSZip from 'jszip'
import { createQaController } from './playwright/controller.mjs'
import { qaConfig } from './config.mjs'

// All scenes are built with real UI actions. Save/Load uses the application's
// downloaded files; no scene injection or QA creation helpers are used.
const dir=resolve(process.env.BLOCK_REPORT_DIR || 'qa/reports/block-rendering')
await mkdir(dir,{recursive:true})
const controller=await createQaController({...qaConfig,port:4191},{dir,screenshots:dir})
const {page,baseUrl}=controller.actions
const results=[]
page.setDefaultTimeout(5000)
async function click(name){await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(180)}
async function molecule(name){const box=await page.getByRole('img',{name:`${name} molecule illustration`,exact:true}).first().boundingBox();assert(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(180)}
async function download(button,name){const pending=page.waitForEvent('download');await click(button);await(await pending).saveAs(resolve(dir,name));return resolve(dir,name)}
async function save(name){return JSON.parse(await readFile(await download('Save',name),'utf8'))}
async function pixels(buffer){const p=await page.context().newPage();try{await p.setContent(`<img src="data:image/png;base64,${buffer.toString('base64')}">`);return await p.locator('img').evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;let red=0;for(let i=0;i<a.length;i+=4)if(a[i]>130&&a[i]>a[i+1]*1.4&&a[i]>a[i+2]*1.4&&a[i+3]>100)red++;return red})}finally{await p.close()}}
async function visibleBlock(edge){const group=page.locator(`.react-flow__edge[data-id="${edge.id}"]`);await group.waitFor({state:'attached'});assert.equal(await group.locator('.inhibition-mark').count(),1);const p=group.locator('.react-flow__edge-path');assert(await p.evaluate(e=>e.getTotalLength()>5));assert((await p.getAttribute('marker-end')).includes(`inhibitory-${edge.id}`));return group}
async function exports(name,edge){
  await page.getByLabel('Export format').selectOption('svg');const svgPath=await download('Export Blueprint',`${name}.svg`);const svg=await readFile(svgPath,'utf8');assert(svg.includes(`inhibitory-${edge.id}`));assert(svg.includes('inhibition-mark'));assert(!svg.includes('class="bio-handle'));
  const viewer=await page.context().newPage();await viewer.setViewportSize({width:1920,height:1080});await viewer.goto('file://'+svgPath);const svgShot=await viewer.screenshot({path:resolve(dir,`${name}-svg-opened.png`)});await viewer.close();assert(await pixels(svgShot)>30,'SVG must paint visible red BLOCK semantics');
  await page.getByLabel('Export format').selectOption('png');const pngPath=await download('Export Blueprint',`${name}.png`);assert(await pixels(await readFile(pngPath))>30,'PNG must paint visible red BLOCK semantics');
  await page.getByLabel('Export format').selectOption('package');const zipPath=await download('Export Blueprint',`${name}.zip`);const zip=await JSZip.loadAsync(await readFile(zipPath));assert.deepEqual(Object.keys(zip.files).sort(),['scene.json','scene.svg','scene_prompt.md']);const packagedSvg=await zip.file('scene.svg').async('string');assert(packagedSvg.includes(`inhibitory-${edge.id}`));const packed=JSON.parse(await zip.file('scene.json').async('string'));assert(packed.edges.some(e=>e.id===edge.id&&e.data.interaction==='BLOCK'));await writeFile(resolve(dir,`${name}-package.svg`),packagedSvg);
  const v=await page.context().newPage();await v.setViewportSize({width:1920,height:1080});await v.goto('file://'+resolve(dir,`${name}-package.svg`));const image=await v.screenshot({path:resolve(dir,`${name}-package-opened.png`)});await v.close();assert(await pixels(image)>30,'Package SVG must paint BLOCK');
}
try {
 for(const name of ['pd1','il18rb','cytokine','signal-edge']) {
  const result={name,status:'RUNNING'};results.push(result)
  try {
   // A new origin storage state in this isolated test browser; never user data.
   await page.goto(baseUrl);await page.evaluate(()=>localStorage.clear());await page.reload();await click('Build a MoA →');await click(name==='pd1'?'T cell':'NK cell')
   const target=name==='pd1'?'PD-1':name==='il18rb'?'IL18RB':name==='cytokine'?'IL-18':'IL18RA'
   await click(target);if(name==='signal-edge')await click('MyD88');await click('Generate')
   if(name==='signal-edge'){await click('Signal');await molecule('IL18RA');await molecule('MyD88')}
   await click('+ Add Drug / Ligand');const drug=`anti-${target}`
   if(name==='cytokine'){await page.getByLabel('Drug name').fill(drug);await page.getByLabel('Target A',{exact:true}).fill(target);await click('Add to scene')}else await click(drug)
   let signal
   if(name==='signal-edge'){
    const scene=await save(`${name}-before.json`);signal=scene.edges.find(e=>e.data.interaction==='ACTIVATE');assert(signal)
    await click('Block');await molecule(drug)
    const point=await page.locator(`.react-flow__edge[data-id="${signal.id}"] .react-flow__edge-interaction`).evaluate(path=>{for(const t of [.6,.7,.5,.4,.8]){const p=path.getPointAtLength(path.getTotalLength()*t);const s=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());if(document.elementFromPoint(s.x,s.y)?.closest('.react-flow__edge')===path.closest('.react-flow__edge'))return{x:s.x,y:s.y}}throw new Error('No exposed Signal edge point')});await page.mouse.click(point.x,point.y);await page.waitForTimeout(350)
   }else await click('Show blockade')
   const scene=await save(`${name}.json`);const edge=scene.edges.find(e=>e.data.interaction==='BLOCK');assert(edge);if(signal)assert.equal(edge.data.blockedEdgeId,signal.id)
   await page.screenshot({path:resolve(dir,`${name}-canvas.png`)});await visibleBlock(edge);assert(await pixels(await page.screenshot())>30)
   if(signal){const distance=await page.locator(`.react-flow__edge[data-id="${edge.id}"] .react-flow__edge-path`).evaluate((block,id)=>{const line=document.querySelector(`.react-flow__edge[data-id="${id}"] .react-flow__edge-path`);const end=block.getPointAtLength(block.getTotalLength());let distance=Infinity;for(let i=0;i<=1000;i++){const p=line.getPointAtLength(line.getTotalLength()*i/1000);distance=Math.min(distance,Math.hypot(p.x-end.x,p.y-end.y))}return distance},signal.id);assert(distance<1,'Block must terminate ON the actual targeted Signal path');result.edgeIntersectionDistance=distance}
   // Remove the old mounted nodes first so load truly reconstructs handles.
   await click('New MoA');await page.locator('input[type=file]').setInputFiles(resolve(dir,`${name}.json`));await page.waitForTimeout(500);await visibleBlock(edge);const loaded=await save(`${name}-loaded.json`);assert.deepEqual(loaded.edges.map(e=>({id:e.id,data:e.data})),scene.edges.map(e=>({id:e.id,data:e.data})))
   await exports(name,edge);result.status='PASS'
  }catch(error){result.status='FAIL';result.error=String(error);await page.screenshot({path:resolve(dir,`${name}-failure.png`)});process.exitCode=1}
  console.log(JSON.stringify(result))
 }
}finally{await writeFile(resolve(dir,'results.json'),JSON.stringify(results,null,2));await controller.close()}
