import { createBioData, validateConnection } from './biology'
import { uid } from './identity'
import { applyMoleculeToNode, architectureForFormat, createMolecule, structuralModelForMolecule, syncArchitecture } from './molecules'
import { layoutSimpleCells, makeDrug } from './simpleMoa'
import { markerForInteraction } from './visualGrammar'
import type {
  AntibodyFormat,
  BioEdge,
  BioKind,
  BioNode,
  CellColorTheme,
  CellShapeStyle,
  Compartment,
  InteractionType,
  MoleculeDefinition,
  MoleculeTopology,
  PortDefinition,
} from './types'

export interface CellPalette {
  cytoplasmStart: string
  cytoplasmEnd: string
  border: string
  headFill: string
  headStroke: string
  tailStroke: string
  lipidCore: string
  nucleusStart: string
  nucleusEnd: string
  nucleusBorder: string
  badgeBg: string
  badgeText: string
}

export const CELL_THEMES: Record<CellColorTheme, CellPalette> = {
  emerald: {
    cytoplasmStart: '#f2fbf7',
    cytoplasmEnd: '#d9f0e6',
    border: '#72b89e',
    headFill: '#49a082',
    headStroke: '#256c55',
    tailStroke: '#9bcab7',
    lipidCore: '#e8f5dc',
    nucleusStart: '#eef0fa',
    nucleusEnd: '#d7dcf2',
    nucleusBorder: '#8d99c9',
    badgeBg: 'rgba(255,255,255,0.88)',
    badgeText: '#1b5543',
  },
  sky: {
    cytoplasmStart: '#f1f8fe',
    cytoplasmEnd: '#d7eafb',
    border: '#6aa9d9',
    headFill: '#4389c2',
    headStroke: '#235a8a',
    tailStroke: '#97c1e3',
    lipidCore: '#eaf4fc',
    nucleusStart: '#eef1fb',
    nucleusEnd: '#d6def5',
    nucleusBorder: '#8397cc',
    badgeBg: 'rgba(255,255,255,0.88)',
    badgeText: '#1c4c78',
  },
  coral: {
    cytoplasmStart: '#fff4f2',
    cytoplasmEnd: '#f9dcd8',
    border: '#dc8580',
    headFill: '#d4635d',
    headStroke: '#963530',
    tailStroke: '#e6aba7',
    lipidCore: '#fdedd8',
    nucleusStart: '#f7ebf2',
    nucleusEnd: '#e6cedd',
    nucleusBorder: '#b57d9d',
    badgeBg: 'rgba(255,255,255,0.9)',
    badgeText: '#7f2723',
  },
  amber: {
    cytoplasmStart: '#fffaf0',
    cytoplasmEnd: '#f7e8c8',
    border: '#d4a659',
    headFill: '#c98a32',
    headStroke: '#875714',
    tailStroke: '#e3c28d',
    lipidCore: '#fef5dc',
    nucleusStart: '#f3effa',
    nucleusEnd: '#dfd8ef',
    nucleusBorder: '#9b8ec2',
    badgeBg: 'rgba(255,255,255,0.9)',
    badgeText: '#6e450d',
  },
  violet: {
    cytoplasmStart: '#f7f4fe',
    cytoplasmEnd: '#e5def9',
    border: '#9d8ad9',
    headFill: '#7f67c9',
    headStroke: '#4e3891',
    tailStroke: '#beb1e8',
    lipidCore: '#f3effd',
    nucleusStart: '#eef2fc',
    nucleusEnd: '#d6dff6',
    nucleusBorder: '#8495c9',
    badgeBg: 'rgba(255,255,255,0.9)',
    badgeText: '#432f80',
  },
  sage: {
    cytoplasmStart: '#f7faf0',
    cytoplasmEnd: '#e3edd1',
    border: '#9bb56e',
    headFill: '#7c9c48',
    headStroke: '#4d6624',
    tailStroke: '#bdd199',
    lipidCore: '#f4f8e1',
    nucleusStart: '#eff1fa',
    nucleusEnd: '#dadff0',
    nucleusBorder: '#8f9bc2',
    badgeBg: 'rgba(255,255,255,0.9)',
    badgeText: '#3f541d',
  },
}

export function inferCellTheme(label: string): CellColorTheme {
  const upper = label.toUpperCase()
  if (/TUMOR|CANCER|MALIGNANT|CARCINOMA/.test(upper)) return 'coral'
  if (/\bNK\b|NATURAL KILLER/.test(upper)) return 'sky'
  if (/MACROPHAGE|DENDRITIC|MONOCYTE|APC|MYELOID/.test(upper)) return 'amber'
  if (/\bB CELL|TREG|PLASMA/.test(upper)) return 'violet'
  if (/HEPATOCYTE|EPITHELIAL|FIBROBLAST|STROMA/.test(upper)) return 'sage'
  return 'emerald'
}

export type ProteinCategory = 'receptor' | 'cytokine' | 'signaling' | 'transcription'

export interface CatalogItem {
  id: string
  name: string
  koreanHint: string
  geneName: string
  category: ProteinCategory
  topology: MoleculeTopology
  customColor?: string
  molecule: MoleculeDefinition
}

function buildCatalogMolecule(
  name: string,
  geneName: string,
  category: ProteinCategory,
  topology: MoleculeTopology,
): MoleculeDefinition {
  const entityClass = category === 'cytokine' ? 'cytokine_ligand' : 'natural_protein'
  const molecule: MoleculeDefinition = {
    ...createMolecule(name, 'public'),
    id: `studio:${geneName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    geneName,
    entityClass,
    origin: 'natural',
    topology,
    topologyConfirmed: true,
    topologySource: 'BioScene inference',
    topologyConfidence: 'high',
    identitySource: 'BioScene inference',
    identityConfidence: 'high',
    saveStatus: 'saved',
    lookupStatus: 'local',
    species: 'Homo sapiens',
  }
  const baseModel = structuralModelForMolecule(molecule)
  const template =
    /GPCR|CXCR|CCR/i.test(name)
      ? 'gpcr'
      : /Channel/i.test(name)
        ? 'ion_channel'
        : category === 'cytokine'
          ? 'cytokine'
          : topology === 'single_pass_membrane'
            ? 'single_pass_receptor'
            : 'globular'
  molecule.structuralModel = { ...baseModel, template, displayLevel: 'simplified' }
  return molecule
}

const rawCatalog: Array<[string, string, string, ProteinCategory, MoleculeTopology, string?]> = [
  // Membrane Receptors
  ['PD-1', '면역관문 억제 수용체', 'PDCD1', 'receptor', 'single_pass_membrane', '#2a8c6f'],
  ['PD-L1', '종양 면역관문 리간드', 'CD274', 'receptor', 'single_pass_membrane', '#e05d5d'],
  ['CTLA-4', '공억제 수용체', 'CTLA4', 'receptor', 'single_pass_membrane', '#0d9488'],
  ['LAG-3', '면역관문 수용체', 'LAG3', 'receptor', 'single_pass_membrane', '#3b82f6'],
  ['TIGIT', 'NK/T 억제 수용체', 'TIGIT', 'receptor', 'single_pass_membrane', '#6366f1'],
  ['TCR / CD3', 'T세포 항원 수용체 복합체', 'CD3E', 'receptor', 'single_pass_membrane', '#0d9488'],
  ['CD28', 'T세포 공자극 수용체', 'CD28', 'receptor', 'single_pass_membrane', '#10b981'],
  ['IL-18Rα', 'IL-18 결합 수용체 사슬', 'IL18R1', 'receptor', 'single_pass_membrane', '#2589bd'],
  ['IL-18Rβ', 'IL-18 신호 보조 수용체', 'IL18RAP', 'receptor', 'single_pass_membrane', '#38a3a5'],
  ['IL-2R', 'IL-2 수용체 복합체', 'IL2RB', 'receptor', 'single_pass_membrane', '#0284c7'],
  ['IL-6R / gp130', '사이토카인 수용체 복합체', 'IL6R', 'receptor', 'single_pass_membrane', '#2563eb'],
  ['EGFR', '성장인자 수용체 (RTK)', 'EGFR', 'receptor', 'single_pass_membrane', '#e05d5d'],
  ['HER2', '종양 표적 수용체', 'ERBB2', 'receptor', 'single_pass_membrane', '#db2777'],
  ['Tumor Antigen', '종양 표면 표적 항원 (TAA)', 'TAA', 'receptor', 'single_pass_membrane', '#e11d48'],
  ['GPCR (7TM)', '7막관통 수용체', 'CXCR4', 'receptor', 'multi_pass_membrane', '#0d9488'],
  ['Ion Channel', '막 이온 채널', 'KCNJ2', 'receptor', 'multi_pass_membrane', '#0891b2'],
  // Cytokines & Secreted Ligands
  ['IL-18', '염증성 사이토카인', 'IL18', 'cytokine', 'secreted', '#f59e0b'],
  ['IL-2', 'T/NK 증식 사이토카인', 'IL2', 'cytokine', 'secreted', '#14b8a6'],
  ['IFN-γ', '이펙터 인터페론 감마', 'IFNG', 'cytokine', 'secreted', '#0d9488'],
  ['TNF-α', '염증 매개 사이토카인', 'TNF', 'cytokine', 'secreted', '#f43f5e'],
  ['IL-6', '급성기 염증 사이토카인', 'IL6', 'cytokine', 'secreted', '#f97316'],
  ['TGF-β', '면역억제 사이토카인', 'TGFB1', 'cytokine', 'secreted', '#8b5cf6'],
  ['VEGF', '혈관신생 성장인자', 'VEGFA', 'cytokine', 'secreted', '#ec4899'],
  ['Granzyme B', '세포독성 과립 효소', 'GZMB', 'cytokine', 'secreted', '#e11d48'],
  ['pMHC', '항원 제시 복합체', 'HLA-A', 'cytokine', 'secreted', '#f59e0b'],
  // Intracellular Signaling
  ['MyD88 / IRAK4', 'IL-1R/IL-18R 신호 어댑터', 'MYD88', 'signaling', 'intracellular', '#3b82f6'],
  ['JAK1 / JAK2', '수용체 결합 티로신 키나아제', 'JAK1', 'signaling', 'intracellular', '#2563eb'],
  ['ZAP70', 'TCR 근위 활성 키나아제', 'ZAP70', 'signaling', 'intracellular', '#0284c7'],
  ['SHP-2', 'PD-1 억제 탈인산화효소', 'PTPN11', 'signaling', 'intracellular', '#64748b'],
  ['PI3K / AKT', '생존·대사 신호 경로', 'AKT1', 'signaling', 'intracellular', '#4f46e5'],
  ['MEK / ERK', 'MAPK 증식 신호 경로', 'MAPK1', 'signaling', 'intracellular', '#0ea5e9'],
  ['TRAF6 / IKK', 'NF-κB 상위 활성 복합체', 'TRAF6', 'signaling', 'intracellular', '#2563eb'],
  // Nuclear Transcription
  ['NF-κB', '염증 유전자 전사인자', 'RELA', 'transcription', 'nuclear', '#db5a42'],
  ['STAT3', '전사 활성 인자 3', 'STAT3', 'transcription', 'nuclear', '#d97706'],
  ['STAT5', '전사 활성 인자 5', 'STAT5A', 'transcription', 'nuclear', '#0d9488'],
  ['NFAT', 'T세포 활성 전사인자', 'NFATC1', 'transcription', 'nuclear', '#e11d48'],
  ['Target Gene', '표적 유전자 발현 (mRNA)', 'GENE', 'transcription', 'nuclear', '#4f46e5'],
]

export const STUDIO_CATALOG: CatalogItem[] = rawCatalog.map(([name, koreanHint, geneName, category, topology, customColor]) => ({
  id: `cat:${geneName}`,
  name,
  koreanHint,
  geneName,
  category,
  topology,
  customColor,
  molecule: buildCatalogMolecule(name, geneName, category, topology),
}))

export interface CellPresetOption {
  name: string
  koreanDesc: string
  theme: CellColorTheme
  defaultShape: CellShapeStyle
}

export const STUDIO_CELL_PRESETS: CellPresetOption[] = [
  { name: 'CD8⁺ T cell', koreanDesc: '세포독성 T 림프구', theme: 'emerald', defaultShape: 'membrane_zoom' },
  { name: 'NK cell', koreanDesc: '자연살해 면역세포', theme: 'sky', defaultShape: 'membrane_zoom' },
  { name: 'Tumor cell', koreanDesc: '표적 암세포 / 종양세포', theme: 'coral', defaultShape: 'tumor_cell' },
  { name: 'CD4⁺ T cell', koreanDesc: '보조 T 림프구', theme: 'emerald', defaultShape: 'membrane_zoom' },
  { name: 'Macrophage', koreanDesc: '대식세포 / 골수성 면역세포', theme: 'amber', defaultShape: 'membrane_zoom' },
  { name: 'Dendritic cell', koreanDesc: '항원제시 수지상세포', theme: 'amber', defaultShape: 'round_cell' },
  { name: 'Treg', koreanDesc: '조절 T 세포', theme: 'violet', defaultShape: 'round_cell' },
  { name: 'B cell', koreanDesc: '항체 생산 B 림프구', theme: 'violet', defaultShape: 'round_cell' },
  { name: 'Hepatocyte', koreanDesc: '간세포 / 조직 실질세포', theme: 'sage', defaultShape: 'membrane_zoom' },
]

export type StudioTherapeuticKind = 'igg' | 'bispecific' | 'adc' | 'receptor_trap' | 'fab' | 'scfv' | 'small_molecule'

export function buildStudioTherapeutic(opts: {
  name: string
  modality: StudioTherapeuticKind
  targets: string[]
  valency?: '1+1' | '2+1' | '1+2' | '2+2'
  customColor?: string
}): { molecule: MoleculeDefinition; nodeOverrides: Partial<BioNode['data']> } {
  const { name, modality, targets, valency = '1+1', customColor } = opts
  if (modality === 'small_molecule') {
    const mol = makeDrug(name, 'ligand', targets)
    return {
      molecule: { ...mol, entityClass: 'unknown_custom', origin: 'synthetic', privacy: 'private' },
      nodeOverrides: { kind: 'ligand', smallMolecule: true, customColor: customColor ?? '#0284c7', subtitle: 'small-molecule inhibitor' },
    }
  }
  if (modality === 'receptor_trap') {
    const mol: MoleculeDefinition = {
      ...createMolecule(name, 'private'),
      id: uid('molecule'),
      moleculeClass: 'engineered_construct',
      entityClass: 'receptor_trap',
      origin: 'engineered',
      topology: 'soluble',
      topologyConfirmed: true,
      topologySource: 'user',
      topologyConfidence: 'confirmed',
      identityConfidence: 'confirmed',
      saveStatus: 'saved',
      savedAt: new Date().toISOString(),
    }
    const base = structuralModelForMolecule(mol)
    const arch = architectureForFormat(mol.id, 'igg')
    mol.architecture = syncArchitecture(mol.id, {
      ...arch,
      kind: 'fusion',
      specificities: [{ ...arch.specificities[0], target: targets[0] ?? '' }],
    })
    mol.structuralModel = { ...base, template: 'receptor_trap', displayLevel: 'simplified', architecture: mol.architecture }
    return { molecule: mol, nodeOverrides: { kind: 'antibody', customColor, subtitle: 'Fc-fusion trap' } }
  }

  const format: AntibodyFormat =
    modality === 'bispecific' ? 'bispecific' : modality === 'fab' ? 'fab' : modality === 'scfv' ? 'scfv' : 'igg'
  const mol = makeDrug(name, format, targets, valency)
  if (modality === 'adc') {
    mol.entityClass = 'adc'
  }
  return {
    molecule: mol,
    nodeOverrides: {
      kind: 'antibody',
      hasPayload: modality === 'adc',
      customColor,
      autoAimTarget: true,
    },
  }
}

export function placeStudioCell(
  existingNodes: BioNode[],
  preset: { name: string; theme?: CellColorTheme; shape?: CellShapeStyle },
): { nodes: BioNode[]; cellId: string } {
  const id = uid('cell')
  const cells = existingNodes.filter((n) => n.data.kind === 'cell')
  const rightEdge = cells.length
    ? Math.max(...cells.map((c) => c.position.x + Number(c.style?.width ?? 620))) + 110
    : 70
  const shape = preset.shape ?? 'membrane_zoom'
  const width = shape === 'membrane_zoom' ? 660 : 440
  const height = shape === 'membrane_zoom' ? 520 : 400
  const membrane =
    shape === 'membrane_zoom'
      ? {
          id,
          name: `${preset.name} membrane`,
          boundaryType: 'plasma_membrane' as const,
          path: [
            { x: 26, y: 217 },
            { x: width - 26, y: 217 },
          ],
          sideA: 'extracellular' as const,
          sideB: 'cytoplasm' as const,
          closed: false,
          style: 'standard' as const,
          thickness: 18,
          smoothing: 0,
          anchors: [],
        }
      : undefined

  const cellNode: BioNode = {
    id,
    type: 'cell',
    position: { x: rightEdge, y: 70 },
    style: { width, height },
    deletable: false,
    data: createBioData('cell', preset.name, {
      simpleCell: shape === 'membrane_zoom',
      cellShape: shape,
      cellTheme: preset.theme,
      membrane,
      showOrganelles: false,
      showName: true,
      sceneType: 'full_signaling',
      panelId: 'single',
      positionMode: 'auto',
      visibility: 'visible',
    }),
  }
  return { nodes: [...existingNodes, cellNode], cellId: id }
}

export function placeCatalogMolecule(
  existingNodes: BioNode[],
  molecule: MoleculeDefinition,
  options: {
    targetCellId?: string
    category?: ProteinCategory
    customColor?: string
    count?: number
  } = {},
): { nodes: BioNode[]; createdIds: string[] } {
  let working = structuredClone(existingNodes)
  let cell =
    working.find((n) => n.id === options.targetCellId && n.data.kind === 'cell') ??
    working.find((n) => n.selected && n.data.kind === 'cell') ??
    working.find((n) => n.data.kind === 'cell')

  if (!cell) {
    const added = placeStudioCell(working, { name: 'Target Cell', theme: 'emerald', shape: 'membrane_zoom' })
    working = added.nodes
    cell = working.find((n) => n.id === added.cellId)!
  }

  const kind: Exclude<BioKind, 'cell' | 'membrane' | 'annotation'> =
    options.category === 'signaling' || molecule.topology === 'intracellular'
      ? 'signal'
      : options.category === 'transcription' || molecule.topology === 'nuclear'
        ? 'transcription'
        : molecule.entityClass === 'cytokine_ligand' || molecule.topology === 'secreted'
          ? 'ligand'
          : molecule.entityClass === 'antibody' || molecule.entityClass === 'adc'
            ? 'antibody'
            : 'receptor'

  const compartment: Compartment =
    kind === 'receptor'
      ? 'membrane'
      : kind === 'signal'
        ? 'cytoplasm'
        : kind === 'transcription'
          ? 'nucleus'
          : 'extracellular'

  const count = Math.max(1, Math.min(10, options.count ?? 1))
  const groupId = uid('representation')
  const createdIds: string[] = []
  const cellWidth = Number(cell.style?.width ?? 660)
  const isWholeCell = cell.data.cellShape && cell.data.cellShape !== 'membrane_zoom'

  for (let i = 0; i < count; i++) {
    const id = uid(kind)
    createdIds.push(id)
    const siblings = working.filter((n) => n.parentId === cell!.id && n.data.compartment === compartment)
    const idx = siblings.length
    const baseY = isWholeCell
      ? compartment === 'membrane'
        ? 26
        : compartment === 'extracellular'
          ? -30
          : compartment === 'nucleus'
            ? 215
            : 145
      : compartment === 'membrane'
        ? 174
        : compartment === 'extracellular'
          ? 58
          : compartment === 'nucleus'
            ? 382
            : 288
    const baseX =
      compartment === 'nucleus' && !isWholeCell
        ? Math.min(cellWidth - 130, cellWidth * 0.48 + idx * 115)
        : Math.min(cellWidth - 120, 85 + idx * 140)

    const baseNode: BioNode = {
      id,
      type: 'bio',
      parentId: cell.id,
      ...(isWholeCell && compartment === 'extracellular' ? {} : { extent: 'parent' as const }),
      position: { x: baseX, y: baseY },
      data: createBioData(kind, molecule.name, {
        compartment,
        showName: true,
        positionMode: 'auto',
        visibility: 'visible',
        customColor: options.customColor,
        visualRepresentation: count > 1 ? { groupId, count } : undefined,
      }),
    }
    const applied =
      kind === 'signal' || kind === 'transcription'
        ? { ...baseNode, data: { ...baseNode.data, moleculeId: molecule.id } }
        : applyMoleculeToNode(baseNode, molecule)

    applied.data.compartment = compartment
    applied.data.showName = true
    if (options.customColor) applied.data.customColor = options.customColor
    if (compartment === 'membrane' && cell.data.simpleCell) {
      const pathPosition = Math.max(0.05, Math.min(0.95, (baseX + 46) / cellWidth))
      applied.data.membraneAnchor = { membraneId: cell.id, pathPosition, orientation: 'normal', angle: 0 }
    }
    working.push(applied)
  }

  const laidOut = cell.data.simpleCell ? layoutSimpleCells(working, true) : working
  return { nodes: laidOut, createdIds }
}

/** Connect ANY two biological nodes with the requested InteractionType, dynamically adding compatible ports if needed. */
export function connectStudioNodes(
  nodes: BioNode[],
  sourceId: string,
  targetId: string,
  interaction: InteractionType,
  options: { indirect?: boolean; blockedEdgeId?: string; note?: string } = {},
): { nodes: BioNode[]; edge: BioEdge } {
  const source = nodes.find((n) => n.id === sourceId)
  const target = nodes.find((n) => n.id === targetId)
  if (!source || !target || sourceId === targetId) {
    throw new Error('서로 다른 두 분자를 선택해 주세요.')
  }
  if (['cell', 'membrane', 'annotation'].includes(source.data.kind) || ['cell', 'membrane', 'annotation'].includes(target.data.kind)) {
    throw new Error('세포 배경이 아닌 분자(수용체·항체·신호단백질)를 선택해 주세요.')
  }

  const next = structuredClone(nodes)
  const srcNode = next.find((n) => n.id === sourceId)!
  const dstNode = next.find((n) => n.id === targetId)!

  const semantic: PortDefinition['semantic'] = ['TRANSLOCATE', 'SECRETE', 'INTERNALIZE'].includes(interaction)
    ? 'transport'
    : ['ACTIVATE', 'PHOSPHORYLATE', 'INHIBIT', 'SIGNAL_ABSENT', 'EXPRESS'].includes(interaction)
      ? 'signal'
      : 'binding'

  let outPort = srcNode.data.ports.find(
    (p) =>
      p.role === 'source' &&
      p.allowedInteractions.includes(interaction) &&
      dstNode.data.ports.some((t) => t.role === 'target' && t.semantic === p.semantic && t.allowedInteractions.includes(interaction)),
  )
  let inPort =
    outPort &&
    dstNode.data.ports.find(
      (t) => t.role === 'target' && t.semantic === outPort!.semantic && t.allowedInteractions.includes(interaction),
    )

  if (!outPort || !inPort) {
    const outId = `studio:${semantic}:${interaction.toLowerCase()}:out`
    const inId = `studio:${semantic}:${interaction.toLowerCase()}:in`
    outPort = srcNode.data.ports.find((p) => p.id === outId)
    if (!outPort) {
      outPort = { id: outId, role: 'source', semantic, side: 'bottom', allowedInteractions: [interaction, 'BIND', 'BLOCK', 'ACTIVATE'] }
      srcNode.data.ports.push(outPort)
    } else if (!outPort.allowedInteractions.includes(interaction)) {
      outPort.allowedInteractions.push(interaction)
    }
    inPort = dstNode.data.ports.find((p) => p.id === inId)
    if (!inPort) {
      inPort = { id: inId, role: 'target', semantic, side: 'top', allowedInteractions: [interaction, 'BIND', 'BLOCK', 'ACTIVATE'] }
      dstNode.data.ports.push(inPort)
    } else if (!inPort.allowedInteractions.includes(interaction)) {
      inPort.allowedInteractions.push(interaction)
    }
  }

  const err = validateConnection(srcNode, dstNode, outPort.id, inPort.id, interaction)
  if (err) throw new Error(err)

  const edge: BioEdge = {
    id: uid('edge'),
    source: sourceId,
    target: targetId,
    sourceHandle: outPort.id,
    targetHandle: inPort.id,
    type: 'interaction',
    markerEnd: markerForInteraction(interaction),
    data: {
      interaction,
      indirect: options.indirect,
      blockedEdgeId: options.blockedEdgeId,
      note: options.note,
    },
  }
  return { nodes: next, edge }
}

// ============================================================================
// Curated Publication-Grade MoA Blueprints
// ============================================================================

export interface StudioBlueprint {
  id: string
  title: string
  badge: string
  summary: string
  accent: string
  build: () => { title: string; nodes: BioNode[]; edges: BioEdge[]; library: MoleculeDefinition[] }
}

const catByName = (name: string) => STUDIO_CATALOG.find((item) => item.name === name)!

export const STUDIO_BLUEPRINTS: StudioBlueprint[] = [
  {
    id: 'pd1-checkpoint-blockade',
    title: '항-PD-1 면역관문 차단',
    badge: '면역항암 · 수용체 차단',
    summary: 'anti-PD-1 항체가 PD-1을 차단해 종양 PD-L1의 억제 신호를 막고 CD8⁺ T세포 TCR-ZAP70-NFAT 활성을 회복합니다.',
    accent: '#7348b8',
    build: () => {
      const cellId = 'cell-cd8'
      const width = 760
      const pd1 = catByName('PD-1').molecule
      const tcr = catByName('TCR / CD3').molecule
      const pdl1 = catByName('PD-L1').molecule
      const pmhc = catByName('pMHC').molecule
      const antiPd1 = makeDrug('anti-PD-1', 'igg', ['PD-1'])

      const cellNode: BioNode = {
        id: cellId,
        type: 'cell',
        position: { x: 90, y: 70 },
        style: { width, height: 530 },
        deletable: false,
        data: createBioData('cell', 'CD8⁺ T CELL', {
          simpleCell: true,
          cellShape: 'membrane_zoom',
          cellTheme: 'emerald',
          showName: true,
          membrane: {
            id: cellId,
            name: 'T cell membrane',
            boundaryType: 'plasma_membrane',
            path: [{ x: 26, y: 217 }, { x: width - 26, y: 217 }],
            sideA: 'extracellular',
            sideB: 'cytoplasm',
            closed: false,
            style: 'standard',
            thickness: 18,
            smoothing: 0,
            anchors: [
              { objectId: 'n-pd1', pathPosition: 0.3, orientation: 'normal' },
              { objectId: 'n-tcr', pathPosition: 0.68, orientation: 'normal' },
            ],
          },
        }),
      }

      const nPdl1: BioNode = {
        ...applyMoleculeToNode(
          { id: 'n-pdl1', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 70, y: 48 }, data: createBioData('ligand', 'Tumor PD-L1', { compartment: 'extracellular', showName: true }) },
          { ...pdl1, topology: 'secreted' },
        ),
        data: { ...createBioData('ligand', 'Tumor PD-L1', { compartment: 'extracellular', showName: true, customColor: '#e05d5d' }) },
      }
      const nAntiPd1 = applyMoleculeToNode(
        { id: 'n-anti-pd1', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 215, y: 42 }, data: createBioData('antibody', 'anti-PD-1', { showName: true, autoAimTarget: true, customColor: '#7348b8' }) },
        antiPd1,
      )
      const nPmhc = applyMoleculeToNode(
        { id: 'n-pmhc', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 485, y: 46 }, data: createBioData('ligand', 'Tumor pMHC', { showName: true }) },
        pmhc,
      )
      const nPd1 = applyMoleculeToNode(
        { id: 'n-pd1', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 215, y: 174 }, data: createBioData('receptor', 'PD-1', { showName: true, membraneAnchor: { membraneId: cellId, pathPosition: 0.3, orientation: 'normal', angle: 0 } }) },
        pd1,
      )
      nPd1.data.membraneAnchor = { membraneId: cellId, pathPosition: 0.3, orientation: 'normal', angle: 0 }

      const nTcr = applyMoleculeToNode(
        { id: 'n-tcr', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 485, y: 174 }, data: createBioData('receptor', 'TCR / CD3', { showName: true }) },
        tcr,
      )
      nTcr.data.membraneAnchor = { membraneId: cellId, pathPosition: 0.68, orientation: 'normal', angle: 0 }

      const nShp2: BioNode = {
        id: 'n-shp2',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 195, y: 292 },
        data: createBioData('signal', 'SHP-2', { compartment: 'cytoplasm', state: 'state:signal:inactive', showName: true }),
      }
      const nZap70: BioNode = {
        id: 'n-zap70',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 485, y: 292 },
        data: createBioData('signal', 'ZAP70', { compartment: 'cytoplasm', state: 'state:signal:phosphorylated', phosphorylated: true, showName: true }),
      }
      const nNfat: BioNode = {
        id: 'n-nfat',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 495, y: 392 },
        data: createBioData('transcription', 'NFAT · IFN-γ', { compartment: 'nucleus', state: 'state:transcription:nuclear', phosphorylated: true, showName: true }),
      }

      let nodes: BioNode[] = [cellNode, nPdl1, nAntiPd1, nPmhc, nPd1, nTcr, nShp2, nZap70, nNfat]
      const edges: BioEdge[] = []
      for (const [s, t, rel] of [
        ['n-anti-pd1', 'n-pd1', 'BLOCK'],
        ['n-pd1', 'n-shp2', 'SIGNAL_ABSENT'],
        ['n-pmhc', 'n-tcr', 'BIND'],
        ['n-tcr', 'n-zap70', 'PHOSPHORYLATE'],
        ['n-zap70', 'n-nfat', 'TRANSLOCATE'],
      ] as Array<[string, string, InteractionType]>) {
        const res = connectStudioNodes(nodes, s, t, rel)
        nodes = res.nodes
        edges.push(res.edge)
      }
      return { title: '항-PD-1 면역관문 차단 MoA', nodes, edges, library: [pd1, tcr, pmhc, antiPd1] }
    },
  },
  {
    id: 'il18-cytokine-neutralization',
    title: '항-IL-18 사이토카인 중화',
    badge: '염증 제어 · 가용성 리간드 차단',
    summary: '세포외 가용성 IL-18 사이토카인을 anti-IL-18 항체가 직접 중화·차단하여 IL-18R 결합 및 하위 MyD88/NF-κB 경로를 억제합니다.',
    accent: '#f59e0b',
    build: () => {
      const cellId = 'cell-nk-neut'
      const width = 740
      const il18 = catByName('IL-18').molecule
      const il18ra = catByName('IL-18Rα').molecule
      const il18rb = catByName('IL-18Rβ').molecule
      const antiIl18 = makeDrug('anti-IL-18', 'igg', ['IL-18'])

      const cellNode: BioNode = {
        id: cellId,
        type: 'cell',
        position: { x: 90, y: 70 },
        style: { width, height: 530 },
        deletable: false,
        data: createBioData('cell', 'NK CELL', {
          simpleCell: true,
          cellShape: 'membrane_zoom',
          cellTheme: 'sky',
          showName: true,
          membrane: {
            id: cellId,
            name: 'NK membrane',
            boundaryType: 'plasma_membrane',
            path: [{ x: 26, y: 217 }, { x: width - 26, y: 217 }],
            sideA: 'extracellular',
            sideB: 'cytoplasm',
            closed: false,
            style: 'standard',
            thickness: 18,
            smoothing: 0,
            anchors: [
              { objectId: 'neut-ra', pathPosition: 0.38, orientation: 'normal' },
              { objectId: 'neut-rb', pathPosition: 0.62, orientation: 'normal' },
            ],
          },
        }),
      }

      const nAb = applyMoleculeToNode(
        { id: 'neut-ab', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 135, y: 48 }, data: createBioData('antibody', 'anti-IL-18', { showName: true, autoAimTarget: true, customColor: '#7348b8' }) },
        antiIl18,
      )
      const nIl18 = applyMoleculeToNode(
        { id: 'neut-il18', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 315, y: 54 }, data: createBioData('ligand', 'IL-18', { showName: true, customColor: '#f59e0b' }) },
        il18,
      )
      const nRa = applyMoleculeToNode(
        { id: 'neut-ra', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 260, y: 174 }, data: createBioData('receptor', 'IL-18Rα', { showName: true }) },
        il18ra,
      )
      nRa.data.membraneAnchor = { membraneId: cellId, pathPosition: 0.38, orientation: 'normal', angle: 0 }

      const nRb = applyMoleculeToNode(
        { id: 'neut-rb', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 435, y: 174 }, data: createBioData('receptor', 'IL-18Rβ', { showName: true }) },
        il18rb,
      )
      nRb.data.membraneAnchor = { membraneId: cellId, pathPosition: 0.62, orientation: 'normal', angle: 0 }

      const nMyd: BioNode = {
        id: 'neut-myd',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 345, y: 294 },
        data: createBioData('signal', 'MyD88 / IRAK4', { compartment: 'cytoplasm', state: 'state:signal:inactive', showName: true }),
      }
      const nNfkb: BioNode = {
        id: 'neut-nfkb',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 455, y: 392 },
        data: createBioData('transcription', 'NF-κB · IFN-γ', { compartment: 'nucleus', state: 'state:transcription:cytoplasmic', showName: true }),
      }

      let nodes: BioNode[] = [cellNode, nAb, nIl18, nRa, nRb, nMyd, nNfkb]
      const edges: BioEdge[] = []
      for (const [s, t, rel] of [
        ['neut-ab', 'neut-il18', 'BLOCK'],
        ['neut-il18', 'neut-ra', 'SIGNAL_ABSENT'],
        ['neut-ra', 'neut-myd', 'SIGNAL_ABSENT'],
        ['neut-myd', 'neut-nfkb', 'SIGNAL_ABSENT'],
      ] as Array<[string, string, InteractionType]>) {
        const res = connectStudioNodes(nodes, s, t, rel)
        nodes = res.nodes
        edges.push(res.edge)
      }
      return { title: '항-IL-18 가용성 사이토카인 중화 MoA', nodes, edges, library: [il18, il18ra, il18rb, antiIl18] }
    },
  },
  {
    id: 'il18rb-receptor-blockade',
    title: 'IL-18Rβ 수용체 차단 (SLC-7020)',
    badge: '수용체 복합체 차단',
    summary: 'IL-18이 IL-18Rα에 결합하더라도 SLC-7020이 신호 보조 사슬 IL-18Rβ를 차단해 삼중 복합체 형성과 MyD88/NF-κB 활성을 차단합니다.',
    accent: '#2589bd',
    build: () => {
      const cellId = 'cell-nk-slc'
      const width = 760
      const il18 = catByName('IL-18').molecule
      const il18ra = catByName('IL-18Rα').molecule
      const il18rb = catByName('IL-18Rβ').molecule
      const slc = makeDrug('SLC-7020', 'igg', ['IL-18Rβ'])

      const cellNode: BioNode = {
        id: cellId,
        type: 'cell',
        position: { x: 90, y: 70 },
        style: { width, height: 530 },
        deletable: false,
        data: createBioData('cell', 'NK CELL', {
          simpleCell: true,
          cellShape: 'membrane_zoom',
          cellTheme: 'sky',
          showName: true,
          membrane: {
            id: cellId,
            name: 'NK membrane',
            boundaryType: 'plasma_membrane',
            path: [{ x: 26, y: 217 }, { x: width - 26, y: 217 }],
            sideA: 'extracellular',
            sideB: 'cytoplasm',
            closed: false,
            style: 'standard',
            thickness: 18,
            smoothing: 0,
            anchors: [
              { objectId: 'slc-ra', pathPosition: 0.3, orientation: 'normal' },
              { objectId: 'slc-rb', pathPosition: 0.64, orientation: 'normal' },
            ],
          },
        }),
      }

      const nIl18 = applyMoleculeToNode(
        { id: 'slc-il18', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 205, y: 50 }, data: createBioData('ligand', 'IL-18', { showName: true }) },
        il18,
      )
      const nSlc = applyMoleculeToNode(
        { id: 'slc-ab', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 465, y: 42 }, data: createBioData('antibody', 'SLC-7020', { showName: true, autoAimTarget: true, customColor: '#7348b8' }) },
        slc,
      )
      const nRa = applyMoleculeToNode(
        { id: 'slc-ra', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 205, y: 174 }, data: createBioData('receptor', 'IL-18Rα', { showName: true }) },
        il18ra,
      )
      nRa.data.membraneAnchor = { membraneId: cellId, pathPosition: 0.3, orientation: 'normal', angle: 0 }

      const nRb = applyMoleculeToNode(
        { id: 'slc-rb', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 465, y: 174 }, data: createBioData('receptor', 'IL-18Rβ', { showName: true }) },
        il18rb,
      )
      nRb.data.membraneAnchor = { membraneId: cellId, pathPosition: 0.64, orientation: 'normal', angle: 0 }

      const nMyd: BioNode = {
        id: 'slc-myd',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 455, y: 294 },
        data: createBioData('signal', 'MyD88 / IRAK4', { compartment: 'cytoplasm', state: 'state:signal:inactive', showName: true }),
      }
      const nNfkb: BioNode = {
        id: 'slc-nfkb',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 485, y: 392 },
        data: createBioData('transcription', 'NF-κB · IFN-γ', { compartment: 'nucleus', state: 'state:transcription:cytoplasmic', showName: true }),
      }

      let nodes: BioNode[] = [cellNode, nIl18, nSlc, nRa, nRb, nMyd, nNfkb]
      const edges: BioEdge[] = []
      for (const [s, t, rel] of [
        ['slc-il18', 'slc-ra', 'BIND'],
        ['slc-ab', 'slc-rb', 'BLOCK'],
        ['slc-rb', 'slc-myd', 'SIGNAL_ABSENT'],
        ['slc-myd', 'slc-nfkb', 'SIGNAL_ABSENT'],
      ] as Array<[string, string, InteractionType]>) {
        const res = connectStudioNodes(nodes, s, t, rel)
        nodes = res.nodes
        edges.push(res.edge)
      }
      return { title: 'SLC-7020 IL-18Rβ 수용체 차단 MoA', nodes, edges, library: [il18, il18ra, il18rb, slc] }
    },
  },
  {
    id: 'untreated-vs-treated',
    title: '비처리 vs 약물 처치 비교 (2-패널)',
    badge: '논문·발표용 전후 비교',
    summary: '좌측 질환 활성 상태(IL-18 → MyD88(+P) → 핵 내 NF-κB 전사)와 우측 항체 처치 후 신호 차단 상태를 나란히 비교합니다.',
    accent: '#10b981',
    build: () => {
      const il18 = catByName('IL-18').molecule
      const il18ra = catByName('IL-18Rα').molecule
      const il18rb = catByName('IL-18Rβ').molecule
      const slc = makeDrug('SLC-7020', 'igg', ['IL-18Rβ'])
      const w = 600

      const makePanelCell = (id: string, label: string, panelId: 'untreated' | 'treated', x: number, theme: CellColorTheme): BioNode => ({
        id,
        type: 'cell',
        position: { x, y: 70 },
        style: { width: w, height: 530 },
        deletable: false,
        data: createBioData('cell', label, {
          simpleCell: true,
          cellShape: 'membrane_zoom',
          cellTheme: theme,
          panelId,
          showName: true,
          membrane: {
            id,
            name: `${label} membrane`,
            boundaryType: 'plasma_membrane',
            path: [{ x: 26, y: 217 }, { x: w - 26, y: 217 }],
            sideA: 'extracellular',
            sideB: 'cytoplasm',
            closed: false,
            style: 'standard',
            thickness: 18,
            smoothing: 0,
            anchors: [],
          },
        }),
      })

      const uCell = makePanelCell('cmp-u', 'NK CELL (질환 신호 활성)', 'untreated', 40, 'amber')
      const tCell = makePanelCell('cmp-t', 'NK CELL (+ SLC-7020 처치)', 'treated', 700, 'sky')

      const uIl18 = applyMoleculeToNode({ id: 'cmp-u-il18', type: 'bio', parentId: 'cmp-u', extent: 'parent', position: { x: 155, y: 50 }, data: createBioData('ligand', 'IL-18', { panelId: 'untreated', showName: true }) }, il18)
      const uRa = applyMoleculeToNode({ id: 'cmp-u-ra', type: 'bio', parentId: 'cmp-u', extent: 'parent', position: { x: 155, y: 174 }, data: createBioData('receptor', 'IL-18Rα', { panelId: 'untreated', showName: true }) }, il18ra)
      uRa.data.membraneAnchor = { membraneId: 'cmp-u', pathPosition: 0.3, orientation: 'normal', angle: 0 }
      const uRb = applyMoleculeToNode({ id: 'cmp-u-rb', type: 'bio', parentId: 'cmp-u', extent: 'parent', position: { x: 355, y: 174 }, data: createBioData('receptor', 'IL-18Rβ', { panelId: 'untreated', phosphorylated: true, showName: true }) }, il18rb)
      uRb.data.membraneAnchor = { membraneId: 'cmp-u', pathPosition: 0.65, orientation: 'normal', angle: 0 }
      const uMyd: BioNode = { id: 'cmp-u-myd', type: 'bio', parentId: 'cmp-u', extent: 'parent', position: { x: 345, y: 292 }, data: createBioData('signal', 'MyD88 / IRAK4', { panelId: 'untreated', compartment: 'cytoplasm', state: 'state:signal:phosphorylated', phosphorylated: true, showName: true }) }
      const uNfkb: BioNode = { id: 'cmp-u-nfkb', type: 'bio', parentId: 'cmp-u', extent: 'parent', position: { x: 365, y: 392 }, data: createBioData('transcription', 'NF-κB · IFN-γ', { panelId: 'untreated', compartment: 'nucleus', state: 'state:transcription:nuclear', phosphorylated: true, showName: true }) }

      const tIl18 = applyMoleculeToNode({ id: 'cmp-t-il18', type: 'bio', parentId: 'cmp-t', extent: 'parent', position: { x: 145, y: 50 }, data: createBioData('ligand', 'IL-18', { panelId: 'treated', showName: true }) }, il18)
      const tSlc = applyMoleculeToNode({ id: 'cmp-t-slc', type: 'bio', parentId: 'cmp-t', extent: 'parent', position: { x: 365, y: 42 }, data: createBioData('antibody', 'SLC-7020', { panelId: 'treated', showName: true, autoAimTarget: true }) }, slc)
      const tRa = applyMoleculeToNode({ id: 'cmp-t-ra', type: 'bio', parentId: 'cmp-t', extent: 'parent', position: { x: 145, y: 174 }, data: createBioData('receptor', 'IL-18Rα', { panelId: 'treated', showName: true }) }, il18ra)
      tRa.data.membraneAnchor = { membraneId: 'cmp-t', pathPosition: 0.3, orientation: 'normal', angle: 0 }
      const tRb = applyMoleculeToNode({ id: 'cmp-t-rb', type: 'bio', parentId: 'cmp-t', extent: 'parent', position: { x: 365, y: 174 }, data: createBioData('receptor', 'IL-18Rβ', { panelId: 'treated', showName: true }) }, il18rb)
      tRb.data.membraneAnchor = { membraneId: 'cmp-t', pathPosition: 0.65, orientation: 'normal', angle: 0 }
      const tMyd: BioNode = { id: 'cmp-t-myd', type: 'bio', parentId: 'cmp-t', extent: 'parent', position: { x: 355, y: 292 }, data: createBioData('signal', 'MyD88 / IRAK4', { panelId: 'treated', compartment: 'cytoplasm', state: 'state:signal:inactive', showName: true }) }
      const tNfkb: BioNode = { id: 'cmp-t-nfkb', type: 'bio', parentId: 'cmp-t', extent: 'parent', position: { x: 365, y: 392 }, data: createBioData('transcription', 'NF-κB · IFN-γ', { panelId: 'treated', compartment: 'nucleus', state: 'state:transcription:cytoplasmic', showName: true }) }

      let nodes: BioNode[] = [uCell, tCell, uIl18, uRa, uRb, uMyd, uNfkb, tIl18, tSlc, tRa, tRb, tMyd, tNfkb]
      const edges: BioEdge[] = []
      for (const [s, t, rel] of [
        ['cmp-u-il18', 'cmp-u-ra', 'BIND'],
        ['cmp-u-ra', 'cmp-u-rb', 'ACTIVATE'],
        ['cmp-u-rb', 'cmp-u-myd', 'PHOSPHORYLATE'],
        ['cmp-u-myd', 'cmp-u-nfkb', 'TRANSLOCATE'],
        ['cmp-t-il18', 'cmp-t-ra', 'BIND'],
        ['cmp-t-slc', 'cmp-t-rb', 'BLOCK'],
        ['cmp-t-rb', 'cmp-t-myd', 'SIGNAL_ABSENT'],
        ['cmp-t-myd', 'cmp-t-nfkb', 'SIGNAL_ABSENT'],
      ] as Array<[string, string, InteractionType]>) {
        const res = connectStudioNodes(nodes, s, t, rel)
        nodes = res.nodes
        edges.push(res.edge)
      }
      return { title: '비처리 vs SLC-7020 처치 기전 비교', nodes, edges, library: [il18, il18ra, il18rb, slc] }
    },
  },
  {
    id: 'bispecific-synapse',
    title: '이중특이항체 T세포 브릿지 (CD3 × TAA)',
    badge: '원형 면역세포 ↔ 종양세포 시냅스',
    summary: '원형 CD8⁺ T세포의 CD3와 불규칙 종양세포의 표적 항원(TAA)을 1+1 이중항체가 교차 결합시켜 Granzyme B 살상을 유도합니다.',
    accent: '#e06348',
    build: () => {
      const cd3 = catByName('TCR / CD3').molecule
      const taa = catByName('Tumor Antigen').molecule
      const gzmb = catByName('Granzyme B').molecule
      const bsAb = makeDrug('CD3 × TAA BsAb', 'bispecific', ['TCR / CD3', 'Tumor Antigen'], '1+1')

      const tCell: BioNode = {
        id: 'syn-tcell',
        type: 'cell',
        position: { x: 60, y: 90 },
        style: { width: 420, height: 390 },
        deletable: false,
        data: createBioData('cell', 'CD8⁺ T CELL', { cellShape: 'round_cell', cellTheme: 'emerald', showName: true }),
      }
      const tumorCell: BioNode = {
        id: 'syn-tumor',
        type: 'cell',
        position: { x: 740, y: 90 },
        style: { width: 440, height: 390 },
        deletable: false,
        data: createBioData('cell', 'TUMOR CELL', { cellShape: 'tumor_cell', cellTheme: 'coral', showName: true }),
      }

      const nCd3 = applyMoleculeToNode(
        { id: 'syn-cd3', type: 'bio', parentId: 'syn-tcell', extent: 'parent', position: { x: 315, y: 150 }, data: createBioData('receptor', 'TCR / CD3', { showName: true, visualRotation: 90 }) },
        cd3,
      )
      nCd3.data.membraneAnchor = { membraneId: 'syn-tcell', pathPosition: 0.5, orientation: 'normal', angle: 0 }
      nCd3.data.visualRotation = 90

      const nTaa = applyMoleculeToNode(
        { id: 'syn-taa', type: 'bio', parentId: 'syn-tumor', extent: 'parent', position: { x: 18, y: 150 }, data: createBioData('receptor', 'Tumor Antigen', { showName: true, visualRotation: -90 }) },
        taa,
      )
      nTaa.data.membraneAnchor = { membraneId: 'syn-tumor', pathPosition: 0.5, orientation: 'normal', angle: 0 }
      nTaa.data.visualRotation = -90

      const nBsAb = applyMoleculeToNode(
        { id: 'syn-bsab', type: 'bio', position: { x: 565, y: 195 }, data: createBioData('antibody', 'CD3 × TAA BsAb', { showName: true, autoAimTarget: true }) },
        bsAb,
      )
      const nGzmb = applyMoleculeToNode(
        { id: 'syn-gzmb', type: 'bio', position: { x: 565, y: 335 }, data: createBioData('ligand', 'Granzyme B · Perforin', { showName: true, customColor: '#f43f5e' }) },
        gzmb,
      )

      let nodes: BioNode[] = [tCell, tumorCell, nCd3, nTaa, nBsAb, nGzmb]
      const edges: BioEdge[] = []
      for (const [s, t, rel] of [
        ['syn-bsab', 'syn-cd3', 'BIND'],
        ['syn-bsab', 'syn-taa', 'BIND'],
        ['syn-cd3', 'syn-gzmb', 'SECRETE'],
        ['syn-gzmb', 'syn-taa', 'ACTIVATE'],
      ] as Array<[string, string, InteractionType]>) {
        const res = connectStudioNodes(nodes, s, t, rel)
        nodes = res.nodes
        edges.push(res.edge)
      }
      return { title: 'CD3 × TAA 이중특이항체 면역시냅스 MoA', nodes, edges, library: [cd3, taa, gzmb, bsAb] }
    },
  },
  {
    id: 'jak-stat-signaling',
    title: '사이토카인 · JAK-STAT 전사 활성 경로',
    badge: '세포내 인산화 · 핵 전사',
    summary: 'IL-2가 수용체에 결합해 JAK1/3 인산화(+P) 및 STAT5 이량체의 핵 내 이동과 표적 유전자 전사를 유도하는 표준 신호 경로입니다.',
    accent: '#2563eb',
    build: () => {
      const cellId = 'cell-jak'
      const width = 680
      const il2 = catByName('IL-2').molecule
      const il2r = catByName('IL-2R').molecule

      const cellNode: BioNode = {
        id: cellId,
        type: 'cell',
        position: { x: 110, y: 70 },
        style: { width, height: 530 },
        deletable: false,
        data: createBioData('cell', 'T LYMPHOCYTE', {
          simpleCell: true,
          cellShape: 'membrane_zoom',
          cellTheme: 'emerald',
          showName: true,
          showOrganelles: true,
          membrane: {
            id: cellId,
            name: 'T cell membrane',
            boundaryType: 'plasma_membrane',
            path: [{ x: 26, y: 217 }, { x: width - 26, y: 217 }],
            sideA: 'extracellular',
            sideB: 'cytoplasm',
            closed: false,
            style: 'standard',
            thickness: 18,
            smoothing: 0,
            anchors: [{ objectId: 'jak-r', pathPosition: 0.48, orientation: 'normal' }],
          },
        }),
      }

      const nIl2 = applyMoleculeToNode(
        { id: 'jak-il2', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 290, y: 48 }, data: createBioData('ligand', 'IL-2', { showName: true }) },
        il2,
      )
      const nIl2r = applyMoleculeToNode(
        { id: 'jak-r', type: 'bio', parentId: cellId, extent: 'parent', position: { x: 290, y: 174 }, data: createBioData('receptor', 'IL-2Rαβγ', { showName: true, phosphorylated: true }) },
        il2r,
      )
      nIl2r.data.membraneAnchor = { membraneId: cellId, pathPosition: 0.48, orientation: 'normal', angle: 0 }

      const nJak: BioNode = {
        id: 'jak-1',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 290, y: 288 },
        data: createBioData('signal', 'JAK1 / JAK3', { compartment: 'cytoplasm', state: 'state:signal:phosphorylated', phosphorylated: true, showName: true }),
      }
      const nStat: BioNode = {
        id: 'jak-stat5',
        type: 'bio',
        parentId: cellId,
        extent: 'parent',
        position: { x: 395, y: 392 },
        data: createBioData('transcription', 'STAT5 Dimer', { compartment: 'nucleus', state: 'state:transcription:nuclear', phosphorylated: true, showName: true }),
      }

      let nodes: BioNode[] = [cellNode, nIl2, nIl2r, nJak, nStat]
      const edges: BioEdge[] = []
      for (const [s, t, rel] of [
        ['jak-il2', 'jak-r', 'BIND'],
        ['jak-r', 'jak-1', 'PHOSPHORYLATE'],
        ['jak-1', 'jak-stat5', 'TRANSLOCATE'],
      ] as Array<[string, string, InteractionType]>) {
        const res = connectStudioNodes(nodes, s, t, rel)
        nodes = res.nodes
        edges.push(res.edge)
      }
      return { title: 'IL-2 · JAK-STAT5 신호전달 MoA', nodes, edges, library: [il2, il2r] }
    },
  },
]
