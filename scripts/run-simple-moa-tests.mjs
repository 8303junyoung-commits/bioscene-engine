import { build } from 'vite'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const outDir=resolve('.test-simple-moa-dist')
await build({configFile:false,logLevel:'error',build:{ssr:resolve('tests/simpleMoa.test.ts'),outDir,emptyOutDir:true,rollupOptions:{output:{entryFileNames:'simple-moa.test.mjs'}}}})
try{await import(pathToFileURL(resolve(outDir,'simple-moa.test.mjs')).href)}finally{await rm(outDir,{recursive:true,force:true})}
