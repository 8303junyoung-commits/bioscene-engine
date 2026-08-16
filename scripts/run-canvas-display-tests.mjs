import { build } from 'vite'
import { rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const outDir = resolve('.test-canvas-dist')
await build({ configFile:false, logLevel:'error', build:{ ssr:resolve('tests/canvasDisplay.test.ts'), outDir, emptyOutDir:true, rollupOptions:{ output:{ entryFileNames:'canvas-display.test.mjs' } } } })
try { await import(pathToFileURL(resolve(outDir,'canvas-display.test.mjs')).href) } finally { await rm(outDir,{recursive:true,force:true}) }
