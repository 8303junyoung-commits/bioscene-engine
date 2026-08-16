import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { externalAiReady, qaConfig } from '../config.mjs'

const cacheDir=resolve('qa/.cache/gemini')

export class GeminiQaClient {
  constructor(config=qaConfig){this.config=config;this.calls=0}
  available(){return externalAiReady()&&this.calls<this.config.maxGeminiCalls}
  async generateJson({prompt,schema,imagePath,cacheKey}) {
    if(!this.available()) return {unavailable:true,message:externalAiReady()?'Gemini call budget exhausted.':'Gemini disabled, external AI not authorized, or API key missing.'}
    if(!/^[A-Za-z0-9._-]+$/.test(this.config.model)) throw new Error('Invalid GEMINI_MODEL')
    const image=imagePath?await readFile(imagePath):undefined; const hash=createHash('sha256').update(cacheKey??prompt).update(image??'').digest('hex'); const path=join(cacheDir,`${hash}.json`)
    if(existsSync(path)) return JSON.parse(await readFile(path,'utf8'))
    const parts=[{text:prompt}]; if(image) parts.push({inlineData:{mimeType:'image/png',data:image.toString('base64')}})
    this.calls+=1
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':this.config.apiKey},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:this.config.maxGeminiTokens,temperature:.15}})})
    if(!response.ok) throw new Error(`Gemini API ${response.status}: ${(await response.text()).slice(0,500)}`)
    const payload=await response.json(); const text=payload.candidates?.[0]?.content?.parts?.map((part)=>part.text??'').join('')
    if(!text) throw new Error('Gemini returned no structured content')
    const result=JSON.parse(text); await mkdir(cacheDir,{recursive:true}); await writeFile(path,JSON.stringify(result,null,2)); return result
  }
}

export const visualReviewSchema={type:'object',required:['status','issues','overallReadability'],properties:{status:{type:'string',enum:['PASS','WARNING','FAIL']},issues:{type:'array',items:{type:'object',required:['severity','description','confidence','category'],properties:{severity:{type:'string',enum:['VISUAL','UX']},category:{type:'string',enum:['overlap','clipping','alignment','label_readability','molecule_identity','membrane_relationship','arrow_clarity','hierarchy','ux_confusion','other']},description:{type:'string'},confidence:{type:'number',minimum:0,maximum:1},suggestedComponent:{type:'string'}}}},overallReadability:{type:'integer',minimum:1,maximum:10},message:{type:'string'}}}

export const exploratoryActionSchema={type:'object',required:['action','target','rationale','done'],properties:{action:{type:'string',enum:['click','type','select','drag','press','wait','inspect','screenshot','finish']},target:{type:'string',enum:['new_figure','empty_canvas','membrane_tool','protein_tool','antibody_tool','ligand_tool','protein_setup','molecule_names','entity_class','topology','save_molecule','undo','redo','save_json','workspace','canvas','selected_object','none']},value:{type:'string'},rationale:{type:'string'},done:{type:'boolean'}}}
