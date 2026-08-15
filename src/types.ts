import type { Edge, Node } from '@xyflow/react'

export type Compartment = 'extracellular' | 'membrane' | 'cytoplasm' | 'nucleus' | 'endosome' | 'mitochondria'
export type BioKind = 'cell' | 'receptor' | 'ligand' | 'antibody' | 'signal' | 'transcription' | 'annotation'
export type InteractionType = 'BIND' | 'BLOCK' | 'AGONIZE' | 'CLUSTER' | 'PHOSPHORYLATE' | 'ACTIVATE' | 'INHIBIT' | 'SIGNAL_ABSENT' | 'TRANSLOCATE' | 'SECRETE' | 'EXPRESS' | 'INTERNALIZE' | 'DEGRADE' | 'CLEAVE' | 'RECRUIT' | 'DIMERIZE' | 'COMPETE'
export type ConstraintMode = 'biological' | 'free'
export type StylePreset = 'scientific-clean' | 'journal-light' | 'presentation-dark'
export type ExportPreset = 'slide-wide' | 'slide-standard' | 'journal-square' | 'transparent'
export type AlignmentAction = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'distribute-x' | 'distribute-y'
export type PanelId = 'single' | 'untreated' | 'treated' | 'tissue'
export type SceneTemplateId = 'receptor-blockade-single' | 'receptor-blockade-comparison' | 't-cell-activation' | 'hepatocyte-response' | 'tumor-immune-crosstalk' | 'endosomal-trafficking'
export type MechanismPanel = 'single' | 'untreated' | 'treated' | 'both'
export type DomainKind = 'extracellular' | 'transmembrane' | 'intracellular' | 'variable' | 'constant' | 'functional'
export type SiteSemantic = 'ligand-binding' | 'antibody-epitope' | 'dimerization' | 'phosphorylation' | 'localization' | 'catalytic'
export type SceneType = 'empty' | 'ecm_membrane' | 'full_signaling' | 'intracellular' | 'cellular_interaction' | 'environment' | 'organ_system' | 'molecular_complex' | 'process_timeline'
export type DetailLevel = 1 | 2 | 3 | 4
export type AbstractionLevel = 'icon' | 'cartoon' | 'domain' | 'structure'
export type LayoutMode = 'single' | 'comparison' | 'multi_panel' | 'overview_inset'
export type ObjectVisibility = 'visible' | 'hidden_by_scope' | 'manually_hidden' | 'collapsed'
export type PositionMode = 'auto' | 'manual' | 'pinned'

export interface DomainDefinition {
  id: string
  label: string
  kind: DomainKind
}

export interface SiteDefinition {
  id: string
  label: string
  domainId: string
  semantic: SiteSemantic
}

export interface AnchorDefinition {
  id: string
  type: 'membrane' | 'compartment' | 'parent'
  compartment: Compartment
  orientation?: 'extracellular-to-cytoplasm' | 'free'
}

export interface StateDefinition {
  id: string
  label: string
  allowedCompartments: Compartment[]
}

export interface PortDefinition {
  id: string
  role: 'source' | 'target'
  semantic: 'binding' | 'signal' | 'transport'
  side: 'top' | 'right' | 'bottom' | 'left'
  domainId?: string
  siteId?: string
  allowedInteractions: InteractionType[]
}

export interface BioNodeFields {
  label: string
  subtitle?: string
  kind: BioKind
  compartment: Compartment
  state?: string
  target?: string
  domains: DomainDefinition[]
  sites: SiteDefinition[]
  ports: PortDefinition[]
  anchors: AnchorDefinition[]
  states: StateDefinition[]
  allowedCompartments: Compartment[]
  panelId?: PanelId
  provenance?: 'explicit' | 'inferred' | 'template'
  asset?: AssetReference
  annotation?: { title: string; body: string; tone: 'info' | 'finding' | 'warning' }
  visibility?: ObjectVisibility
  positionMode?: PositionMode
  sceneType?: SceneType
  showCompartmentLabels?: boolean
  showOrganelles?: boolean
}

export interface AssetReference {
  id: string
  name: string
  category: string
  author: string
  licenseSpdx: string
  licenseUrl: string
  file: string
  sourceUrl: string
  synonyms: string[]
  identifiers: { database: 'UniProt' | 'Reactome' | 'HGNC' | 'custom'; id: string; url?: string }[]
  svgDomains: { id: string; label: string; selector: 'svg'; mappingStatus: 'whole-asset' | 'suggested' }[]
}

export type BioNodeData = BioNodeFields & Record<string, unknown>
export type BioNodePatch = Partial<BioNodeFields>

export interface InteractionData extends Record<string, unknown> {
  interaction: InteractionType
  note?: string
  evidence?: InteractionEvidence
}

export interface InteractionEvidence {
  status: 'supported' | 'hypothesis' | 'needs-review'
  citation: string
  url?: string
  note?: string
  literatureIds?: string[]
}

export type BioNode = Node<BioNodeData, 'cell' | 'bio' | 'annotation'>
export type BioEdge = Edge<InteractionData, 'interaction'>

export type LiteratureSourceType = 'pubmed' | 'doi' | 'url' | 'internal'

export interface EvidenceAppraisal {
  peerReviewed: boolean
  directMechanism: boolean
  humanRelevant: boolean
  replicated: boolean
  fullTextAvailable: boolean
}

export interface LiteratureRecord {
  id: string
  title: string
  sourceType: LiteratureSourceType
  identifier: string
  url?: string
  authors?: string
  year?: number
  abstract?: string
  metadataStatus?: 'local' | 'enriched' | 'failed'
  enrichedAt?: string
  importedAt: string
  appraisal: EvidenceAppraisal
  score: number
}

export interface TissueModule {
  id: string
  name: string
  description: string
  createdAt: string
  nodes: BioNode[]
  edges: BioEdge[]
  literature: LiteratureRecord[]
}

export interface CollaborationComment {
  id: string
  author: string
  body: string
  createdAt: string
  resolved: boolean
}

export interface ActivityEvent {
  id: string
  actor: string
  action: string
  createdAt: string
}

export interface CollaborationState {
  participants: string[]
  comments: CollaborationComment[]
  activity: ActivityEvent[]
}

export interface RoomConfig {
  endpoint: string
  roomId: string
  authMode: 'none' | 'bearer' | 'api-key'
  apiKeyHeader: string
  revision?: string
  lastSyncedAt?: string
}

export interface MechanismEntity {
  id: string
  label: string
  kind: BioKind
  source: 'explicit' | 'inferred'
  compartment?: Compartment
  target?: string
}

export interface MechanismInteraction {
  id: string
  source: string
  target: string
  interaction: InteractionType
  panel: MechanismPanel
  sourceText?: string
}

export interface ParsedMechanism {
  title: string
  input: string
  templateId: SceneTemplateId
  entities: MechanismEntity[]
  interactions: MechanismInteraction[]
  warnings: string[]
}

export interface SceneFile {
  schema: 'bioscene.scene.v0.11'
  title: string
  templateId?: SceneTemplateId
  createdAt: string
  constraintMode: ConstraintMode
  nodes: BioNode[]
  edges: BioEdge[]
  mechanism?: ParsedMechanism
  stylePreset: StylePreset
  review: ReviewMetadata
  literature: LiteratureRecord[]
  collaboration: CollaborationState
  visualizationProfile: VisualizationProfile
  views: SceneView[]
  activeViewId?: string
}

export interface VisualizationProfile {
  sceneType: SceneType
  detailLevel: DetailLevel
  abstractionLevel: AbstractionLevel
  layoutMode: LayoutMode
  evidenceDisplay: boolean
  compartmentLabels: boolean
  organelleDisplay: boolean
}

export interface SceneView {
  id: string
  name: string
  profile: VisualizationProfile
  positions: Record<string, { x: number; y: number; positionMode?: PositionMode }>
  visibility: Record<string, ObjectVisibility>
  createdAt: string
}

export interface ReviewMetadata {
  status: 'draft' | 'in-review' | 'approved'
  reviewers: string[]
  notes: string
  updatedAt: string
}

export interface SceneRevision {
  id: string
  label: string
  createdAt: string
  scene: SceneFile
}
