import { createBioData } from './biology'
import { regionBoundsFor } from './utils'
import { markerForInteraction } from './visualGrammar'
import type { BioEdge, BioKind, BioNode, BioNodePatch, Compartment, InteractionType, MechanismEntity, MechanismInteraction, MechanismPanel, PanelId, ParsedMechanism } from './types'

interface EntitySpec { id: string; label: string; kind: BioKind; pattern: RegExp; compartment?: Compartment; target?: string }

const entitySpecs: EntitySpec[] = [
  { id: 'nk-cell', label: 'NK cell', kind: 'cell', pattern: /\bnk[\s-]?cells?\b|자연살해세포/i },
  { id: 'cd8-t-cell', label: 'CD8 T cell', kind: 'cell', pattern: /\bcd8(?:\+)?[\s-]?t[\s-]?cells?\b|세포독성\s*t\s*세포/i },
  { id: 't-cell', label: 'T cell', kind: 'cell', pattern: /\bt[\s-]?cells?\b|t\s*세포/i },
  { id: 'hepatocyte', label: 'Hepatocyte', kind: 'cell', pattern: /\bhepatocytes?\b|간세포/i },
  { id: 'tumor-cell', label: 'Tumor cell', kind: 'cell', pattern: /\btumou?r[\s-]?cells?\b|암세포|종양세포/i },
  { id: 'epithelial-cell', label: 'Epithelial cell', kind: 'cell', pattern: /\bepithelial[\s-]?cells?\b|상피세포/i },
  { id: 'slc7020', label: 'SLC-7020', kind: 'antibody', pattern: /\bslc[\s-]?7020\b/i },
  { id: 'il18ra', label: 'IL-18Rα', kind: 'receptor', pattern: /\bil[\s-]?18r(?:α|a|alpha)\b|\bil18ra\b/i, target: 'IL18RA' },
  { id: 'il18rb', label: 'IL-18Rβ', kind: 'receptor', pattern: /\bil[\s-]?18r(?:β|b|beta)\b|\bil18rb\b|\bil18rap\b/i, target: 'IL18RAP' },
  { id: 'il18', label: 'IL-18', kind: 'ligand', pattern: /\bil[\s-]?18(?!r|bp)\b/i },
  { id: 'il18bp', label: 'IL-18BP', kind: 'ligand', pattern: /\bil[\s-]?18bp\b/i },
  { id: 'il2', label: 'IL-2', kind: 'ligand', pattern: /\bil[\s-]?2(?!r|\d)\b/i },
  { id: 'il2r', label: 'IL-2R', kind: 'receptor', pattern: /\bil[\s-]?2r(?:α|a|beta|β|gamma|γ)?\b|\bcd25\b/i, target: 'IL2R' },
  { id: 'il6', label: 'IL-6', kind: 'ligand', pattern: /\bil[\s-]?6(?!r|\d)\b/i },
  { id: 'il6r', label: 'IL-6R', kind: 'receptor', pattern: /\bil[\s-]?6r\b/i, target: 'IL6R' },
  { id: 'gp130', label: 'gp130', kind: 'receptor', pattern: /\bgp[\s-]?130\b|\bil6st\b/i, target: 'IL6ST' },
  { id: 'il11', label: 'IL-11', kind: 'ligand', pattern: /\bil[\s-]?11(?!r|\d)\b/i },
  { id: 'egf', label: 'EGF', kind: 'ligand', pattern: /\begf\b/i },
  { id: 'egfr', label: 'EGFR', kind: 'receptor', pattern: /\begfr\b/i, target: 'EGFR' },
  { id: 'pdl1', label: 'PD-L1', kind: 'receptor', pattern: /\bpd[\s-]?l1\b|\bcd274\b/i, target: 'CD274' },
  { id: 'pd1', label: 'PD-1', kind: 'receptor', pattern: /\bpd[\s-]?1\b|\bpdcd1\b/i, target: 'PDCD1' },
  { id: 'dr3', label: 'DR3', kind: 'receptor', pattern: /\bdr[\s-]?3\b|\btnfrsf25\b/i, target: 'TNFRSF25' },
  { id: 'tcr', label: 'TCR', kind: 'receptor', pattern: /\btcr\b|t[\s-]?cell receptor/i, target: 'TCR' },
  { id: 'pmhc', label: 'pMHC', kind: 'ligand', pattern: /\bpmhc\b|peptide[\s-]?mhc|항원[\s-]?mhc/i },
  { id: 'tnf', label: 'TNF', kind: 'ligand', pattern: /\btnf(?:-?alpha|α)?\b/i },
  { id: 'tnfr', label: 'TNFR', kind: 'receptor', pattern: /\btnfr(?:1|2|sf\d+)?\b/i, target: 'TNFR' },
  { id: 'ifng', label: 'IFN-γ', kind: 'ligand', pattern: /\bifn[\s-]?(?:gamma|γ|g)\b/i },
  { id: 'ifngr', label: 'IFN-γR', kind: 'receptor', pattern: /\bifn[\s-]?(?:gamma|γ|g)?r\d?\b|\bifngr\d?\b/i, target: 'IFNGR' },
  { id: 'tgfb', label: 'TGF-β', kind: 'ligand', pattern: /\btgf[\s-]?(?:beta|β|b)\b/i },
  { id: 'tgfbr', label: 'TGF-βR', kind: 'receptor', pattern: /\btgf[\s-]?(?:beta|β|b)?r[12]?\b|\btgfbr[12]?\b/i, target: 'TGFBR' },
  { id: 'vegf', label: 'VEGF', kind: 'ligand', pattern: /\bvegf[abc]?\b/i },
  { id: 'vegfr', label: 'VEGFR', kind: 'receptor', pattern: /\bvegfr[123]?\b|\bkdr\b/i, target: 'VEGFR' },
  { id: 'myd88', label: 'MyD88 / IRAK', kind: 'signal', pattern: /\bmyd88\b|\birak\b/i },
  { id: 'stat5', label: 'STAT5', kind: 'transcription', pattern: /\bstat[\s-]?5\b/i },
  { id: 'stat3', label: 'STAT3', kind: 'transcription', pattern: /\bstat[\s-]?3\b/i },
  { id: 'zap70', label: 'ZAP70', kind: 'signal', pattern: /\bzap[\s-]?70\b/i },
  { id: 'erk', label: 'ERK', kind: 'signal', pattern: /\berk(?:1\/2)?\b/i },
  { id: 'shp2', label: 'SHP2', kind: 'signal', pattern: /\bshp[\s-]?2\b|\bptpn11\b/i },
  { id: 'jak', label: 'JAK', kind: 'signal', pattern: /\bjak[123]?\b/i },
  { id: 'pi3k', label: 'PI3K', kind: 'signal', pattern: /\bpi3k\b/i },
  { id: 'akt', label: 'AKT', kind: 'signal', pattern: /\bakt[123]?\b/i },
  { id: 'mtor', label: 'mTOR', kind: 'signal', pattern: /\bmtor\b/i },
  { id: 'smad', label: 'SMAD2/3', kind: 'transcription', pattern: /\bsmad[\s-]?(?:2\/?3|2|3)\b/i },
  { id: 'foxo3', label: 'FOXO3', kind: 'transcription', pattern: /\bfoxo3a?\b/i },
  { id: 'p53', label: 'p53', kind: 'transcription', pattern: /\bp53\b|\btp53\b/i },
  { id: 'nfkb', label: 'NF-κB', kind: 'transcription', pattern: /\bnf[\s-]?(?:κ|kappa|k)b\b|\bnfkb\b/i },
  { id: 'nfat', label: 'NFAT', kind: 'transcription', pattern: /\bnfat\b/i },
]

const comparisonPattern = /untreated|treated|2[\s-]?panel|two[\s-]?panel|비교|처리군|미처리|\bvs\.?\b/i
const downstreamPattern = /downstream|signal(?:ing)?|inflammat|하위\s*신호|신호전달|염증/i
const relationSpecs: Array<{ type: InteractionType; pattern: RegExp }> = [
  { type: 'SIGNAL_ABSENT', pattern: /signal\s+(?:is\s+)?absent|no\s+(?:downstream\s+)?signal|신호\s*부재/i },
  { type: 'PHOSPHORYLATE', pattern: /phosphorylat(?:e|es|ed|ion)|인산화/i },
  { type: 'TRANSLOCATE', pattern: /translocat(?:e|es|ed|ion)|nuclear\s+translocation|핵(?:으로)?\s*이동/i },
  { type: 'INTERNALIZE', pattern: /internali[sz](?:e|es|ed|ation)|내재화/i },
  { type: 'DIMERIZE', pattern: /dimeri[sz](?:e|es|ed|ation)|이합체/i },
  { type: 'RECRUIT', pattern: /recruit(?:s|ed|ment)?|모집/i },
  { type: 'AGONIZE', pattern: /agoni[sz](?:e|es|ed)|agonist|효능제/i },
  { type: 'CLUSTER', pattern: /cluster(?:s|ed|ing)?|군집화/i },
  { type: 'COMPETE', pattern: /compete(?:s|d)?|competition|경쟁/i },
  { type: 'DEGRADE', pattern: /degrad(?:e|es|ed|ation)|분해/i },
  { type: 'CLEAVE', pattern: /cleav(?:e|es|ed|age)|절단/i },
  { type: 'SECRETE', pattern: /secret(?:e|es|ed|ion)|분비/i },
  { type: 'EXPRESS', pattern: /express(?:es|ed|ion)?|발현/i },
  { type: 'BLOCK', pattern: /block(?:s|ed|ade)?|neutraliz(?:e|es|ed|ation)|차단|중화/i },
  { type: 'INHIBIT', pattern: /inhibit(?:s|ed|ion)?|suppress(?:es|ed|ion)?|억제/i },
  { type: 'ACTIVATE', pattern: /activat(?:e|es|ed|ion)|stimulat(?:e|es|ed|ion)|활성화/i },
  { type: 'BIND', pattern: /bind(?:s|ing|bound)?|engag(?:e|es|ed|ement)|결합/i },
]

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const interaction = (id: string, source: string, target: string, type: InteractionType, panel: MechanismPanel, sourceText?: string): MechanismInteraction => ({ id, source, target, interaction: type, panel, sourceText })

export function parseMechanism(input: string): ParsedMechanism {
  const normalized = input.trim()
  const entities: MechanismEntity[] = []
  const entityIds = new Set<string>()
  const add = (entity: MechanismEntity) => { if (!entityIds.has(entity.id)) { entities.push(entity); entityIds.add(entity.id) } }
  for (const spec of entitySpecs) if (spec.pattern.test(normalized)) add({ id: spec.id, label: spec.label, kind: spec.kind, source: 'explicit', compartment: spec.compartment, target: spec.target })

  for (const match of normalized.matchAll(/\bSLC[-\s]?(\d{4})\b/gi)) {
    const id = `slc${match[1]}`
    if (!entityIds.has(id)) add({ id, label: `SLC-${match[1]}`, kind: 'antibody', source: 'explicit' })
  }

  for (const match of normalized.matchAll(/\banti[-\s]?([A-Za-z][A-Za-z0-9-]{1,20})\b/gi)) {
    const targetLabel = match[1].toUpperCase()
    const knownTarget = entitySpecs.find((spec) => spec.pattern.test(targetLabel))
    const targetId = knownTarget?.id ?? slug(targetLabel)
    if (!entityIds.has(targetId)) add({ id: targetId, label: knownTarget?.label ?? targetLabel, kind: 'receptor', source: 'explicit', target: knownTarget?.target ?? targetLabel })
    add({ id: `anti-${targetId}`, label: `anti-${knownTarget?.label ?? targetLabel}`, kind: 'antibody', source: 'explicit', target: knownTarget?.target ?? targetLabel })
  }

  const infer = (id: string, fallback?: MechanismEntity) => {
    if (entityIds.has(id)) return
    const spec = entitySpecs.find((item) => item.id === id)
    if (spec) add({ id: spec.id, label: spec.label, kind: spec.kind, source: 'inferred', compartment: spec.compartment, target: spec.target })
    else if (fallback) add({ ...fallback, source: 'inferred' })
  }
  if (!entities.some((entity) => entity.kind === 'cell')) infer('target-cell', { id: 'target-cell', label: 'Target cell', kind: 'cell', source: 'inferred' })
  if ((entityIds.has('il18') || entityIds.has('slc7020')) && !entityIds.has('il18ra')) infer('il18ra')
  if ((entityIds.has('il18') || entityIds.has('slc7020')) && !entityIds.has('il18rb')) infer('il18rb')
  if ((downstreamPattern.test(normalized) || entityIds.has('il18rb')) && (entityIds.has('il18') || entityIds.has('slc7020'))) { infer('myd88'); infer('nfkb') }
  if (entityIds.has('il2') && entityIds.has('stat5')) infer('il2r')
  if (entityIds.has('il6') && entityIds.has('stat3')) { infer('il6r'); infer('gp130') }
  if (entityIds.has('egf') && entityIds.has('erk')) infer('egfr')
  if (entityIds.has('pmhc') && entityIds.has('zap70')) infer('tcr')

  const comparison = comparisonPattern.test(normalized)
  const blockedSingle = !comparison && entityIds.has('slc7020')
  const activePanel: MechanismPanel = comparison ? 'untreated' : 'single'
  const interactions: MechanismInteraction[] = []
  const edgeKeys = new Set<string>()
  const addEdge = (edge: MechanismInteraction) => { const key = `${edge.source}|${edge.target}|${edge.interaction}|${edge.panel}`; if (!edgeKeys.has(key)) { interactions.push(edge); edgeKeys.add(key) } }
  const known = (source: string, target: string, type: InteractionType, panel: MechanismPanel = activePanel, note?: string) => { if (entityIds.has(source) && entityIds.has(target)) addEdge(interaction(`${source}-${type.toLowerCase()}-${target}`, source, target, type, panel, note)) }

  known('il18', 'il18ra', 'BIND', comparison ? 'both' : 'single', 'IL-18 receptor binding')
  if (!blockedSingle) known('il18ra', 'il18rb', 'ACTIVATE', activePanel, 'Receptor complex formation')
  if (entityIds.has('il18rb') && entityIds.has('myd88')) known('il18rb', 'myd88', blockedSingle ? 'SIGNAL_ABSENT' : 'ACTIVATE', activePanel, blockedSingle ? 'No downstream signal after receptor blockade' : 'Downstream signaling')
  if (entityIds.has('myd88') && entityIds.has('nfkb')) known('myd88', 'nfkb', blockedSingle ? 'SIGNAL_ABSENT' : 'TRANSLOCATE', activePanel, blockedSingle ? 'No NF-κB nuclear translocation' : 'Nuclear inflammatory program')
  known('slc7020', 'il18rb', 'BLOCK', comparison ? 'treated' : 'single', 'Therapeutic receptor blockade')
  if (comparison && entityIds.has('slc7020')) { known('il18rb', 'myd88', 'SIGNAL_ABSENT', 'treated', 'No downstream signal after receptor blockade'); known('myd88', 'nfkb', 'SIGNAL_ABSENT', 'treated', 'No NF-κB nuclear translocation') }
  known('il2', 'il2r', 'BIND', activePanel, 'IL-2 receptor engagement'); known('il2r', 'stat5', 'ACTIVATE', activePanel, 'JAK/STAT5 signaling')
  known('il6', 'il6r', 'BIND', activePanel, 'IL-6 receptor engagement'); known('il6r', 'gp130', 'DIMERIZE', activePanel, 'gp130 receptor complex'); known('gp130', 'stat3', 'PHOSPHORYLATE', activePanel, 'STAT3 signaling')
  known('egf', 'egfr', 'BIND', activePanel, 'EGF receptor engagement'); known('egfr', 'erk', 'ACTIVATE', activePanel, 'MAPK signaling')
  known('pmhc', 'tcr', 'BIND', activePanel, 'Antigen recognition'); known('tcr', 'zap70', 'PHOSPHORYLATE', activePanel, 'TCR proximal signaling')

  const mentionPositions = (sentence: string, entity: MechanismEntity) => {
    const spec = entitySpecs.find((item) => item.id === entity.id)
    const source = spec?.pattern.source ?? `\\b${escapeRegExp(entity.label)}\\b`
    const flags = spec?.pattern.flags.replace('g', '') ?? 'i'
    return Array.from(sentence.matchAll(new RegExp(source, `${flags}g`))).flatMap((match) => {
      const index = match.index ?? -1
      if (entity.kind === 'receptor' && /anti[-\s]?$/i.test(sentence.slice(Math.max(0, index - 6), index))) return []
      return index >= 0 ? [index] : []
    })
  }
  for (const sentence of normalized.split(/(?<=[.!?;])\s+|[,;]\s*/)) {
    for (const relation of relationSpecs) {
      const verb = sentence.match(relation.pattern); if (verb?.index === undefined) continue
      const mentions = entities.flatMap((entity) => mentionPositions(sentence, entity).map((index) => ({ entity, index }))).filter((item) => item.entity.kind !== 'cell').sort((a, b) => a.index - b.index)
      const source = mentions.filter((item) => item.index < verb.index!).at(-1)?.entity
      const target = mentions.find((item) => item.index > verb.index!)?.entity
      if (!source || !target || source.id === target.id) continue
      if (source.kind === 'ligand' && ['signal', 'transcription'].includes(target.kind) && ['il18', 'il2', 'il6', 'egf', 'pmhc'].includes(source.id)) continue
      const panel: MechanismPanel = comparison ? (source.kind === 'antibody' ? 'treated' : 'untreated') : 'single'
      addEdge(interaction(`${source.id}-${relation.type.toLowerCase()}-${target.id}`, source.id, target.id, relation.type, panel, sentence.trim()))
    }
  }

  const warnings: string[] = []
  if (!normalized) warnings.push('Enter a mechanism description')
  if (!interactions.length && normalized) warnings.push('No typed interaction was recognized; add an interaction verb such as binds, activates, inhibits, blocks, or phosphorylates')
  return { title: comparison ? 'Generated MoA · untreated vs treated' : `Generated mechanism · ${normalized.slice(0, 54) || 'untitled'}`, input: normalized, templateId: comparison ? 'receptor-blockade-comparison' : 'receptor-blockade-single', entities, interactions, warnings }
}

function nodeOverrides(entity: MechanismEntity, panelId: PanelId, blockedPanel: boolean, mechanism: ParsedMechanism): BioNodePatch {
  const treated = panelId === 'treated' || blockedPanel
  const incoming = mechanism.interactions.filter((edge) => edge.target === entity.id && (edge.panel === panelId || edge.panel === 'both' || panelId === 'single'))
  const outgoing = mechanism.interactions.filter((edge) => edge.source === entity.id && (edge.panel === panelId || edge.panel === 'both' || panelId === 'single'))
  if (entity.id === 'il18') return { subtitle: treated ? 'ligand present' : 'available ligand' }
  if (entity.id === 'slc7020') return { subtitle: 'blocking antibody', state: 'state:antibody:bound' }
  if (entity.id === 'il18rb') return { target: entity.target, state: treated ? 'state:receptor:blocked' : 'state:receptor:active' }
  if (entity.id === 'myd88') return { subtitle: treated ? 'signal suppressed' : 'active signalosome', state: treated ? 'state:signal:inactive' : 'state:signal:active' }
  if (entity.id === 'nfkb' && treated) return { subtitle: 'retained in cytoplasm', compartment: 'cytoplasm', state: 'state:transcription:cytoplasmic' }
  if (entity.kind === 'receptor' && incoming.some((edge) => edge.interaction === 'BLOCK')) return { target: entity.target, state: 'state:receptor:blocked' }
  if (entity.kind === 'receptor' && (incoming.length || outgoing.length)) return { target: entity.target, state: 'state:receptor:active' }
  if (entity.kind === 'signal' && (incoming.some((edge) => ['ACTIVATE', 'PHOSPHORYLATE'].includes(edge.interaction)) || outgoing.some((edge) => ['ACTIVATE', 'PHOSPHORYLATE', 'TRANSLOCATE'].includes(edge.interaction)))) return { subtitle: 'activated signaling node', state: 'state:signal:active' }
  if (entity.kind === 'transcription' && incoming.some((edge) => ['ACTIVATE', 'PHOSPHORYLATE', 'TRANSLOCATE'].includes(edge.interaction))) return { subtitle: 'active nuclear program', compartment: 'nucleus', state: 'state:transcription:nuclear' }
  return { ...(entity.compartment ? { compartment: entity.compartment } : {}), ...(entity.target ? { target: entity.target } : {}) }
}

function handles(type: InteractionType, sourceKind: BioKind, targetKind: BioKind) {
  if (sourceKind === 'antibody' && ['BIND', 'BLOCK', 'AGONIZE', 'CLUSTER', 'COMPETE'].includes(type)) return { sourceHandle: 'fab-left', targetHandle: 'binding-in' }
  if (type === 'TRANSLOCATE') return { sourceHandle: 'transport-out', targetHandle: 'transport-in' }
  if (type === 'BIND' || type === 'DIMERIZE') return { sourceHandle: sourceKind === 'receptor' ? 'complex-out' : 'binding-out', targetHandle: 'binding-in' }
  const sourceHandle = sourceKind === 'receptor' ? (targetKind === 'receptor' ? 'complex-out' : 'signal-out') : 'signal-out'
  return { sourceHandle, targetHandle: targetKind === 'receptor' ? 'binding-in' : 'signal-in' }
}

export function sceneFromMechanism(mechanism: ParsedMechanism) {
  const comparison = mechanism.templateId === 'receptor-blockade-comparison'
  const cellEntity = mechanism.entities.find((entity) => entity.kind === 'cell')
  const cellLabel = (cellEntity?.label ?? 'Target cell').toUpperCase()
  const panels: Array<{ id: PanelId; cellId: string; x: number; label: string }> = comparison
    ? [{ id: 'untreated', cellId: 'generated-untreated-cell', x: 40, label: `UNTREATED ${cellLabel}` }, { id: 'treated', cellId: 'generated-treated-cell', x: 710, label: `TREATED ${cellLabel}` }]
    : [{ id: 'single', cellId: 'generated-cell', x: 90, label: cellLabel }]
  const nodes: BioNode[] = []; const edges: BioEdge[] = []

  for (const panel of panels) {
    const width = comparison ? 620 : 880
    const blockedPanel = panel.id === 'treated' || (!comparison && mechanism.entities.some((entity) => entity.id === 'slc7020'))
    nodes.push({ id: panel.cellId, type: 'cell', position: { x: panel.x, y: 72 }, deletable: false, data: createBioData('cell', panel.label, { panelId: panel.id, provenance: cellEntity?.source ?? 'inferred' }), style: { width, height: 520 } })
    const panelEntities = mechanism.entities.filter((entity) => entity.kind !== 'cell' && !(panel.id === 'untreated' && entity.kind === 'antibody'))
    const prepared = panelEntities.map((entity) => ({ entity, data: createBioData(entity.kind, entity.label, { ...nodeOverrides(entity, panel.id, blockedPanel, mechanism), panelId: panel.id, provenance: entity.source }) }))
    const compartmentCounts = new Map<Compartment, number>(); for (const item of prepared) compartmentCounts.set(item.data.compartment, (compartmentCounts.get(item.data.compartment) ?? 0) + 1)
    const compartmentIndex = new Map<Compartment, number>()
    for (const { entity, data } of prepared) {
      const index = compartmentIndex.get(data.compartment) ?? 0; compartmentIndex.set(data.compartment, index + 1)
      const count = compartmentCounts.get(data.compartment) ?? 1; const bounds = regionBoundsFor(data.compartment, width)
      const x = count === 1 ? (bounds.x[0] + bounds.x[1]) / 2 : bounds.x[0] + (bounds.x[1] - bounds.x[0]) * index / (count - 1)
      nodes.push({ id: `${panel.id}-${entity.id}`, type: 'bio', parentId: panel.cellId, extent: 'parent', position: { x, y: bounds.y[0] }, data })
    }
    const panelInteractions = mechanism.interactions.filter((item) => item.panel === panel.id || item.panel === 'both' || (panel.id === 'single' && item.panel === 'single'))
    for (const item of panelInteractions) {
      const sourceEntity = mechanism.entities.find((entity) => entity.id === item.source); const targetEntity = mechanism.entities.find((entity) => entity.id === item.target)
      if (!sourceEntity || !targetEntity || (panel.id === 'untreated' && sourceEntity.kind === 'antibody')) continue
      edges.push({ id: `${panel.id}-${item.id}`, source: `${panel.id}-${item.source}`, target: `${panel.id}-${item.target}`, ...handles(item.interaction, sourceEntity.kind, targetEntity.kind), type: 'interaction', data: { interaction: item.interaction, note: item.sourceText }, markerEnd: markerForInteraction(item.interaction) })
    }
  }
  return { nodes, edges, title: mechanism.title, templateId: mechanism.templateId }
}
