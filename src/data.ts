import { createBioData } from './biology'
import { markerForInteraction } from './visualGrammar'
import type { BioEdge, BioKind, BioNode, BioNodePatch, InteractionEvidence, InteractionType, PanelId, SceneTemplateId } from './types'

export interface SceneTemplate {
  id: SceneTemplateId
  title: string
  description: string
  nodes: BioNode[]
  edges: BioEdge[]
}

const cell = (id: string, label: string, panelId: PanelId, x: number, width = 620): BioNode => ({
  id, type: 'cell', position: { x, y: 72 }, deletable: false,
  data: createBioData('cell', label, { panelId }),
  style: { width, height: 520 },
})

const bioNode = (
  id: string,
  parentId: string,
  kind: Exclude<BioKind, 'cell' | 'annotation'>,
  label: string,
  panelId: PanelId,
  x: number,
  y: number,
  overrides: BioNodePatch = {},
): BioNode => ({
  id, type: 'bio', parentId, extent: 'parent', position: { x, y },
  data: createBioData(kind, label, { ...overrides, panelId }),
})

const interactionEdge = (
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  interaction: InteractionType,
  note?: string,
  evidence: InteractionEvidence = { status: 'needs-review', citation: '' },
): BioEdge => ({
  id, source, target, sourceHandle, targetHandle, type: 'interaction', data: { interaction, note, evidence },
  markerEnd: markerForInteraction(interaction),
})

const callout = (id: string, parentId: string, panelId: PanelId, title: string, body: string, x: number, y: number): BioNode => ({
  id, type: 'annotation', parentId, extent: 'parent', position: { x, y },
  data: createBioData('annotation', title, { panelId, annotation: { title, body, tone: 'finding' } }),
})

const singleCellId = 'nk-cell'
const singleNodes: BioNode[] = [
  cell(singleCellId, 'NK CELL', 'single', 90, 880),
  bioNode('il18', singleCellId, 'ligand', 'IL-18', 'single', 172, 78, { subtitle: 'pro-inflammatory cytokine', state: 'state:ligand:soluble' }),
  bioNode('slc7020', singleCellId, 'antibody', 'SLC-7020', 'single', 480, 60, { subtitle: 'blocking antibody', state: 'state:antibody:bound' }),
  bioNode('il18ra', singleCellId, 'receptor', 'IL-18Rα', 'single', 246, 184, { subtitle: 'ligand-binding chain', target: 'IL18RA', state: 'state:receptor:bound' }),
  bioNode('il18rb', singleCellId, 'receptor', 'IL-18Rβ', 'single', 450, 184, { subtitle: 'signaling chain', target: 'IL18RB', state: 'state:receptor:blocked' }),
  bioNode('myd88', singleCellId, 'signal', 'MyD88 / IRAK', 'single', 420, 310, { subtitle: 'signal absent after blockade', state: 'state:signal:inactive' }),
  bioNode('nfkb', singleCellId, 'transcription', 'NF-κB', 'single', 430, 330, { subtitle: 'retained in cytoplasm', compartment: 'cytoplasm', state: 'state:transcription:cytoplasmic' }),
]

const singleEdges: BioEdge[] = [
  interactionEdge('e-il18-ra', 'il18', 'il18ra', 'binding-out', 'binding-in', 'BIND'),
  interactionEdge('e-ra-rb', 'il18ra', 'il18rb', 'complex-out', 'binding-in', 'ACTIVATE'),
  interactionEdge('e-ab-rb', 'slc7020', 'il18rb', 'fab-left', 'binding-in', 'BLOCK', 'Prevents receptor complex formation'),
  interactionEdge('e-rb-myd88', 'il18rb', 'myd88', 'signal-out', 'signal-in', 'SIGNAL_ABSENT', 'Receptor blockade prevents signalosome activation'),
  interactionEdge('e-myd88-nfkb', 'myd88', 'nfkb', 'signal-out', 'signal-in', 'SIGNAL_ABSENT', 'NF-κB translocation does not occur'),
]

const untreatedCellId = 'untreated-nk-cell'
const treatedCellId = 'treated-nk-cell'
const comparisonNodes: BioNode[] = [
  cell(untreatedCellId, 'UNTREATED NK CELL', 'untreated', 40),
  cell(treatedCellId, 'SLC-7020 TREATED NK CELL', 'treated', 710),
  bioNode('u-il18', untreatedCellId, 'ligand', 'IL-18', 'untreated', 90, 70, { subtitle: 'available ligand' }),
  bioNode('u-ra', untreatedCellId, 'receptor', 'IL-18Rα', 'untreated', 150, 184, { target: 'IL18RA', state: 'state:receptor:bound' }),
  bioNode('u-rb', untreatedCellId, 'receptor', 'IL-18Rβ', 'untreated', 330, 184, { target: 'IL18RB', state: 'state:receptor:active' }),
  bioNode('u-myd88', untreatedCellId, 'signal', 'MyD88 / IRAK', 'untreated', 300, 305, { subtitle: 'active signalosome', state: 'state:signal:active' }),
  bioNode('u-nfkb', untreatedCellId, 'transcription', 'NF-κB', 'untreated', 410, 400, { subtitle: 'nuclear program', state: 'state:transcription:nuclear' }),
  bioNode('t-il18', treatedCellId, 'ligand', 'IL-18', 'treated', 80, 70, { subtitle: 'ligand present' }),
  bioNode('t-slc7020', treatedCellId, 'antibody', 'SLC-7020', 'treated', 380, 62, { subtitle: 'IL-18Rβ blockade', state: 'state:antibody:bound' }),
  bioNode('t-ra', treatedCellId, 'receptor', 'IL-18Rα', 'treated', 130, 184, { target: 'IL18RA', state: 'state:receptor:bound' }),
  bioNode('t-rb', treatedCellId, 'receptor', 'IL-18Rβ', 'treated', 340, 184, { target: 'IL18RB', state: 'state:receptor:blocked' }),
  bioNode('t-myd88', treatedCellId, 'signal', 'MyD88 / IRAK', 'treated', 300, 305, { subtitle: 'signal suppressed', state: 'state:signal:inactive' }),
  bioNode('t-nfkb', treatedCellId, 'transcription', 'NF-κB', 'treated', 410, 330, { subtitle: 'retained in cytoplasm', compartment: 'cytoplasm', state: 'state:transcription:cytoplasmic' }),
]

const comparisonEdges: BioEdge[] = [
  interactionEdge('u-bind', 'u-il18', 'u-ra', 'binding-out', 'binding-in', 'BIND'),
  interactionEdge('u-complex', 'u-ra', 'u-rb', 'complex-out', 'binding-in', 'ACTIVATE'),
  interactionEdge('u-signal', 'u-rb', 'u-myd88', 'signal-out', 'signal-in', 'ACTIVATE'),
  interactionEdge('u-translocate', 'u-myd88', 'u-nfkb', 'transport-out', 'transport-in', 'TRANSLOCATE'),
  interactionEdge('t-bind', 't-il18', 't-ra', 'binding-out', 'binding-in', 'BIND'),
  interactionEdge('t-block', 't-slc7020', 't-rb', 'fab-left', 'binding-in', 'BLOCK', 'SLC-7020 blocks signaling-chain recruitment'),
  interactionEdge('t-absent-signal', 't-rb', 't-myd88', 'signal-out', 'signal-in', 'SIGNAL_ABSENT', 'No downstream signal after receptor blockade'),
  interactionEdge('t-absent-program', 't-myd88', 't-nfkb', 'signal-out', 'signal-in', 'SIGNAL_ABSENT', 'No NF-κB nuclear translocation'),
]

const tCellId = 'cd8-t-cell'
const tCellNodes: BioNode[] = [
  cell(tCellId, 'CD8 T CELL', 'single', 90, 880),
  bioNode('tc-pmhc', tCellId, 'ligand', 'pMHC', 'single', 150, 72, { subtitle: 'tumor antigen complex' }),
  bioNode('tc-tcr', tCellId, 'receptor', 'TCR / CD3', 'single', 250, 184, { subtitle: 'antigen recognition', state: 'state:receptor:active' }),
  bioNode('tc-zap70', tCellId, 'signal', 'ZAP70', 'single', 330, 295, { subtitle: 'proximal kinase', state: 'state:signal:phosphorylated' }),
  bioNode('tc-nfat', tCellId, 'transcription', 'NFAT', 'single', 430, 390, { subtitle: 'effector transcription', state: 'state:transcription:nuclear' }),
  callout('tc-callout', tCellId, 'single', 'Activation checkpoint', 'TCR engagement phosphorylates ZAP70 and drives nuclear NFAT.', 575, 80),
]
const tCellEdges: BioEdge[] = [
  interactionEdge('tc-bind', 'tc-pmhc', 'tc-tcr', 'binding-out', 'binding-in', 'BIND'),
  interactionEdge('tc-phosphorylate', 'tc-tcr', 'tc-zap70', 'signal-out', 'signal-in', 'PHOSPHORYLATE'),
  interactionEdge('tc-translocate', 'tc-zap70', 'tc-nfat', 'transport-out', 'transport-in', 'TRANSLOCATE'),
]

const hepatocyteId = 'hepatocyte'
const hepatocyteNodes: BioNode[] = [
  cell(hepatocyteId, 'HEPATOCYTE', 'single', 90, 880),
  bioNode('hep-il6', hepatocyteId, 'ligand', 'IL-6', 'single', 150, 72, { subtitle: 'systemic inflammatory cytokine' }),
  bioNode('hep-il6r', hepatocyteId, 'receptor', 'IL-6R / gp130', 'single', 260, 184, { subtitle: 'cytokine receptor complex', state: 'state:receptor:active' }),
  bioNode('hep-stat3', hepatocyteId, 'signal', 'STAT3', 'single', 350, 295, { subtitle: 'phosphorylated transcription factor', state: 'state:signal:phosphorylated' }),
  bioNode('hep-apr', hepatocyteId, 'transcription', 'Acute-phase genes', 'single', 440, 390, { subtitle: 'CRP and serum amyloid program', state: 'state:transcription:nuclear' }),
  callout('hep-callout', hepatocyteId, 'single', 'Organ response', 'Hepatic IL-6 signaling induces the systemic acute-phase program.', 570, 82),
]
const hepatocyteEdges: BioEdge[] = [
  interactionEdge('hep-bind', 'hep-il6', 'hep-il6r', 'binding-out', 'binding-in', 'BIND'),
  interactionEdge('hep-phosphorylate', 'hep-il6r', 'hep-stat3', 'signal-out', 'signal-in', 'PHOSPHORYLATE'),
  interactionEdge('hep-translocate', 'hep-stat3', 'hep-apr', 'transport-out', 'transport-in', 'TRANSLOCATE'),
]

const tumorCellId = 'tme-tumor-cell'
const immuneCellId = 'tme-cd8-cell'
const tumorImmuneNodes: BioNode[] = [
  cell(tumorCellId, 'TUMOR CELL', 'tissue', 40, 540),
  cell(immuneCellId, 'CD8 T CELL', 'tissue', 640, 540),
  bioNode('tme-pdl1', tumorCellId, 'receptor', 'PD-L1', 'tissue', 325, 184, { subtitle: 'immune checkpoint ligand', state: 'state:receptor:active' }),
  bioNode('tme-pd1', immuneCellId, 'receptor', 'PD-1', 'tissue', 145, 184, { subtitle: 'inhibitory checkpoint receptor', state: 'state:receptor:bound' }),
  bioNode('tme-shp2', immuneCellId, 'signal', 'SHP2', 'tissue', 205, 292, { subtitle: 'inhibitory phosphatase', state: 'state:signal:active' }),
  bioNode('tme-mito', immuneCellId, 'signal', 'Mitochondrial priming', 'tissue', 60, 405, { subtitle: 'effector fitness', compartment: 'mitochondria', state: 'state:signal:mitochondrial' }),
  callout('tme-callout', immuneCellId, 'tissue', 'Tissue interaction', 'Tumor PD-L1 engages PD-1 across the cell-cell interface and suppresses T-cell fitness.', 285, 75),
]
const tumorImmuneEdges: BioEdge[] = [
  interactionEdge('tme-bind', 'tme-pdl1', 'tme-pd1', 'complex-out', 'binding-in', 'BIND', 'Intercellular checkpoint engagement'),
  interactionEdge('tme-inhibit', 'tme-pd1', 'tme-shp2', 'signal-out', 'signal-in', 'INHIBIT'),
  interactionEdge('tme-fitness', 'tme-shp2', 'tme-mito', 'signal-out', 'signal-in', 'INHIBIT'),
]

const traffickingCellId = 'trafficking-cell'
const traffickingNodes: BioNode[] = [
  cell(traffickingCellId, 'EPITHELIAL CELL', 'single', 90, 880),
  bioNode('tr-egf', traffickingCellId, 'ligand', 'EGF', 'single', 125, 72, { subtitle: 'growth factor' }),
  bioNode('tr-egfr-surface', traffickingCellId, 'receptor', 'EGFR', 'single', 225, 184, { subtitle: 'surface receptor', state: 'state:receptor:active' }),
  bioNode('tr-egfr-endosome', traffickingCellId, 'receptor', 'EGFR endosomal', 'single', 145, 305, { subtitle: 'internalized receptor', compartment: 'endosome', state: 'state:receptor:internalized' }),
  bioNode('tr-erk', traffickingCellId, 'signal', 'ERK', 'single', 390, 292, { subtitle: 'sustained signaling', state: 'state:signal:phosphorylated' }),
  callout('tr-callout', traffickingCellId, 'single', 'Trafficking state', 'Internalization moves EGFR from plasma membrane into the endosomal compartment.', 555, 75),
]
const traffickingEdges: BioEdge[] = [
  interactionEdge('tr-bind', 'tr-egf', 'tr-egfr-surface', 'binding-out', 'binding-in', 'BIND'),
  interactionEdge('tr-internalize', 'tr-egfr-surface', 'tr-egfr-endosome', 'transport-out', 'transport-in', 'INTERNALIZE'),
  interactionEdge('tr-signal', 'tr-egfr-endosome', 'tr-erk', 'signal-out', 'signal-in', 'ACTIVATE'),
]

export const sceneTemplates: Record<SceneTemplateId, SceneTemplate> = {
  'receptor-blockade-single': {
    id: 'receptor-blockade-single', title: 'IL-18 receptor blockade',
    description: 'Single-panel mechanism editor', nodes: singleNodes, edges: singleEdges,
  },
  'receptor-blockade-comparison': {
    id: 'receptor-blockade-comparison', title: 'IL-18 signaling · untreated vs SLC-7020',
    description: 'Matched untreated and treated comparison', nodes: comparisonNodes, edges: comparisonEdges,
  },
  't-cell-activation': {
    id: 't-cell-activation', title: 'CD8 T-cell activation', description: 'CD8 T-cell antigen response', nodes: tCellNodes, edges: tCellEdges,
  },
  'hepatocyte-response': {
    id: 'hepatocyte-response', title: 'Hepatocyte IL-6 response', description: 'Organ-level hepatocyte cytokine response', nodes: hepatocyteNodes, edges: hepatocyteEdges,
  },
  'tumor-immune-crosstalk': {
    id: 'tumor-immune-crosstalk', title: 'Tumor–immune checkpoint crosstalk', description: 'Multi-cell tumor–CD8 tissue interaction', nodes: tumorImmuneNodes, edges: tumorImmuneEdges,
  },
  'endosomal-trafficking': {
    id: 'endosomal-trafficking', title: 'EGFR endosomal trafficking', description: 'Membrane-to-endosome receptor trafficking', nodes: traffickingNodes, edges: traffickingEdges,
  },
}

export const DEFAULT_TEMPLATE_ID: SceneTemplateId = 'receptor-blockade-comparison'
export const initialNodes = sceneTemplates[DEFAULT_TEMPLATE_ID].nodes
export const initialEdges = sceneTemplates[DEFAULT_TEMPLATE_ID].edges

export function cloneTemplate(templateId: SceneTemplateId) {
  const template = sceneTemplates[templateId]
  return {
    ...template,
    nodes: template.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      style: node.style ? { ...node.style } : undefined,
      data: createBioData(node.data.kind, node.data.label, node.data),
    })),
    edges: template.edges.map((edge) => ({ ...edge, data: edge.data ? { ...edge.data, evidence: edge.data.evidence ? { ...edge.data.evidence } : undefined } : { interaction: 'BIND' as InteractionType } })),
  }
}
