import type { BioEdge, BioNode, DetailLevel, SceneType, SceneView, VisualizationProfile } from './types'

export const defaultVisualizationProfile: VisualizationProfile = {
  sceneType: 'full_signaling',
  detailLevel: 3,
  abstractionLevel: 'cartoon',
  layoutMode: 'comparison',
  evidenceDisplay: true,
  compartmentLabels: true,
  organelleDisplay: true,
}

export const sceneTypeLabels: Record<SceneType, string> = {
  empty: 'Empty canvas',
  ecm_membrane: 'ECM / Membrane',
  full_signaling: 'Full signaling',
  intracellular: 'Intracellular',
  cellular_interaction: 'Cell-cell interaction',
  environment: 'Tissue / Environment',
  organ_system: 'Organ / System',
  molecular_complex: 'Molecular / Complex',
  process_timeline: 'Process / Timeline',
}

const detailRequirement: Record<BioNode['data']['kind'], DetailLevel> = {
  cell: 1,
  annotation: 1,
  antibody: 1,
  ligand: 2,
  receptor: 2,
  signal: 3,
  transcription: 3,
}

function allowedByScene(node: BioNode, sceneType: SceneType) {
  if (sceneType === 'empty' || sceneType === 'full_signaling' || sceneType === 'cellular_interaction' || sceneType === 'organ_system') return true
  if (sceneType === 'ecm_membrane') return node.data.kind === 'cell' || node.data.kind === 'annotation' || node.data.compartment === 'extracellular' || node.data.compartment === 'membrane'
  if (sceneType === 'intracellular') return node.data.kind === 'cell' || node.data.kind === 'annotation' || !['extracellular', 'membrane'].includes(node.data.compartment)
  if (sceneType === 'environment') return node.data.kind === 'cell' || node.data.kind === 'annotation' || node.data.kind === 'ligand' || node.data.kind === 'antibody'
  if (sceneType === 'molecular_complex') return node.data.kind !== 'cell' && node.data.kind !== 'annotation' && ['ligand', 'receptor', 'antibody'].includes(node.data.kind)
  if (sceneType === 'process_timeline') return node.data.kind !== 'cell'
  return true
}

export function applyVisualizationProfile(nodes: BioNode[], edges: BioEdge[], profile: VisualizationProfile) {
  const nextNodes = nodes.map((node) => {
    const preserved = node.data.visibility === 'manually_hidden' || node.data.visibility === 'collapsed'
    const inScope = allowedByScene(node, profile.sceneType) && detailRequirement[node.data.kind] <= profile.detailLevel
    const visibility = preserved ? node.data.visibility : inScope ? 'visible' : 'hidden_by_scope'
    const hidden = visibility !== 'visible'
    return {
      ...node,
      hidden,
      data: node.data.kind === 'cell' ? {
        ...node.data,
        visibility,
        sceneType: profile.sceneType,
        showCompartmentLabels: profile.compartmentLabels,
        showOrganelles: profile.organelleDisplay,
      } : { ...node.data, visibility },
    }
  })
  const visibleIds = new Set(nextNodes.filter((node) => !node.hidden).map((node) => node.id))
  const nextEdges = edges.map((edge) => ({ ...edge, hidden: !visibleIds.has(edge.source) || !visibleIds.has(edge.target) }))
  return { nodes: nextNodes, edges: nextEdges }
}

export function captureView(id: string, name: string, profile: VisualizationProfile, nodes: BioNode[]): SceneView {
  return {
    id,
    name,
    profile: { ...profile },
    positions: Object.fromEntries(nodes.map((node) => [node.id, { ...node.position, positionMode: node.data.positionMode ?? 'auto' }])),
    visibility: Object.fromEntries(nodes.map((node) => [node.id, node.data.visibility ?? 'visible'])),
    createdAt: new Date().toISOString(),
  }
}

export function restoreView(view: SceneView, nodes: BioNode[], edges: BioEdge[]) {
  const positioned = nodes.map((node) => {
    const saved = view.positions[node.id]
    const visibility = view.visibility[node.id] ?? node.data.visibility ?? 'visible'
    return {
      ...node,
      position: saved ? { x: saved.x, y: saved.y } : node.position,
      data: { ...node.data, positionMode: saved?.positionMode ?? node.data.positionMode, visibility },
    }
  })
  return applyVisualizationProfile(positioned, edges, view.profile)
}
