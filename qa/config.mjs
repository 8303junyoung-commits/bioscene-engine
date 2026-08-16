import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

for (const file of ['.env.local','.env']) {
  const path=resolve(file); if (!existsSync(path)) continue
  for (const line of readFileSync(path,'utf8').split(/\r?\n/)) {
    const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (!match||process.env[match[1]]!==undefined) continue
    process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2')
  }
}

const integer=(name,fallback,min=0,max=100000)=>Math.min(max,Math.max(min,Number.parseInt(process.env[name]??'',10)||fallback))
const enabled=(name)=>process.env[name]?.toLowerCase()==='true'

export const qaConfig={
  model:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite',
  apiKey:process.env.GEMINI_API_KEY||'',
  geminiEnabled:enabled('QA_GEMINI_ENABLED'),
  externalAi:enabled('QA_EXTERNAL_AI'),
  maxGeminiCalls:integer('QA_GEMINI_MAX_CALLS',3,0,20),
  maxGeminiTokens:integer('QA_GEMINI_MAX_TOKENS',2048,256,8192),
  maxExploratorySteps:integer('QA_EXPLORATORY_MAX_STEPS',20,1,30),
  maxExploratoryMinutes:integer('QA_EXPLORATORY_MAX_MINUTES',5,1,15),
  headless:process.env.QA_HEADLESS?.toLowerCase()!=='false',
  updateBaselines:enabled('QA_UPDATE_BASELINES'),
  port:integer('QA_PORT',4178,1024,65535),
}

export const externalAiReady=()=>qaConfig.geminiEnabled&&qaConfig.externalAi&&!!qaConfig.apiKey
