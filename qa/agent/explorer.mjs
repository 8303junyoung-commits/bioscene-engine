import { GeminiQaClient, exploratoryActionSchema } from './geminiClient.mjs'
import { qaConfig } from '../config.mjs'

const targets={new_figure:['testid','new-figure'],empty_canvas:['testid','start-empty-canvas'],membrane_tool:['testid','tool-freehand_membrane'],protein_tool:['testid','tool-place_receptor'],antibody_tool:['testid','tool-place_antibody'],ligand_tool:['testid','tool-place_ligand'],protein_setup:['testid','protein-setup'],undo:['testid','undo'],redo:['testid','redo'],save_json:['testid','save-json'],workspace:['role','Workspace'],save_molecule:['role','Save Molecule']}
const selectFields={entity_class:'Entity Class',topology:'Topology'}

async function applyAction(a,step) {
  if(step.action==='finish'||step.done) return
  if(step.action==='wait'){await a.page.waitForTimeout(Math.min(3000,Math.max(100,Number(step.value)||500)));return}
  if(step.action==='screenshot'||step.action==='inspect') return
  if(step.action==='press'){const allowed=['Escape','Delete','Control+z','Control+y']; if(!allowed.includes(step.value)) throw new Error('Planner requested a non-whitelisted key'); await a.pressKey(step.value);return}
  if(step.action==='drag'&&step.target==='canvas'){await a.drawMembrane([{x:.3,y:.5},{x:.4,y:.46},{x:.5,y:.51},{x:.62,y:.48}]);return}
  if(step.action==='type'&&step.target==='molecule_names'){await a.page.locator('.molecule-library textarea').fill((step.value??'').slice(0,120));return}
  if(step.action==='select'&&selectFields[step.target]){await a.page.getByLabel(selectFields[step.target],{exact:true}).selectOption((step.value??'').slice(0,80));return}
  if(step.action==='click'&&targets[step.target]){const [kind,value]=targets[step.target]; if(kind==='testid') await a.page.getByTestId(value).click(); else await a.page.getByRole('button',{name:new RegExp(value,'i')}).click(); return}
  if(step.action==='click'&&step.target==='canvas'){const box=await a.page.locator('.react-flow__pane').boundingBox(); if(!box) throw new Error('Canvas unavailable'); await a.page.mouse.click(box.x+box.width*.55,box.y+box.height*.55);return}
  throw new Error(`Planner action is outside whitelist: ${step.action}/${step.target}`)
}

export async function runExploratoryMission(a,result,mission,client=new GeminiQaClient()) {
  const trace=[]; const deadline=Date.now()+qaConfig.maxExploratoryMinutes*60_000
  await a.startEmpty()
  for(let index=0;index<qaConfig.maxExploratorySteps&&Date.now()<deadline;index+=1){
    const visible=(await a.getVisibleText()).slice(0,12000); const state={objects:await a.qaState('getSceneObjects'),molecules:await a.qaState('getMoleculeDefinitions'),workspace:await a.qaState('getWorkspace')}
    const prompt=`MISSION: ${mission}\nAct like a first-time biomedical researcher. Choose exactly one action from the whitelist schema. Use visible UI only and never request JavaScript, shell, URLs, secrets, or arbitrary selectors. Record a concise action rationale, not chain-of-thought. Stop when the mission is complete or a dead end is clear.\n\nVisible UI:\n${visible}\n\nInstrument summary:\n${JSON.stringify({objectCount:state.objects.length,moleculeNames:state.molecules.map((x)=>x.name),workspace:state.workspace})}`
    const next=await client.generateJson({prompt,schema:exploratoryActionSchema,cacheKey:`explore-v1:${mission}:${index}:${visible}:${JSON.stringify(state)}`})
    if(next.unavailable){trace.push({step:index+1,action:'stop',rationale:next.message});break}
    trace.push({step:index+1,action:`${next.action}:${next.target}${next.value?`=${next.value}`:''}`,rationale:next.rationale})
    await applyAction(a,next); if(next.done||next.action==='finish') break
    if(next.action==='screenshot') await a.screenshot(result,`explore_${index+1}`)
    await a.page.waitForTimeout(120)
  }
  return trace
}
