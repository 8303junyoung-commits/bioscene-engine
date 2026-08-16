import type { Edge, Node } from '@xyflow/react'

export type Compartment = 'extracellular' | 'membrane' | 'cytoplasm' | 'nucleus' | 'endosome' | 'mitochondria'
export type BioKind = 'cell' | 'membrane' | 'receptor' | 'ligand' | 'antibody' | 'signal' | 'transcription' | 'annotation'
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
export type MoleculePrivacy = 'public' | 'private'
export type MoleculeClass = 'protein' | 'antibody' | 'engineered_construct'
export type MoleculeEntityClass = 'natural_protein' | 'mutant_protein' | 'antibody' | 'fusion_protein' | 'receptor_trap' | 'cytokine_ligand' | 'enzyme' | 'peptide' | 'adc' | 'protein_drug_conjugate' | 'engineered_protein' | 'unknown_custom'
export type MoleculeOrigin = 'natural' | 'engineered' | 'mutant' | 'synthetic'
export type MoleculeTopology = 'soluble' | 'secreted' | 'single_pass_membrane' | 'multi_pass_membrane' | 'membrane_associated' | 'intracellular' | 'nuclear' | 'organelle_associated' | 'unknown'
export type MoleculeSaveStatus = 'unclassified' | 'draft' | 'saved' | 'needs_review'
export type MoleculeFieldSource = 'user' | 'UniProt' | 'BioScene inference' | 'migration'
export type AntibodyFormat = 'igg' | 'fab' | 'fab2' | 'scfv' | 'vhh' | 'scfv_fc' | 'fab_fc' | 'bispecific' | 'trispecific' | 'multispecific' | 'multivalent' | 'antibody_fusion' | 'custom_antibody'
export type BindingUnitType = 'Fab' | 'scFv' | 'VHH' | 'protein_domain'
export type ConstructComponentType = 'binding_unit' | 'Fc' | 'protein_domain' | 'linker' | 'payload'
export type ArchitectureSymmetry = 'symmetric' | 'asymmetric' | 'custom'
export type AntibodyStructuralFamily = 'igg_like' | 'dvd_igg' | 'igg_appended_scfv' | 'cross_arm' | 'tandem_scfv' | 'fab_scfv_fusion' | 'vhh_multispecific' | 'fc_multivalent' | 'custom'
export type ProteinTopologyClass = 'soluble' | 'single_pass_receptor' | 'multi_pass_membrane' | 'secreted_cytokine' | 'enzyme' | 'unknown'
export type ProteinVisualScaling = 'schematic' | 'sequence_length'
export type StructuralTemplate = 'globular' | 'cytokine' | 'enzyme' | 'single_pass_receptor' | 'multi_pass_receptor' | 'gpcr' | 'ion_channel' | 'receptor_complex' | 'igg' | 'fab' | 'fab2' | 'bispecific_igg' | 'asymmetric_bispecific' | 'fc_fusion' | 'receptor_trap' | 'custom_construct'
export type AnnotationSource = 'UniProt' | 'user' | 'inferred' | 'template'
export type AnnotationConfidence = 'high' | 'medium' | 'low' | 'confirmed'
export type DomainDisplayLevel = 'hidden' | 'simplified' | 'named' | 'functional' | 'full'
export type FunctionalPortType = 'binding' | 'recruitment' | 'activation' | 'inhibition' | 'cleavage' | 'enzymatic' | 'phosphorylation' | 'transport' | 'translocation' | 'internalization' | 'signal_input' | 'signal_output' | 'membrane_anchor'
export type WorkspacePreset = 'presentation_16_9' | 'presentation_4_3' | 'square' | 'landscape' | 'portrait' | 'a4_landscape' | 'a4_portrait' | 'custom'
export type WorkspaceBackground = 'white' | 'transparent' | 'light_gray' | 'custom'
export type MembraneBoundaryType = 'plasma_membrane' | 'basement_membrane' | 'epithelial_barrier' | 'endothelial_barrier' | 'custom'
export type MembraneStyle = 'simple' | 'standard' | 'detailed'
export type DrawingTool = 'select' | 'pan' | 'freehand_membrane' | 'straight_membrane' | 'place_cell' | 'place_receptor' | 'place_antibody' | 'place_ligand' | 'place_annotation'

export interface DomainDefinition {
  id: string
  label: string
  kind: DomainKind
  start?: number
  end?: number
  function?: string
  target?: string
  role?: string
  source?: AnnotationSource
  functionSource?: AnnotationSource
  targetSource?: AnnotationSource
  confidence?: AnnotationConfidence
  highlighted?: boolean
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
  functionalType?: FunctionalPortType
  targetHint?: string
}

export interface StructuralModel {
  template: StructuralTemplate
  templateSource: AnnotationSource
  templateConfidence: AnnotationConfidence
  displayLevel: DomainDisplayLevel
  topology: {
    signalPeptide: boolean
    extracellular: boolean
    transmembrane: boolean
    cytoplasmic: boolean
  }
  domains: DomainDefinition[]
  classification?: ProteinTopologyClass
  visualScaling?: ProteinVisualScaling
  modified?: boolean
  architecture?: ConstructArchitecture
}

export interface MoleculeSpecificity {
  id: string
  label: string
  target: string
  valency: number
  unitType: BindingUnitType
  function: string
  epitope?: string
  affinityLabel?: string
}

export interface ConstructComponent {
  id: string
  type: ConstructComponentType
  label: string
  specificityId?: string
  target?: string
  function?: string
  sourceProtein?: string
  domainName?: string
  attachment?: string
  order: number
}

export interface ConstructArchitecture {
  kind: 'antibody' | 'fusion' | 'custom'
  antibodyFormat?: AntibodyFormat
  iggSubtype?: 'IgG1' | 'IgG2' | 'IgG3' | 'IgG4' | 'Custom Fc'
  scfvOrientation?: 'VH-linker-VL' | 'VL-linker-VH'
  valencyPreset?: '1+1' | '2+1' | '1+2' | '2+2' | 'custom'
  symmetry?: ArchitectureSymmetry
  structuralFamily?: AntibodyStructuralFamily
  fc: boolean
  specificities: MoleculeSpecificity[]
  components: ConstructComponent[]
}

export interface UniProtFeatureRecord {
  type: string
  description?: string
  start?: number
  end?: number
  source: 'UniProt'
}

export interface MoleculeDefinition {
  id: string
  name: string
  privacy: MoleculePrivacy
  moleculeClass: MoleculeClass
  entityClass: MoleculeEntityClass
  origin: MoleculeOrigin
  topology: MoleculeTopology
  saveStatus: MoleculeSaveStatus
  identitySource: MoleculeFieldSource
  identityConfidence?: AnnotationConfidence
  topologySource?: MoleculeFieldSource
  topologyConfidence?: AnnotationConfidence
  topologyConfirmed: boolean
  suggestedEntityClass?: MoleculeEntityClass
  suggestedTopology?: MoleculeTopology
  parentMoleculeId?: string
  architecture?: ConstructArchitecture
  geneName?: string
  proteinName?: string
  species?: string
  uniprotAccession?: string
  length?: number
  sequence?: string
  subcellularLocations?: string[]
  uniprotFeatures?: UniProtFeatureRecord[]
  originalStructuralModel?: StructuralModel
  uniprotFetchedAt?: string
  uniprotCached?: boolean
  structuralModel: StructuralModel
  lookupStatus: 'local' | 'suggested' | 'searching' | 'selecting' | 'enriched' | 'failed'
  lookupMessage?: string
  updatedAt: string
  savedAt?: string
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
  moleculeId?: string
  structuralModel?: StructuralModel
  membrane?: MembraneDefinition
  membraneAnchor?: MembraneProteinAnchor
  locked?: boolean
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

export type BioNode = Node<BioNodeData, 'cell' | 'bio' | 'annotation' | 'membrane'>
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
  schema: 'bioscene.scene.v0.14'
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
  moleculeLibrary: MoleculeDefinition[]
  customFunctions: string[]
  workspace: FigureWorkspace
}

export interface FigureWorkspace {
  preset: WorkspacePreset
  width: number
  height: number
  unit: 'px' | 'pt' | 'mm'
  background: WorkspaceBackground
  customBackground?: string
  safeMargin: number
  showSafeMargin: boolean
  showGrid: boolean
  showCenterGuide: boolean
  snapToGrid: boolean
  gridSize: number
}

export interface MembranePoint { x: number; y: number }

export interface MembraneAnchorRecord {
  objectId: string
  pathPosition: number
  orientation: 'normal' | 'flipped'
}

export interface MembraneDefinition {
  id: string
  name: string
  boundaryType: MembraneBoundaryType
  path: MembranePoint[]
  sideA: 'extracellular' | 'cytoplasm'
  sideB: 'extracellular' | 'cytoplasm'
  closed: boolean
  style: MembraneStyle
  thickness: number
  smoothing: number
  anchors: MembraneAnchorRecord[]
}

export interface MembraneProteinAnchor {
  membraneId: string
  pathPosition: number
  orientation: 'normal' | 'flipped'
  angle: number
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

