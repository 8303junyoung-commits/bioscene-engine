import type { ActivityEvent, AssetReference, BioEdge, BioNode, CollaborationComment, CollaborationState, Compartment, ConstraintMode, EvidenceAppraisal, InteractionType, LiteratureRecord, SceneFile, SceneTemplateId, TissueModule } from './types'
import { createBioData, stateAllowsCompartment, validateConnection } from './biology'
import { markerForInteraction } from './visualGrammar'

const nodeWidth = 132
const yBounds: Record<Compartment, [number, number]> = { extracellular: [48, 120], membrane: [180, 205], cytoplasm: [280, 365], nucleus: [390, 429], endosome: [305, 324], mitochondria: [405, 419] }
export function regionBoundsFor(compartment: Compartment, width = 620) {
  const horizontal: Record<Compartment, [number, number]> = {
    extracellular: [50, Math.max(50, width - nodeWidth - 18)], membrane: [50, Math.max(50, width - nodeWidth - 18)], cytoplasm: [50, Math.max(50, width - nodeWidth - 18)],
    nucleus: [width * .42 + 14, Math.max(width * .42 + 14, width * .96 - nodeWidth - 14)],
    endosome: [width * .05 + 12, Math.max(width * .05 + 12, width * .38 - nodeWidth - 12)],
    mitochondria: [width * .05 + 12, Math.max(width * .05 + 12, width * .43 - nodeWidth - 12)],
  }
  return { x: horizontal[compartment], y: yBounds[compartment] }
}
export const regionBounds = Object.fromEntries((Object.keys(yBounds) as Compartment[]).map((compartment) => [compartment, regionBoundsFor(compartment)])) as Record<Compartment, { x: [number, number]; y: [number, number] }>

function parentWidth(nodes: BioNode[] | undefined, parentId?: string) {
  const parent = nodes?.find((item) => item.id === parentId)
  return typeof parent?.style?.width === 'number' ? parent.style.width : Number.parseFloat(String(parent?.style?.width ?? 620)) || 620
}

export function constrainNode(node: BioNode, mode: ConstraintMode, nodes?: BioNode[]): BioNode {
  if (mode === 'free' || node.data.kind === 'cell' || node.data.kind === 'annotation') return node
  const bounds = regionBoundsFor(node.data.compartment, parentWidth(nodes, node.parentId))
  const x = Math.max(bounds.x[0], Math.min(bounds.x[1], node.position.x))
  const y = node.data.compartment === 'membrane'
    ? bounds.y[0]
    : Math.max(bounds.y[0], Math.min(bounds.y[1], node.position.y))
  return { ...node, position: { x, y } }
}

export function findAvailablePosition(nodes: BioNode[], compartment: Compartment, parentId?: string) {
  const bounds = regionBoundsFor(compartment, parentWidth(nodes, parentId))
  const candidates = Array.from({ length: 5 }, (_, index) => bounds.x[0] + index * ((bounds.x[1] - bounds.x[0]) / 4))
  const occupied = nodes.filter((node) => node.data.kind !== 'cell' && node.data.compartment === compartment && node.parentId === parentId)
  const x = candidates.reduce((best, candidate) => {
    const clearance = occupied.length ? Math.min(...occupied.map((node) => Math.abs(node.position.x - candidate))) : Infinity
    const bestClearance = occupied.length ? Math.min(...occupied.map((node) => Math.abs(node.position.x - best))) : Infinity
    return clearance > bestClearance ? candidate : best
  }, candidates[0])
  return { x, y: bounds.y[0] }
}

const compartments = new Set<Compartment>(['extracellular', 'membrane', 'cytoplasm', 'nucleus', 'endosome', 'mitochondria'])
const interactionTypes = new Set<InteractionType>(['BIND', 'BLOCK', 'AGONIZE', 'CLUSTER', 'PHOSPHORYLATE', 'ACTIVATE', 'INHIBIT', 'SIGNAL_ABSENT', 'TRANSLOCATE', 'SECRETE', 'EXPRESS', 'INTERNALIZE', 'DEGRADE', 'CLEAVE', 'RECRUIT', 'DIMERIZE', 'COMPETE'])
const templateIds = new Set<SceneTemplateId>(['receptor-blockade-single', 'receptor-blockade-comparison', 't-cell-activation', 'hepatocyte-response', 'tumor-immune-crosstalk', 'endosomal-trafficking'])
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'

export function safeHttpUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function isAssetReference(value: unknown): value is AssetReference {
  if (!isObject(value)) return false
  return ['id', 'name', 'category', 'author', 'licenseSpdx', 'file'].every((key) => typeof value[key] === 'string')
    && !!safeHttpUrl(value.licenseUrl) && !!safeHttpUrl(value.sourceUrl)
    && Array.isArray(value.synonyms) && value.synonyms.every((item) => typeof item === 'string')
    && Array.isArray(value.identifiers) && value.identifiers.every((item) => isObject(item) && typeof item.database === 'string' && typeof item.id === 'string' && (item.url === undefined || !!safeHttpUrl(item.url)))
    && Array.isArray(value.svgDomains)
}

export function isSceneFile(value: unknown): value is SceneFile {
  if (!value || typeof value !== 'object') return false
  const scene = value as Partial<SceneFile>
  if (scene.schema !== 'bioscene.scene.v0.10' || !Array.isArray(scene.nodes) || !Array.isArray(scene.edges)) return false
  if (scene.constraintMode !== 'biological' && scene.constraintMode !== 'free') return false
  if (typeof scene.title !== 'string' || typeof scene.createdAt !== 'string') return false
  if (!['scientific-clean', 'journal-light', 'presentation-dark'].includes(scene.stylePreset ?? 'scientific-clean')) return false
  if (scene.templateId && !templateIds.has(scene.templateId)) return false
  if (!scene.review || !['draft', 'in-review', 'approved'].includes(scene.review.status) || !Array.isArray(scene.review.reviewers) || typeof scene.review.notes !== 'string') return false
  if (!Array.isArray(scene.literature) || !scene.literature.every(isLiteratureRecord)) return false
  if (!isCollaborationState(scene.collaboration)) return false
  const validNodes = scene.nodes.every((node) => (
    node && typeof node.id === 'string' && typeof node.position?.x === 'number' && typeof node.position?.y === 'number'
    && typeof node.data?.label === 'string' && compartments.has(node.data.compartment)
    && Array.isArray(node.data.domains) && Array.isArray(node.data.sites) && Array.isArray(node.data.ports)
    && Array.isArray(node.data.anchors) && Array.isArray(node.data.states) && Array.isArray(node.data.allowedCompartments)
    && (node.data.asset === undefined || isAssetReference(node.data.asset))
  ))
  const nodeIds = new Set(scene.nodes.map((node) => node.id))
  const validEdges = scene.edges.every((edge) => (
    edge && typeof edge.id === 'string' && nodeIds.has(edge.source) && nodeIds.has(edge.target)
    && !!edge.data && interactionTypes.has(edge.data.interaction)
    && (edge.data.evidence?.url === undefined || !!safeHttpUrl(edge.data.evidence.url))
  ))
  return validNodes && validEdges
}

const appraisalKeys: (keyof EvidenceAppraisal)[] = ['peerReviewed', 'directMechanism', 'humanRelevant', 'replicated', 'fullTextAvailable']
export const isEvidenceAppraisal = (value: unknown): value is EvidenceAppraisal => isObject(value) && appraisalKeys.every((key) => typeof value[key] === 'boolean')
export const isLiteratureRecord = (value: unknown): value is LiteratureRecord => isObject(value)
  && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.identifier === 'string' && typeof value.importedAt === 'string'
  && ['pubmed', 'doi', 'url', 'internal'].includes(String(value.sourceType)) && typeof value.score === 'number' && Number.isFinite(value.score)
  && isEvidenceAppraisal(value.appraisal) && (value.url === undefined || !!safeHttpUrl(value.url))
  && (value.authors === undefined || typeof value.authors === 'string') && (value.year === undefined || (typeof value.year === 'number' && Number.isInteger(value.year)))
  && (value.abstract === undefined || typeof value.abstract === 'string') && (value.metadataStatus === undefined || ['local', 'enriched', 'failed'].includes(String(value.metadataStatus)))
  && (value.enrichedAt === undefined || typeof value.enrichedAt === 'string')
export const isCollaborationComment = (value: unknown): value is CollaborationComment => isObject(value)
  && typeof value.id === 'string' && typeof value.author === 'string' && typeof value.body === 'string' && typeof value.createdAt === 'string' && typeof value.resolved === 'boolean'
export const isActivityEvent = (value: unknown): value is ActivityEvent => isObject(value)
  && typeof value.id === 'string' && typeof value.actor === 'string' && typeof value.action === 'string' && typeof value.createdAt === 'string'
export const isCollaborationState = (value: unknown): value is CollaborationState => isObject(value)
  && !('room' in value)
  && Array.isArray(value.participants) && value.participants.every((item) => typeof item === 'string')
  && Array.isArray(value.comments) && value.comments.every(isCollaborationComment)
  && Array.isArray(value.activity) && value.activity.every(isActivityEvent)

function sanitizeAsset(value: unknown): AssetReference | undefined {
  if (!isObject(value)) return undefined
  const identifiers = Array.isArray(value.identifiers) ? value.identifiers.flatMap((item) => {
    if (!isObject(item) || typeof item.database !== 'string' || typeof item.id !== 'string') return []
    const url = safeHttpUrl(item.url)
    return [{ ...item, url }]
  }) : []
  const candidate = { ...value, licenseUrl: safeHttpUrl(value.licenseUrl), sourceUrl: safeHttpUrl(value.sourceUrl), identifiers }
  return isAssetReference(candidate) ? candidate : undefined
}

function sanitizeLiterature(value: unknown): LiteratureRecord | undefined {
  if (!isObject(value)) return undefined
  const candidate = { ...value, url: safeHttpUrl(value.url) }
  return isLiteratureRecord(candidate) ? candidate : undefined
}

export function parseSceneFile(value: unknown): SceneFile | undefined {
  if (!value || typeof value !== 'object') return undefined
  const legacy = value as Record<string, unknown>
  if (!Array.isArray(legacy.nodes) || !Array.isArray(legacy.edges)) return undefined
  const schemas = new Set(Array.from({ length: 10 }, (_, index) => `bioscene.scene.v0.${index + 1}`))
  if (typeof legacy.schema !== 'string' || !schemas.has(legacy.schema)) return undefined
  try {
    const nodes = legacy.nodes.map((entry) => {
      const node = entry as BioNode
      if (!node?.data || typeof node.data.kind !== 'string' || typeof node.data.label !== 'string') throw new Error('Invalid node')
      const kind = node.data.kind
      const defaults = createBioData(kind, node.data.label, node.data)
      const matchingState = defaults.states.find((state) => state.id === node.data.state || state.label === node.data.state)
      return { ...node, deletable: node.data.kind === 'cell' ? false : node.deletable, data: { ...defaults, asset: sanitizeAsset(node.data.asset), state: matchingState?.id ?? defaults.state } }
    })
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const edges = (legacy.edges as BioEdge[]).map((edge) => {
      const interaction = edge.data?.interaction ?? 'BIND'
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      const sourcePort = source?.data.ports.find((port) => port.id === edge.sourceHandle)
        ?? source?.data.ports.find((port) => port.role === 'source' && port.allowedInteractions.includes(interaction))
      const targetPort = target?.data.ports.find((port) => port.id === edge.targetHandle)
        ?? target?.data.ports.find((port) => port.role === 'target' && port.semantic === sourcePort?.semantic && port.allowedInteractions.includes(interaction))
      const evidence = edge.data?.evidence ? { ...edge.data.evidence, url: safeHttpUrl(edge.data.evidence.url) } : undefined
      return { ...edge, sourceHandle: sourcePort?.id, targetHandle: targetPort?.id, markerEnd: markerForInteraction(interaction), data: { ...edge.data, evidence, interaction } }
    })
    const rawLiterature = Array.isArray(legacy.literature) ? legacy.literature : []
    const literature = rawLiterature.map(sanitizeLiterature).filter((item): item is LiteratureRecord => !!item)
    const literatureIds = new Set(literature.map((record) => record.id))
    const sanitizedEdges = edges.map((edge) => edge.data?.evidence ? { ...edge, data: { ...edge.data, evidence: { ...edge.data.evidence, literatureIds: edge.data.evidence.literatureIds?.filter((id) => literatureIds.has(id)) } } } : edge)
    const rawCollaboration = isObject(legacy.collaboration) ? legacy.collaboration : {}
    const templateId = typeof legacy.templateId === 'string' && templateIds.has(legacy.templateId as SceneTemplateId) ? legacy.templateId as SceneTemplateId : 'receptor-blockade-comparison'
    const validReview = isObject(legacy.review) && ['draft', 'in-review', 'approved'].includes(String(legacy.review.status))
      && Array.isArray(legacy.review.reviewers) && legacy.review.reviewers.every((item) => typeof item === 'string') && typeof legacy.review.notes === 'string'
    const scene: SceneFile = {
      schema: 'bioscene.scene.v0.10',
      title: typeof legacy.title === 'string' ? legacy.title : 'Imported BioScene',
      templateId,
      createdAt: typeof legacy.createdAt === 'string' ? legacy.createdAt : new Date().toISOString(),
      constraintMode: legacy.constraintMode === 'free' ? 'free' : 'biological',
      nodes,
      edges: sanitizedEdges,
      mechanism: isObject(legacy.mechanism) ? legacy.mechanism as unknown as SceneFile['mechanism'] : undefined,
      stylePreset: ['scientific-clean', 'journal-light', 'presentation-dark'].includes(String(legacy.stylePreset)) ? legacy.stylePreset as SceneFile['stylePreset'] : 'scientific-clean',
      review: validReview ? legacy.review as unknown as SceneFile['review'] : { status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() },
      literature,
      collaboration: {
        participants: Array.isArray(rawCollaboration.participants) ? rawCollaboration.participants.filter((item): item is string => typeof item === 'string') : [],
        comments: Array.isArray(rawCollaboration.comments) ? rawCollaboration.comments.filter(isCollaborationComment) : [],
        activity: Array.isArray(rawCollaboration.activity) ? rawCollaboration.activity.filter(isActivityEvent).slice(0, 50) : [],
      },
    }
    return isSceneFile(scene) ? scene : undefined
  } catch {
    return undefined
  }
}

export function parseTissueModule(value: unknown): TissueModule | undefined {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.description !== 'string' || typeof value.createdAt !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return undefined
  const parsed = parseSceneFile({
    schema: 'bioscene.scene.v0.10', title: value.name, createdAt: value.createdAt, constraintMode: 'biological',
    nodes: value.nodes, edges: value.edges, stylePreset: 'scientific-clean',
    review: { status: 'draft', reviewers: [], notes: '', updatedAt: value.createdAt },
    literature: Array.isArray(value.literature) ? value.literature : [], collaboration: { participants: [], comments: [], activity: [] },
  })
  return parsed ? { id: value.id, name: value.name, description: value.description, createdAt: value.createdAt, nodes: parsed.nodes, edges: parsed.edges, literature: parsed.literature } : undefined
}

export function biologicalWarnings(nodes: BioNode[], edges: BioEdge[]) {
  const warnings: string[] = []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    if (node.data.kind === 'cell' || node.data.kind === 'annotation') continue
    const bounds = regionBoundsFor(node.data.compartment, parentWidth(nodes, node.parentId))
    const outsideX = node.position.x < bounds.x[0] || node.position.x > bounds.x[1]
    const outsideY = node.position.y < bounds.y[0] || node.position.y > bounds.y[1]
    if (outsideX || outsideY) warnings.push(`${node.data.label} is outside ${node.data.compartment}`)
    if (!node.data.allowedCompartments.includes(node.data.compartment)) warnings.push(`${node.data.label} is not allowed in ${node.data.compartment}`)
    if (!stateAllowsCompartment(node)) warnings.push(`${node.data.label}'s current state is incompatible with ${node.data.compartment}`)
    const spatialAnchors = node.data.anchors.filter((anchor) => anchor.type !== 'parent')
    if (spatialAnchors.length && !spatialAnchors.some((anchor) => anchor.compartment === node.data.compartment)) {
      warnings.push(`${node.data.label} has no valid anchor in ${node.data.compartment}`)
    }
    const domainIds = new Set(node.data.domains.map((domain) => domain.id))
    const siteIds = new Set(node.data.sites.map((site) => site.id))
    for (const site of node.data.sites) if (!domainIds.has(site.domainId)) warnings.push(`${site.id} references a missing domain`)
    for (const port of node.data.ports) {
      if (port.domainId && !domainIds.has(port.domainId)) warnings.push(`${port.id} references a missing domain`)
      if (port.siteId && !siteIds.has(port.siteId)) warnings.push(`${port.id} references a missing site`)
    }
  }
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const state = source?.data.states.find((item) => item.id === source.data.state)?.label.toLowerCase() ?? source?.data.state?.toLowerCase() ?? ''
    if (source && ['ACTIVATE', 'PHOSPHORYLATE', 'TRANSLOCATE'].includes(edge.data?.interaction ?? '') && (state.includes('blocked') || state.includes('inactive'))) warnings.push(`${edge.id}: ${source.data.label} is ${state} but emits ${edge.data?.interaction}`)
    const error = validateConnection(byId.get(edge.source), byId.get(edge.target), edge.sourceHandle, edge.targetHandle, edge.data?.interaction)
    if (error) warnings.push(`${edge.id}: ${error}`)
  }
  return warnings
}

export async function autoLayout(nodes: BioNode[], edges: BioEdge[]): Promise<BioNode[]> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const ordered = [...nodes]
  const result = new Map<string, { x: number; y: number }>()

  for (const parent of ordered.filter((node) => node.data.kind === 'cell')) {
    const members = ordered.filter((node) => node.parentId === parent.id && node.data.kind !== 'annotation')
    if (!members.length) continue
    const memberIds = new Set(members.map((node) => node.id))
    const graph: any = await elk.layout({
      id: parent.id,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '50',
        'elk.layered.spacing.nodeNodeBetweenLayers': '70',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      },
      children: members.map((node) => ({ id: node.id, width: 132, height: 60 })),
      edges: edges
        .filter((edge) => memberIds.has(edge.source) && memberIds.has(edge.target))
        .map((edge) => ({ id: `layout-${edge.id}`, sources: [edge.source], targets: [edge.target] })),
    })
    const elkPosition = new Map<string, { x: number; y: number }>((graph.children ?? []).map((child: { id: string; x?: number; y?: number }) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]))

    const cellWidth = typeof parent.style?.width === 'number' ? parent.style.width : Number.parseFloat(String(parent.style?.width ?? 620)) || 620
    for (const compartment of Object.keys(regionBounds) as Compartment[]) {
      const compartmentMembers = members
        .filter((node) => node.data.compartment === compartment)
        .sort((a, b) => (elkPosition.get(a.id)?.x ?? 0) - (elkPosition.get(b.id)?.x ?? 0))
      if (!compartmentMembers.length) continue
      const bounds = regionBoundsFor(compartment, cellWidth)
      const maximumX = Math.min(bounds.x[1], cellWidth - 165)
      const span = Math.max(0, maximumX - bounds.x[0])
      const step = compartmentMembers.length > 1 ? span / (compartmentMembers.length - 1) : 0
      compartmentMembers.forEach((node, index) => {
        result.set(node.id, {
          x: compartmentMembers.length === 1 ? bounds.x[0] + span / 2 : bounds.x[0] + step * index,
          y: bounds.y[0],
        })
      })
    }
  }

  return ordered.map((node) => result.has(node.id) ? { ...node, position: result.get(node.id)! } : node)
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
