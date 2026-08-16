import { build } from 'vite'
import { rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const outDir = resolve('.test-dist')
await build({
  configFile: false,
  logLevel: 'error',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
  },
  build: {
    ssr: resolve('tests/uniprot.test.ts'),
    outDir,
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'uniprot.test.mjs' } },
  },
})
try { await import(pathToFileURL(resolve(outDir,'uniprot.test.mjs')).href) } finally { await rm(outDir,{recursive:true,force:true}) }

