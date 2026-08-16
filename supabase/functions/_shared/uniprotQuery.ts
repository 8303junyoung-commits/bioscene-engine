const publicGeneAliases: Record<string, string> = {
  CD218A: 'IL18R1',
  IL18RA: 'IL18R1',
  IL18RB: 'IL18RAP',
}

export function canonicalUniProtGene(query: string) {
  const aliasKey = query
    .normalize('NFKC')
    .replace(/[αΑ]/g, 'A')
    .replace(/[βΒ]/g, 'B')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  return publicGeneAliases[aliasKey] ?? query.replace(/[^A-Za-z0-9_-]/g, '')
}

export function uniProtSearchExpression(query: string, organismId: number) {
  const safe = query.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  const canonical = canonicalUniProtGene(safe)
  return canonical
    ? `(reviewed:true) AND (organism_id:${organismId}) AND ((gene_exact:${canonical}) OR (gene:${canonical}) OR (${canonical}))`
    : `(reviewed:true) AND (organism_id:${organismId}) AND (${safe})`
}

