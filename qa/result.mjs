export const statuses=['PASS','FAIL','WARNING','SKIPPED']
export const severities=['CRITICAL','MAJOR','MINOR','VISUAL','UX']

export function createResult(meta) {
  return { id:meta.id,title:meta.title,tags:meta.tags??[],critical:!!meta.critical,status:'PASS',severity:meta.severity??'MAJOR',durationMs:0,steps:[],assertions:[],consoleErrors:[],networkErrors:[],screenshots:[],issues:[] }
}

export const assertion=(name,passed,expected,actual)=>({name,passed,expected,actual})
