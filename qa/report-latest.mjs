import { readdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const root=resolve('qa/reports'); const dirs=(await readdir(root,{withFileTypes:true})).filter((entry)=>entry.isDirectory()).map((entry)=>entry.name).sort().reverse()
if(!dirs.length) throw new Error('No QA reports found. Run pnpm qa:smoke first.')
console.log(await readFile(join(root,dirs[0],'QA_REPORT.md'),'utf8'))
