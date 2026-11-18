import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Ban,
  BookOpen,
  Circle,
  ClipboardCheck,
  Cloud,
  Component,
  Copy,
  Download,
  FlaskConical,
  FolderOpen,
  Hand,
  HelpCircle,
  Link2,
  Maximize2,
  Minus,
  MousePointer2,
  PanelsTopLeft,
  Pill,
  Pin,
  Plus,
  Redo2,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Type,
  Undo2,
  Workflow,
  Zap,
} from 'lucide-react'
import { toPng, toSvg } from 'html-to-image'
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import { BioNode } from './components/BioNode'
import { CellNode } from './components/CellNode'
import { Inspector } from './components/Inspector'
import { InteractionEdge } from './components/InteractionEdge'
import { MechanismComposer } from './components/MechanismComposer'
import { SmartAssetBrowser } from './components/SmartAssetBrowser'
import { ProductionPanel } from './components/ProductionPanel'
import { AnnotationNode } from './components/AnnotationNode'
import { ReviewPanel } from './components/ReviewPanel'
import { LiteraturePanel } from './components/LiteraturePanel'
import { TissueModulePanel } from './components/TissueModulePanel'
import { CollaborationPanel } from './components/CollaborationPanel'
import { ContextHelp } from './components/ContextHelp'
import { SceneSettingsPanel } from './components/SceneSettingsPanel'
import { MoleculeSetupPanel, type MoleculeApplyPolicy } from './components/MoleculeSetupPanel'
import { MembraneNode } from './components/MembraneNode'
import { WorkspaceSetupPanel } from './components/WorkspaceSetupPanel'
import { ObjectContextMenu, type ContextTarget } from './components/ObjectContextMenu'
import { StudioPalette, type PaletteTab } from './components/StudioPalette'
import { StudioInspector } from './components/StudioInspector'
import { createBioData, inferInteraction } from './biology'
import { cloneTemplate, DEFAULT_TEMPLATE_ID, sceneTemplates } from './data'
import { sceneFromMechanism } from './mechanism'
import type {
  AlignmentAction,
  AssetReference,
  BioEdge,
  BioKind,
  BioNode as BioNodeType,
  BioNodePatch,
  CollaborationState,
  ConstraintMode,
  DrawingTool,
  ExportPreset,
  FigureWorkspace,
  InteractionData,
  InteractionType,
  LiteratureRecord,
  MembraneDefinition,
  MembranePoint,
  MoleculeDefinition,
  ParsedMechanism,
  ReviewMetadata,
  RoomConfig,
  SceneFile,
  SceneRevision,
  SceneTemplateId,
  SceneView,
  StylePreset,
  TissueModule,
  VisualizationProfile,
} from './types'
import {
  autoLayout,
  biologicalWarnings,
  constrainNode,
  downloadText,
  findAvailablePosition,
  parseSceneFile,
  parseTissueModule,
} from './utils'
import { uid } from './identity'
import { markerForInteraction } from './visualGrammar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { BackendConflictError, enrichLiterature, pullRoom, pushRoom, sanitizedEndpoint } from './backend'
import { sendMagicLink, signOutSupabase, supabaseApiEndpoint, supabaseConfigured, watchSupabaseSession } from './supabaseClient'
import { applyVisualizationProfile, captureView, defaultVisualizationProfile, restoreView, sceneTypeLabels } from './sceneViews'
import { applyMoleculeToNode, createMolecule, portsFromDomains, scenePlacementForMolecule, structuralModelForMolecule, syncArchitecture } from './molecules'
import { membranePathD, nearestPathPoint, pathPointAt, smoothMembranePoints } from './membraneGeometry'
import { defaultFigureWorkspace, workspaceBackground } from './workspace'
import { CanvasDisplayProvider, cleanOverlays, type CanvasOverlay, type CanvasOverlays } from './components/CanvasDisplayContext'
import { qaApiEnabled, qaClone } from './qaApi'
import { addSimpleDrug, changeRepresentation, layoutSimpleCells, pruneSimpleEdges, treatedComparison, type SimpleRelation } from './simpleMoa'
import {
  connectStudioNodes,
  placeCatalogMolecule,
  placeStudioCell,
  STUDIO_BLUEPRINTS,
  type CatalogItem,
  type StudioBlueprint,
} from './studioPresets'
import { assertVisibleBlocksForCapture, blueprintRelationship, inlineSvgPaintForCapture } from './exportGraphics'
import './studio.css'

const nodeTypes = { cell: CellNode, bio: BioNode, annotation: AnnotationNode, membrane: MembraneNode }
const edgeTypes = { interaction: InteractionEdge }
const AUTOSAVE_KEY = 'bioscene.scene.autosave.v0.14'
const REVISION_KEY = 'bioscene.scene.revisions.v0.10'
const MODULE_KEY = 'bioscene.tissue.modules.v0.10'
const ROOM_KEY = 'bioscene.room.config.v0.10'
const ROOM_TOKEN_KEY = 'bioscene.room.token.session.v0.10'
const emptyCollaboration = (): CollaborationState => ({ participants: [], comments: [], activity: [] })

const exportSpecs: Record<ExportPreset, { width: number; height: number; background?: string; layout: 'LAYOUT_WIDE' | 'LAYOUT_4X3' | 'BIOSCENE_SQUARE' }> = {
  'slide-wide': { width: 1920, height: 1080, background: '#f8fbf9', layout: 'LAYOUT_WIDE' },
  'slide-standard': { width: 1600, height: 1200, background: '#f8fbf9', layout: 'LAYOUT_4X3' },
  'journal-square': { width: 1800, height: 1800, background: '#ffffff', layout: 'BIOSCENE_SQUARE' },
  transparent: { width: 2400, height: 1350, layout: 'LAYOUT_WIDE' },
}

const styleBackground: Record<StylePreset, string> = {
  'scientific-clean': '#f6faf8',
  'journal-light': '#ffffff',
  'presentation-dark': '#17211e',
}

const defaultLabels: Record<Exclude<BioKind, 'cell' | 'annotation' | 'membrane'>, string> = {
  receptor: 'Receptor',
  ligand: 'Cytokine',
  antibody: 'Antibody',
  signal: 'Kinase',
  transcription: 'Transcription',
}

function readAutosavedScene() {
  try {
    const raw =
      localStorage.getItem(AUTOSAVE_KEY) ??
      localStorage.getItem('bioscene.scene.autosave.v0.13') ??
      localStorage.getItem('bioscene.scene.autosave.v0.12') ??
      localStorage.getItem('bioscene.scene.autosave.v0.11') ??
      localStorage.getItem('bioscene.scene.autosave.v0.10')
    if (!raw) return undefined
    return parseSceneFile(JSON.parse(raw))
  } catch {
    return undefined
  }
}

function readRevisions(): SceneRevision[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REVISION_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value
      .flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const candidate = item as Partial<SceneRevision>
        const scene = parseSceneFile(candidate.scene)
        return typeof candidate.id === 'string' && typeof candidate.label === 'string' && typeof candidate.createdAt === 'string' && scene
          ? [{ id: candidate.id, label: candidate.label, createdAt: candidate.createdAt, scene }]
          : []
      })
      .slice(0, 5)
  } catch {
    return []
  }
}

function readModules(): TissueModule[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MODULE_KEY) ?? '[]')
    return Array.isArray(value) ? value.map(parseTissueModule).filter((item): item is TissueModule => !!item).slice(0, 30) : []
  } catch {
    return []
  }
}

function readRoom(): RoomConfig {
  const fallbackEndpoint = String(import.meta.env.VITE_BIOSCENE_API_BASE ?? '')
  try {
    const value = JSON.parse(localStorage.getItem(ROOM_KEY) ?? '{}')
    const endpoint =
      typeof value.endpoint === 'string' && value.endpoint
        ? sanitizedEndpoint(value.endpoint)
        : fallbackEndpoint
          ? sanitizedEndpoint(fallbackEndpoint)
          : ''
    return {
      endpoint,
      roomId: typeof value.roomId === 'string' ? value.roomId : '',
      authMode: ['none', 'bearer', 'api-key'].includes(value.authMode) ? value.authMode : 'none',
      apiKeyHeader: typeof value.apiKeyHeader === 'string' && /^[A-Za-z][A-Za-z0-9-]{1,63}$/.test(value.apiKeyHeader) ? value.apiKeyHeader : 'X-API-Key',
      revision: typeof value.revision === 'string' ? value.revision : undefined,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : undefined,
    }
  } catch {
    return { endpoint: fallbackEndpoint, roomId: '', authMode: 'none', apiKeyHeader: 'X-API-Key' }
  }
}

function readRoomToken() {
  try {
    return sessionStorage.getItem(ROOM_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function csvCell(value: unknown) {
  const source = String(value ?? '')
  const safe = /^[=+\-@\t\r]/.test(source) ? `'${source}` : source
  return `"${safe.replaceAll('"', '""')}"`
}

async function fitDataUrl(source: string, width: number, height: number, background?: string, credit?: string) {
  const image = new window.Image()
  image.src = source
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Image render failed'))
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
  }
  const scale = Math.min(width / image.width, height / image.height) * 0.94
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  if (credit) {
    context.fillStyle = background === '#17211e' ? 'rgba(23,33,30,.88)' : 'rgba(255,255,255,.88)'
    context.fillRect(0, height - 34, width, 34)
    context.fillStyle = background === '#17211e' ? '#d8e5df' : '#53665e'
    context.font = '16px sans-serif'
    context.textAlign = 'right'
    context.fillText(credit.slice(0, 180), width - 18, height - 11)
  }
  return canvas.toDataURL('image/png')
}

function assetAttribution(nodes: BioNodeType[]) {
  const assets = Array.from(new Map(nodes.flatMap((node) => (node.data.asset ? [[node.data.asset.id, node.data.asset] as const] : []))).values())
  const full = assets.map((asset) => `${asset.name} — ${asset.author} — ${asset.licenseSpdx}\nSource: ${asset.sourceUrl}\nLicense: ${asset.licenseUrl}`).join('\n\n')
  const compact = assets.length
    ? `Assets: ${assets.slice(0, 3).map((asset) => `${asset.name} © ${asset.author} (${asset.licenseSpdx})`).join('; ')}${assets.length > 3 ? `; +${assets.length - 3} more` : ''}`
    : ''
  return { full, compact }
}

function addSvgCredit(dataUrl: string, credit: string, width: number, height: number) {
  if (!credit) return dataUrl
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl
  const payload = dataUrl.slice(comma + 1)
  const svg = dataUrl.slice(0, comma).includes(';base64')
    ? new TextDecoder().decode(Uint8Array.from(atob(payload), (character) => character.charCodeAt(0)))
    : decodeURIComponent(payload)
  const escaped = credit.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const next = svg.replace(
    '</svg>',
    `<rect x="0" y="${height - 32}" width="${width}" height="32" fill="rgba(255,255,255,.88)"/><text x="${width - 16}" y="${height - 10}" text-anchor="end" font-family="sans-serif" font-size="14" fill="#53665e">${escaped.slice(0, 180)}</text></svg>`,
  )
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(next)}`
}

function nodeSize(node: BioNodeType) {
  const width = typeof node.style?.width === 'number' ? node.style.width : Number.parseFloat(String(node.style?.width ?? 96)) || 96
  const height = typeof node.style?.height === 'number' ? node.style.height : Number.parseFloat(String(node.style?.height ?? 76)) || 76
  return { width, height }
}

function anchoredPosition(membraneNode: BioNodeType, pathPosition: number) {
  const membrane = membraneNode.data.membrane
  if (!membrane) return undefined
  const local = pathPointAt(membrane.path, pathPosition)
  return { x: membraneNode.position.x + local.point.x, y: membraneNode.position.y + local.point.y, angle: local.angle }
}

function repositionMembraneAnchors(items: BioNodeType[], membraneNode: BioNodeType) {
  return items.map((item) => {
    const anchor = item.data.membraneAnchor
    if (!anchor || anchor.membraneId !== membraneNode.id) return item
    const target = anchoredPosition(membraneNode, anchor.pathPosition)
    if (!target) return item
    const size = nodeSize(item)
    return {
      ...item,
      position: { x: target.x - size.width / 2, y: target.y - size.height / 2 },
      data: { ...item.data, membraneAnchor: { ...anchor, angle: target.angle } },
    }
  })
}

const mapSimpleRelation = (r: SimpleRelation): InteractionType =>
  r === 'Block' ? 'BLOCK' : r === 'Signal' ? 'ACTIVATE' : 'BIND'

function AppCanvas() {
  const initialData = useMemo(() => {
    const saved = readAutosavedScene()
    if (saved) return { saved, starter: undefined }
    const starter = STUDIO_BLUEPRINTS[0].build()
    return { saved: undefined, starter }
  }, [])

  const [paletteTab, setPaletteTab] = useState<PaletteTab>('presets')
  const [exportFormat, setExportFormat] = useState<'svg' | 'png' | 'pptx' | 'package'>('svg')
  const [connectMode, setConnectMode] = useState<{ interaction: InteractionType; indirect?: boolean; sourceId?: string }>()

  const [nodes, setNodes] = useState<BioNodeType[]>(() => initialData.saved?.nodes ?? initialData.starter?.nodes ?? [])
  const [edges, setEdges] = useState<BioEdge[]>(() => initialData.saved?.edges ?? initialData.starter?.edges ?? [])
  const [mode, setMode] = useState<ConstraintMode>(() => initialData.saved?.constraintMode ?? 'free')
  const [templateId, setTemplateId] = useState<SceneTemplateId>(() => initialData.saved?.templateId ?? DEFAULT_TEMPLATE_ID)
  const [sceneTitle, setSceneTitle] = useState(() => initialData.saved?.title ?? initialData.starter?.title ?? '새 MoA 그림')
  const [sceneCreatedAt, setSceneCreatedAt] = useState(() => initialData.saved?.createdAt ?? new Date().toISOString())
  const [mechanism, setMechanism] = useState<ParsedMechanism | undefined>(() => initialData.saved?.mechanism)
  const [review, setReview] = useState<ReviewMetadata>(() => initialData.saved?.review ?? { status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() })
  const [literature, setLiterature] = useState<LiteratureRecord[]>(() => initialData.saved?.literature ?? [])
  const [collaboration, setCollaboration] = useState<CollaborationState>(() => initialData.saved?.collaboration ?? emptyCollaboration())
  const [room, setRoom] = useState<RoomConfig>(readRoom)
  const [roomToken, setRoomToken] = useState(readRoomToken)
  const [signedInEmail, setSignedInEmail] = useState<string>()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [modules, setModules] = useState<TissueModule[]>(readModules)
  const [stylePreset, setStylePreset] = useState<StylePreset>(() => initialData.saved?.stylePreset ?? 'scientific-clean')
  const [visualizationProfile, setVisualizationProfile] = useState<VisualizationProfile>(() => initialData.saved?.visualizationProfile ?? { ...defaultVisualizationProfile, detailLevel: 4 })
  const [canvasOverlays, setCanvasOverlays] = useState<CanvasOverlays>(() => ({ ...cleanOverlays, names: true }))
  const [views, setViews] = useState<SceneView[]>(() => initialData.saved?.views ?? [])
  const [activeViewId, setActiveViewId] = useState<string | undefined>(() => initialData.saved?.activeViewId)
  const [moleculeLibrary, setMoleculeLibrary] = useState<MoleculeDefinition[]>(() => initialData.saved?.moleculeLibrary ?? initialData.starter?.library ?? [])
  const [customFunctions, setCustomFunctions] = useState<string[]>(() => initialData.saved?.customFunctions ?? [])
  const [workspace, setWorkspace] = useState<FigureWorkspace>(() => initialData.saved?.workspace ?? { ...defaultFigureWorkspace })

  const [showWorkspaceSetup, setShowWorkspaceSetup] = useState(false)
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('select')
  const [draftMembrane, setDraftMembrane] = useState<{ flow: MembranePoint[]; screen: MembranePoint[] }>()
  const [continuousTool, setContinuousTool] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [contextTarget, setContextTarget] = useState<ContextTarget>()
  const [autosaveStatus, setAutosaveStatus] = useState<'saving' | 'saved'>('saved')
  const [exportPreset, setExportPreset] = useState<ExportPreset>('slide-wide')
  const [revisions, setRevisions] = useState<SceneRevision[]>(readRevisions)
  const [showMechanismComposer, setShowMechanismComposer] = useState(false)
  const [showAssetBrowser, setShowAssetBrowser] = useState(false)
  const [showProductionPanel, setShowProductionPanel] = useState(false)
  const [showReviewPanel, setShowReviewPanel] = useState(false)
  const [showLiteraturePanel, setShowLiteraturePanel] = useState(false)
  const [showModulePanel, setShowModulePanel] = useState(false)
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false)
  const [showSceneSettings, setShowSceneSettings] = useState(false)
  const [showMoleculeSetup, setShowMoleculeSetup] = useState(false)
  const [setupMoleculeId, setSetupMoleculeId] = useState<string>()
  const [isSyncing, setIsSyncing] = useState(false)
  const [enrichingLiteratureId, setEnrichingLiteratureId] = useState<string>()
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [alignmentNodeIds, setAlignmentNodeIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [notice, setNotice] = useState('개체를 드래그해 배치하고, 호버 점 드래그 또는 상단 연결 도구로 상호작용을 연결하세요.')
  const [isLayingOut, setIsLayingOut] = useState(false)

  const flowRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const instanceRef = useRef<ReactFlowInstance<BioNodeType, BioEdge> | undefined>(undefined)
  const undoStack = useRef<SceneFile[]>([])
  const redoStack = useRef<SceneFile[]>([])
  const lastHistoryScene = useRef<string | undefined>(undefined)
  const [historyVersion, setHistoryVersion] = useState(0)
  const editorClipboard = useRef<{ nodes: BioNodeType[]; edges: BioEdge[] } | undefined>(undefined)
  const qaErrorsRef = useRef<string[]>([])

  const canvasDisplay = useMemo(
    () => ({
      mode: 'clean' as const,
      overlays: canvasOverlays,
      molecules: moleculeLibrary,
      simple: true,
      visualDetail: 2,
    }),
    [canvasOverlays, moleculeLibrary],
  )

  const toggleCanvasOverlay = useCallback(
    (key: CanvasOverlay) => setCanvasOverlays((current) => ({ ...current, [key]: !current[key] })),
    [],
  )

  // QA Instrumentation Hooks
  useEffect(() => {
    if (!qaApiEnabled()) return
    const recordError = (value: unknown) => {
      const message = value instanceof Error ? `${value.name}: ${value.message}` : String(value)
      qaErrorsRef.current = [...qaErrorsRef.current, message].slice(-100)
    }
    const onError = (event: ErrorEvent) => recordError(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => recordError(event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    if (!qaApiEnabled()) return
    window.__BIOSCENE_QA__ = {
      version: 1,
      getSceneObjects: () => qaClone(nodes),
      getSceneObject: (id) => qaClone(nodes.find((node) => node.id === id)),
      getSelectedObject: () => qaClone(nodes.find((node) => node.id === selectedNodeId)),
      getMoleculeDefinitions: () => qaClone(moleculeLibrary),
      getMoleculeDefinition: (name) => qaClone(moleculeLibrary.find((item) => item.name.toLowerCase() === name.toLowerCase())),
      getInteractions: () => qaClone(edges),
      getMembranes: () => qaClone(nodes.filter((node) => node.data.kind === 'membrane')),
      getWorkspace: () => qaClone(workspace),
      getCurrentView: () => qaClone({ canvasViewMode: 'clean', figurePreset: 'presentation', overlays: canvasOverlays, visualizationProfile, activeViewId }),
      getHistoryState: () => ({ undoCount: undoStack.current.length, redoCount: redoStack.current.length }),
      getAppErrors: () => [...qaErrorsRef.current],
    }
    return () => {
      delete window.__BIOSCENE_QA__
    }
  }, [activeViewId, canvasOverlays, edges, moleculeLibrary, nodes, selectedNodeId, visualizationProfile, workspace])

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
  const targetPanel = selectedNode?.data.panelId ?? (nodes.some((node) => node.data.panelId === 'treated') ? 'treated' : 'single')
  const documentNodes = useMemo(() => nodes.map((node) => ({ ...node, selected: undefined })), [nodes])
  const documentEdges = useMemo(() => edges.map((edge) => ({ ...edge, selected: undefined })), [edges])

  const currentScene = useMemo<SceneFile>(
    () => ({
      schema: 'bioscene.scene.v0.14',
      title: sceneTitle,
      templateId,
      createdAt: sceneCreatedAt,
      constraintMode: mode,
      nodes: documentNodes,
      edges: documentEdges,
      mechanism,
      stylePreset,
      review,
      literature,
      collaboration,
      visualizationProfile,
      views,
      activeViewId,
      moleculeLibrary,
      customFunctions,
      workspace,
    }),
    [
      activeViewId,
      collaboration,
      customFunctions,
      documentEdges,
      documentNodes,
      literature,
      mechanism,
      mode,
      moleculeLibrary,
      review,
      sceneCreatedAt,
      sceneTitle,
      stylePreset,
      templateId,
      views,
      visualizationProfile,
      workspace,
    ],
  )

  useEffect(() => {
    setAutosaveStatus('saving')
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(currentScene))
        setAutosaveStatus('saved')
      } catch {
        setNotice('자동 저장 용량이 가득 찼습니다. JSON으로 백업해 주세요.')
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [currentScene])

  useEffect(() => {
    try {
      localStorage.setItem(REVISION_KEY, JSON.stringify(revisions.slice(0, 5)))
    } catch {
      /* ignore quota */
    }
  }, [revisions])

  useEffect(() => {
    try {
      localStorage.setItem(MODULE_KEY, JSON.stringify(modules.slice(0, 30)))
    } catch {
      /* ignore quota */
    }
  }, [modules])

  useEffect(() => {
    try {
      localStorage.setItem(ROOM_KEY, JSON.stringify({ ...room, endpoint: room.endpoint ? sanitizedEndpoint(room.endpoint) : '' }))
    } catch {
      /* ignore unsafe endpoint */
    }
  }, [room])

  useEffect(() => {
    try {
      if (roomToken) sessionStorage.setItem(ROOM_TOKEN_KEY, roomToken)
      else sessionStorage.removeItem(ROOM_TOKEN_KEY)
    } catch {
      /* session-only */
    }
  }, [roomToken])

  useEffect(
    () =>
      watchSupabaseSession((session) => {
        setSignedInEmail(session?.user.email)
        if (session?.access_token) {
          setRoomToken(session.access_token)
          setRoom((value) => ({ ...value, endpoint: value.endpoint || supabaseApiEndpoint, authMode: 'bearer' }))
        } else if (room.endpoint === supabaseApiEndpoint) setRoomToken('')
      }),
    [room.endpoint],
  )

  const signIn = useCallback(async (email: string) => {
    setIsAuthenticating(true)
    try {
      await sendMagicLink(email)
      setNotice(`${email.trim().toLowerCase()}로 로그인 링크를 발송했습니다.`)
    } catch (error) {
      setNotice(`로그인 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setIsAuthenticating(true)
    try {
      await signOutSupabase()
      setSignedInEmail(undefined)
      setRoomToken('')
      setNotice('로그아웃되었습니다.')
    } catch (error) {
      setNotice(`로그아웃 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const applySceneState = useCallback((scene: SceneFile) => {
    setNodes(scene.nodes)
    setEdges(scene.edges)
    setMode(scene.constraintMode)
    setTemplateId(scene.templateId ?? DEFAULT_TEMPLATE_ID)
    setSceneTitle(scene.title)
    setSceneCreatedAt(scene.createdAt)
    setMechanism(scene.mechanism)
    setStylePreset(scene.stylePreset)
    setReview(scene.review)
    setLiterature(scene.literature)
    setCollaboration(scene.collaboration)
    setVisualizationProfile(scene.visualizationProfile)
    setViews(scene.views)
    setActiveViewId(scene.activeViewId)
    setMoleculeLibrary(scene.moleculeLibrary)
    setCustomFunctions(scene.customFunctions)
    setWorkspace(scene.workspace)
    setDrawingTool('select')
    setConnectMode(undefined)
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.12, duration: 320 }))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const serialized = JSON.stringify(currentScene)
      if (!lastHistoryScene.current) {
        lastHistoryScene.current = serialized
        return
      }
      if (lastHistoryScene.current === serialized) return
      const previous = parseSceneFile(JSON.parse(lastHistoryScene.current))
      if (previous) undoStack.current = [...undoStack.current, previous].slice(-50)
      redoStack.current = []
      lastHistoryScene.current = serialized
      setHistoryVersion((value) => value + 1)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [currentScene])

  const undo = useCallback(() => {
    const scene = undoStack.current.pop()
    if (!scene) return
    redoStack.current.push(currentScene)
    lastHistoryScene.current = JSON.stringify(scene)
    applySceneState(scene)
    setHistoryVersion((value) => value + 1)
    setNotice('실행 취소됨')
  }, [applySceneState, currentScene])

  const redo = useCallback(() => {
    const scene = redoStack.current.pop()
    if (!scene) return
    undoStack.current.push(currentScene)
    lastHistoryScene.current = JSON.stringify(scene)
    applySceneState(scene)
    setHistoryVersion((value) => value + 1)
    setNotice('다시 실행됨')
  }, [applySceneState, currentScene])

  const onNodesChange = useCallback((changes: NodeChange<BioNodeType>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange<BioEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current))
  }, [])

  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: BioNodeType[]; edges: BioEdge[] }) => {
    const ids = selectedNodes.map((node) => node.id)
    setAlignmentNodeIds((current) => (current.length === ids.length && current.every((id, i) => id === ids[i]) ? current : ids))
    setSelectedNodeId(ids[0])
    setSelectedEdgeId(selectedEdges[0]?.id)
  }, [])

  const performStudioConnect = useCallback(
    (sourceId: string, targetId: string, interaction: InteractionType, options: { indirect?: boolean; blockedEdgeId?: string } = {}) => {
      try {
        const res = connectStudioNodes(nodes, sourceId, targetId, interaction, options)
        setNodes(res.nodes)
        setEdges((curr) => [...curr, res.edge])
        setConnectMode(undefined)
        setNotice(`${interaction} 관계선이 추가되었습니다. 선을 클릭해 종류를 바꿀 수 있습니다.`)
      } catch (err) {
        setNotice(err instanceof Error ? err.message : '연결할 수 없는 대상입니다.')
      }
    },
    [nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const source = nodes.find((node) => node.id === connection.source)
      const sourcePort = source?.data.ports.find((port) => port.id === connection.sourceHandle)
      const desired = connectMode?.interaction ?? (source?.data.kind === 'antibody' ? 'BLOCK' : inferInteraction(sourcePort, source?.data.kind))
      performStudioConnect(connection.source, connection.target, desired, { indirect: connectMode?.indirect })
    },
    [connectMode, nodes, performStudioConnect],
  )

  const selectObject = useCallback((id: string, kind: 'node' | 'edge' = 'node', additive = false) => {
    setContextTarget(undefined)
    if (kind === 'edge') {
      setSelectedEdgeId(id)
      setSelectedNodeId(undefined)
      setAlignmentNodeIds([id])
      setEdges((items) => items.map((edge) => ({ ...edge, selected: edge.id === id })))
      setNodes((items) => items.map((node) => ({ ...node, selected: false })))
      return
    }
    setSelectedNodeId(id)
    setSelectedEdgeId(undefined)
    setAlignmentNodeIds((current) => (additive ? (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) : [id]))
    setNodes((items) => items.map((node) => ({ ...node, selected: additive ? (node.id === id ? !node.selected : node.selected) : node.id === id })))
    setEdges((items) => items.map((edge) => ({ ...edge, selected: false })))
  }, [])

  const placeNodeAt = useCallback(
    (kind: 'receptor' | 'antibody' | 'ligand', position: { x: number; y: number }) => {
      const id = uid(kind)
      const node: BioNodeType = {
        id,
        type: 'bio',
        position,
        selected: true,
        data: createBioData(kind, defaultLabels[kind], { panelId: 'single', visibility: 'visible', positionMode: 'manual', showName: true }),
      }
      setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node])
      selectObject(id)
      setNotice(`${defaultLabels[kind]} 개체가 배치되었습니다. 더블클릭해 이름을 수정하세요.`)
      if (!continuousTool) setDrawingTool('select')
    },
    [continuousTool, selectObject],
  )

  const placeCellAt = useCallback(
    (position: { x: number; y: number }) => {
      const id = uid('cell')
      const width = 620
      const node: BioNodeType = {
        id,
        type: 'cell',
        position,
        selected: true,
        deletable: false,
        style: { width, height: 500 },
        data: createBioData('cell', 'T Cell', {
          simpleCell: true,
          cellShape: 'membrane_zoom',
          cellTheme: 'emerald',
          showName: true,
          panelId: 'single',
          visibility: 'visible',
          positionMode: 'manual',
          sceneType: 'full_signaling',
          membrane: {
            id,
            name: 'Plasma membrane',
            boundaryType: 'plasma_membrane',
            path: [{ x: 26, y: 217 }, { x: width - 26, y: 217 }],
            sideA: 'extracellular',
            sideB: 'cytoplasm',
            closed: false,
            style: 'standard',
            thickness: 18,
            smoothing: 0,
            anchors: [],
          },
        }),
      }
      setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node])
      selectObject(id)
      setNotice('새 세포가 배치되었습니다. 모서리 핸들로 크기를 조절할 수 있습니다.')
      if (!continuousTool) setDrawingTool('select')
    },
    [continuousTool, selectObject],
  )

  const placeCalloutAt = useCallback(
    (position: { x: number; y: number }) => {
      const id = uid('callout')
      const node: BioNodeType = {
        id,
        type: 'annotation',
        position,
        selected: true,
        style: { width: 240, height: 96 },
        data: createBioData('annotation', '핵심 기전 요약', {
          panelId: 'single',
          visibility: 'visible',
          positionMode: 'manual',
          annotation: { title: '핵심 기전 요약', body: '여기에 설명을 입력하세요.', tone: 'finding' },
        }),
      }
      setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node])
      selectObject(id)
      setNotice('설명 텍스트 상자가 추가되었습니다.')
      if (!continuousTool) setDrawingTool('select')
    },
    [continuousTool, selectObject],
  )

  const patchNodeById = useCallback(
    (targetId: string, patch: BioNodePatch) => {
      setNodes((current) => {
        let changedMembrane: BioNodeType | undefined
        const nextItems = current.map((node) => {
          if (node.id !== targetId) return node
          const next = {
            ...node,
            hidden: patch.visibility ? patch.visibility !== 'visible' : node.hidden,
            data: { ...node.data, ...patch },
          }
          const result = (patch.compartment || patch.state) && mode === 'biological' ? constrainNode(next, mode, current) : next
          if (result.data.kind === 'membrane') changedMembrane = result
          return result
        })
        return changedMembrane ? repositionMembraneAnchors(nextItems, changedMembrane) : nextItems
      })
    },
    [mode],
  )

  const updateSelectedNode = useCallback(
    (patch: BioNodePatch) => {
      if (!selectedNodeId) return
      patchNodeById(selectedNodeId, patch)
    },
    [patchNodeById, selectedNodeId],
  )

  const attachAsset = useCallback(
    (asset: AssetReference) => {
      if (!selectedNodeId) return
      setNodes((current) => current.map((node) => (node.id === selectedNodeId ? { ...node, data: { ...node.data, asset } } : node)))
      setShowAssetBrowser(false)
      setNotice(`${asset.name} SVG 에셋이 적용되었습니다.`)
    },
    [selectedNodeId],
  )

  const detachAsset = useCallback(() => {
    if (!selectedNodeId) return
    setNodes((current) => current.map((node) => (node.id === selectedNodeId ? { ...node, data: { ...node.data, asset: undefined } } : node)))
    setNotice('외부 SVG 에셋 연결이 해제되었습니다.')
  }, [selectedNodeId])

  const openMoleculeBuilder = useCallback(
    (node?: BioNodeType) => {
      const target = node ?? selectedNode
      if (target && !['cell', 'annotation', 'signal', 'transcription'].includes(target.data.kind)) {
        const existing = moleculeLibrary.find(
          (item) => item.id === target.data.moleculeId || item.name.toLowerCase() === target.data.label.toLowerCase(),
        )
        if (existing) setSetupMoleculeId(existing.id)
        else {
          const created = { ...createMolecule(target.data.label), geneName: target.data.target }
          setMoleculeLibrary((items) => [...items, created])
          setSetupMoleculeId(created.id)
        }
      } else setSetupMoleculeId(undefined)
      setShowMoleculeSetup(true)
    },
    [moleculeLibrary, selectedNode],
  )

  const applyMoleculeToInstances = useCallback(
    (molecule: MoleculeDefinition, policy: Exclude<MoleculeApplyPolicy, 'variant'>) => {
      const functionalPorts = portsFromDomains(molecule)
      setNodes((items) =>
        items.map((node) => {
          const shouldApply = policy === 'all' ? node.data.moleculeId === molecule.id : node.id === selectedNodeId
          if (shouldApply) return applyMoleculeToNode(node, molecule)
          const matching = functionalPorts.filter(
            (port) =>
              port.targetHint &&
              [node.data.label, node.data.target]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '') === port.targetHint!.toLowerCase().replace(/[^a-z0-9]/g, '')),
          )
          if (!matching.length) return node
          const counterpartPorts = matching.map((port) => ({
            ...port,
            id: `port:${node.id}:${port.id.split(':').at(-2)}:target`,
            role: 'target' as const,
            side: port.side === 'left' ? ('right' as const) : ('left' as const),
            domainId: node.data.structuralModel?.domains.find((domain) => domain.kind === 'extracellular')?.id ?? node.data.domains[0]?.id,
            targetHint: molecule.name,
          }))
          const existing = new Set(node.data.ports.map((port) => port.id))
          return { ...node, data: { ...node.data, ports: [...node.data.ports, ...counterpartPorts.filter((port) => !existing.has(port.id))] } }
        }),
      )
    },
    [selectedNodeId],
  )

  const saveMoleculeDefinition = useCallback(
    (molecule: MoleculeDefinition, policy: MoleculeApplyPolicy, variantName?: string) => {
      if (policy === 'variant') {
        const id = `molecule:${molecule.name.replace(/[^A-Za-z0-9_-]+/g, '_')}:${crypto.randomUUID().slice(0, 8)}`
        const variantBase: MoleculeDefinition = {
          ...structuredClone(molecule),
          id,
          name: variantName ?? `${molecule.name} variant`,
          parentMoleculeId: molecule.id,
          architecture: molecule.architecture ? syncArchitecture(id, { ...molecule.architecture, components: [] }) : undefined,
          savedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          saveStatus: 'saved',
        }
        const variant = { ...variantBase, structuralModel: structuralModelForMolecule(variantBase) }
        setMoleculeLibrary((items) => [...items, variant])
        if (selectedNodeId) applyMoleculeToInstances(variant, 'selected')
        setSetupMoleculeId(variant.id)
        setNotice(`${variant.name}을 새 변형(variant)으로 저장했습니다.`)
        return
      }
      setMoleculeLibrary((items) =>
        items.some((item) => item.id === molecule.id) ? items.map((item) => (item.id === molecule.id ? molecule : item)) : [...items, molecule],
      )
      if (policy === 'all' || selectedNodeId) applyMoleculeToInstances(molecule, policy)
      setNotice(`${molecule.name} 구조 설정이 저장되었습니다.`)
    },
    [applyMoleculeToInstances, selectedNodeId],
  )

  const deleteMoleculeDefinition = useCallback((molecule: MoleculeDefinition, removeInstances: boolean) => {
    setMoleculeLibrary((items) => items.filter((item) => item.id !== molecule.id))
    if (removeInstances) setNodes((items) => items.filter((node) => node.data.moleculeId !== molecule.id))
    setSetupMoleculeId(undefined)
    setNotice(`${molecule.name} 정의가 제거되었습니다.`)
  }, [])

  const moleculeInstanceCounts = useMemo(
    () =>
      nodes.reduce<Record<string, number>>((counts, node) => {
        if (node.data.moleculeId) counts[node.data.moleculeId] = (counts[node.data.moleculeId] ?? 0) + 1
        return counts
      }, {}),
    [nodes],
  )

  const addMoleculeToScene = useCallback(
    (molecule: MoleculeDefinition) => {
      const placement = scenePlacementForMolecule(molecule)
      const kind = placement.kind
      const id = uid(kind)
      const base: BioNodeType = {
        id,
        type: 'bio',
        selected: true,
        position: findAvailablePosition(nodes, placement.compartment),
        data: createBioData(kind, molecule.name, { panelId: 'single', visibility: 'visible', positionMode: 'auto', showName: true }),
      }
      let node = applyMoleculeToNode(base, molecule)
      const membrane = placement.anchorToMembrane ? nodes.find((item) => item.data.kind === 'membrane' && item.data.membrane) : undefined
      if (membrane) {
        const target = anchoredPosition(membrane, 0.5)
        if (target) {
          node = {
            ...node,
            position: { x: target.x - 48, y: target.y - 38 },
            data: {
              ...node.data,
              compartment: 'membrane',
              membraneAnchor: { membraneId: membrane.id, pathPosition: 0.5, orientation: 'normal', angle: target.angle },
            },
          }
        }
      }
      setNodes((items) => [
        ...items.map((item) =>
          item.id === membrane?.id && item.data.membrane
            ? {
                ...item,
                selected: false,
                data: {
                  ...item.data,
                  membrane: {
                    ...item.data.membrane,
                    anchors: [...item.data.membrane.anchors.filter((record) => record.objectId !== id), { objectId: id, pathPosition: 0.5, orientation: 'normal' as const }],
                  },
                },
              }
            : { ...item, selected: false },
        ),
        node,
      ])
      setSelectedNodeId(id)
      setAlignmentNodeIds([id])
      setSelectedEdgeId(undefined)
      setShowMoleculeSetup(false)
      setNotice(`${molecule.name} 분자가 캔버스에 추가되었습니다.`)
    },
    [nodes],
  )

  const updateEdgeById = useCallback((edgeId: string, interaction: InteractionType) => {
    setEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              data: { ...edge.data, interaction },
              markerEnd: markerForInteraction(interaction),
            }
          : edge,
      ),
    )
  }, [])

  const updateSelectedEdge = useCallback(
    (interaction: InteractionType) => {
      if (!selectedEdgeId) return
      updateEdgeById(selectedEdgeId, interaction)
    },
    [selectedEdgeId, updateEdgeById],
  )

  const updateSelectedEdgeData = useCallback(
    (patch: Partial<InteractionData>) => {
      setEdges((items) => items.map((edge) => (edge.id === selectedEdgeId ? { ...edge, data: { ...(edge.data ?? { interaction: 'BIND' }), ...patch } } : edge)))
    },
    [selectedEdgeId],
  )

  const deleteSelected = useCallback(() => {
    const nodeIds = new Set(alignmentNodeIds.filter((id) => nodes.some((node) => node.id === id)))
    if (selectedNodeId) nodeIds.add(selectedNodeId)
    if (nodeIds.size) {
      const selectedItems = nodes.filter((node) => nodeIds.has(node.id))
      const selectedMembranes = selectedItems.filter((node) => node.data.kind === 'membrane')
      for (const membraneNode of selectedMembranes) {
        const anchored = nodes.filter((node) => node.data.membraneAnchor?.membraneId === membraneNode.id)
        if (anchored.length) {
          const choice = window
            .prompt(`이 막에 고정된 개체가 ${anchored.length}개 있습니다.\nDETACH = 막만 삭제하고 개체 보존\nALL = 모두 삭제\nCANCEL = 취소`, 'DETACH')
            ?.trim()
            .toUpperCase()
          if (!choice || choice === 'CANCEL') return
          if (choice === 'ALL') anchored.forEach((node) => nodeIds.add(node.id))
        }
      }
      for (const cell of selectedItems.filter((node) => node.data.kind === 'cell')) {
        nodes.filter((node) => node.parentId === cell.id).forEach((node) => nodeIds.add(node.id))
      }
      const remaining = nodes
        .filter((node) => !nodeIds.has(node.id))
        .map((node) =>
          selectedMembranes.some((membrane) => node.data.membraneAnchor?.membraneId === membrane.id)
            ? { ...node, data: { ...node.data, membraneAnchor: undefined } }
            : node,
        )
      setNodes(remaining)
      setEdges((current) => pruneSimpleEdges(remaining, current))
      setNotice(`${nodeIds.size}개 개체가 삭제되었습니다.`)
    } else if (selectedEdgeId) {
      setEdges((current) => pruneSimpleEdges(nodes, current.filter((edge) => edge.id !== selectedEdgeId)))
      setNotice('연결선이 삭제되었습니다.')
    }
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    setAlignmentNodeIds([])
    setContextTarget(undefined)
  }, [alignmentNodeIds, nodes, selectedEdgeId, selectedNodeId])

  const copySelected = useCallback(() => {
    const ids = new Set(alignmentNodeIds.filter((id) => nodes.some((node) => node.id === id)))
    if (selectedNodeId) ids.add(selectedNodeId)
    if (!ids.size) return
    const copiedNodes = nodes.filter((node) => ids.has(node.id))
    const copiedEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    editorClipboard.current = { nodes: structuredClone(copiedNodes), edges: structuredClone(copiedEdges) }
    setNotice(`${copiedNodes.length}개 개체가 복사되었습니다.`)
  }, [alignmentNodeIds, edges, nodes, selectedNodeId])

  const pasteObjects = useCallback(() => {
    const copied = editorClipboard.current
    if (!copied?.nodes.length) return
    const map = new Map(copied.nodes.map((node) => [node.id, uid(node.data.kind)]))
    const nextNodes = copied.nodes.map((node) => {
      const id = map.get(node.id)!
      const membrane = node.data.membrane ? { ...structuredClone(node.data.membrane), id, anchors: [] } : undefined
      const anchor =
        node.data.membraneAnchor && map.has(node.data.membraneAnchor.membraneId)
          ? { ...node.data.membraneAnchor, membraneId: map.get(node.data.membraneAnchor.membraneId)! }
          : undefined
      return {
        ...structuredClone(node),
        id,
        parentId: node.parentId ? map.get(node.parentId) : undefined,
        position: { x: node.position.x + 36, y: node.position.y + 36 },
        selected: true,
        data: { ...structuredClone(node.data), membrane, membraneAnchor: anchor },
      }
    })
    const nextEdges = copied.edges.map((edge) => ({
      ...structuredClone(edge),
      id: uid('edge'),
      source: map.get(edge.source)!,
      target: map.get(edge.target)!,
      selected: false,
    }))
    setNodes((items) => [...items.map((node) => ({ ...node, selected: false })), ...nextNodes])
    setEdges((items) => [...items, ...nextEdges])
    const ids = nextNodes.map((node) => node.id)
    setAlignmentNodeIds(ids)
    setSelectedNodeId(ids[0])
    setSelectedEdgeId(undefined)
    setNotice(`${ids.length}개 개체가 복제되었습니다.`)
  }, [])

  const duplicateSelected = useCallback(() => {
    copySelected()
    queueMicrotask(pasteObjects)
  }, [copySelected, pasteObjects])

  const membraneAction = useCallback(
    (id: string, actionName: string, detail: Record<string, unknown> = {}) => {
      const membraneNode = nodes.find((node) => node.id === id && node.data.membrane)
      if (!membraneNode?.data.membrane) return
      if (actionName === 'edit') {
        selectObject(id)
        setNotice('막 경로 편집 모드: 점을 드래그하거나 더블클릭해 제어점을 추가하세요.')
        return
      }
      if (actionName === 'flip') {
        setNodes((items) =>
          items.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, membrane: { ...node.data.membrane!, sideA: node.data.membrane!.sideB, sideB: node.data.membrane!.sideA } } }
              : node,
          ),
        )
        return
      }
      if (['move-point', 'add-point', 'remove-point', 'straighten'].includes(actionName)) {
        let path = [...membraneNode.data.membrane.path]
        if (actionName === 'move-point') path[Number(detail.index)] = detail.point as MembranePoint
        if (actionName === 'remove-point' && path.length > 2) path.splice(Number(detail.index), 1)
        if (actionName === 'add-point') {
          const point = detail.point as MembranePoint
          let index = 1
          let distance = Infinity
          for (let i = 0; i < path.length - 1; i++) {
            const mid = { x: (path[i].x + path[i + 1].x) / 2, y: (path[i].y + path[i + 1].y) / 2 }
            const next = Math.hypot(point.x - mid.x, point.y - mid.y)
            if (next < distance) {
              distance = next
              index = i + 1
            }
          }
          path.splice(index, 0, point)
        }
        if (actionName === 'straighten') path = [path[0], path.at(-1)!]
        setNodes((items) => {
          const changed = items.map((node) => (node.id === id ? { ...node, data: { ...node.data, membrane: { ...node.data.membrane!, path } } } : node))
          const nextMembrane = changed.find((node) => node.id === id)!
          return repositionMembraneAnchors(changed, nextMembrane)
        })
      }
    },
    [nodes, selectObject],
  )

  const deleteObjectById = useCallback(
    (id: string) => {
      const target = nodes.find((node) => node.id === id)
      if (!target) return
      const ids = new Set([id])
      if (target.data.kind === 'cell') nodes.filter((node) => node.parentId === id).forEach((node) => ids.add(node.id))
      const remaining = nodes
        .filter((node) => !ids.has(node.id))
        .map((node) => (node.data.membraneAnchor?.membraneId === id ? { ...node, data: { ...node.data, membraneAnchor: undefined } } : node))
      setNodes(remaining)
      setEdges((items) => pruneSimpleEdges(remaining, items))
      setSelectedNodeId(undefined)
      setSelectedEdgeId(undefined)
      setAlignmentNodeIds([])
      setNotice(`${target.data.label} 삭제됨`)
    },
    [nodes],
  )

  const duplicateObjectById = useCallback(
    (id: string) => {
      const source = nodes.find((node) => node.id === id)
      if (!source) return
      if (source.data.kind === 'cell') {
        selectObject(id)
        setTimeout(() => duplicateSelected(), 0)
        return
      }
      const nextId = uid(source.data.kind)
      const membrane = source.data.membrane ? { ...structuredClone(source.data.membrane), id: nextId, anchors: [] } : undefined
      const clone: BioNodeType = {
        ...structuredClone(source),
        id: nextId,
        parentId: source.parentId,
        position: { x: source.position.x + 36, y: source.position.y + 28 },
        selected: true,
        data: { ...structuredClone(source.data), membrane, membraneAnchor: undefined },
      }
      setNodes((items) => [...items.map((node) => ({ ...node, selected: false })), clone])
      setSelectedNodeId(nextId)
      setSelectedEdgeId(undefined)
      setAlignmentNodeIds([nextId])
      setNotice(`${source.data.label} 복제됨`)
    },
    [duplicateSelected, nodes, selectObject],
  )

  const handleObjectAction = useCallback(
    (id: string, actionName: string, detail: Record<string, unknown> = {}) => {
      const node = nodes.find((item) => item.id === id)
      if (!node) return
      if (actionName === 'patch' && detail.patch) {
        patchNodeById(id, detail.patch as BioNodePatch)
        return
      }
      if (actionName === 'start-connect') {
        const rel = (detail.relation as SimpleRelation | undefined) ?? 'Block'
        const interaction = mapSimpleRelation(rel)
        setConnectMode({ interaction, indirect: rel === 'Indirect', sourceId: id })
        setDrawingTool('select')
        setNotice(`${node.data.label} 선택됨 → 연결할 대상 분자${interaction === 'BLOCK' ? ' 또는 신호선' : ''}을 클릭하세요 (ESC 취소)`)
        return
      }
      if (['move-point', 'add-point', 'remove-point', 'straighten', 'flip'].includes(actionName)) {
        membraneAction(id, actionName, detail)
        return
      }
      if (actionName === 'delete') {
        deleteObjectById(id)
        return
      }
      if (actionName === 'duplicate') {
        duplicateObjectById(id)
        return
      }
      if (actionName === 'lock') {
        setNodes((items) =>
          items.map((item) =>
            item.id === id
              ? { ...item, draggable: !!item.data.locked, data: { ...item.data, locked: !item.data.locked, positionMode: item.data.locked ? 'manual' : 'pinned' } }
              : item,
          ),
        )
        return
      }
      if (actionName === 'hide') {
        setNodes((items) =>
          items.map((item) => (item.id === id ? { ...item, hidden: !item.hidden, data: { ...item.data, visibility: item.hidden ? 'visible' : 'manually_hidden' } } : item)),
        )
        setContextTarget(undefined)
        return
      }
      if (actionName === 'front' || actionName === 'back') {
        setNodes((items) => items.map((item) => (item.id === id ? { ...item, zIndex: actionName === 'front' ? 100 : -1 } : item)))
        setContextTarget(undefined)
        return
      }
      selectObject(id)
      if (actionName === 'asset') setShowAssetBrowser(true)
      else if (actionName === 'edit' && node.data.kind === 'membrane') membraneAction(id, 'edit')
      else if (actionName === 'edit') openMoleculeBuilder(node)
      setContextTarget(undefined)
    },
    [deleteObjectById, duplicateObjectById, membraneAction, nodes, openMoleculeBuilder, patchNodeById, selectObject],
  )

  useEffect(() => {
    const objectAction = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; action: string } & Record<string, unknown>>).detail
      handleObjectAction(detail.id, detail.action, detail)
    }
    const edgeAction = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; action: string; interaction?: InteractionType }>).detail
      if (detail.action === 'delete') {
        setEdges((curr) => pruneSimpleEdges(nodes, curr.filter((e) => e.id !== detail.id)))
        setSelectedEdgeId(undefined)
      } else if (detail.action === 'set-type' && detail.interaction) {
        updateEdgeById(detail.id, detail.interaction)
      } else if (detail.action === 'toggle-indirect') {
        setEdges((curr) => curr.map((e) => (e.id === detail.id ? { ...e, data: { ...(e.data ?? { interaction: 'BIND' }), indirect: !e.data?.indirect } } : e)))
      }
    }
    window.addEventListener('bioscene:object-action', objectAction)
    window.addEventListener('bioscene:edge-action', edgeAction)
    return () => {
      window.removeEventListener('bioscene:object-action', objectAction)
      window.removeEventListener('bioscene:edge-action', edgeAction)
    }
  }, [handleObjectAction, nodes, updateEdgeById])

  const handleContextAction = useCallback(
    (actionName: string) => {
      if (!contextTarget) return
      if (contextTarget.kind === 'edge') {
        const edge = edges.find((item) => item.id === contextTarget.id)
        if (actionName === 'delete') setEdges((items) => pruneSimpleEdges(nodes, items.filter((item) => item.id !== contextTarget.id)))
        else if (actionName === 'duplicate' && edge) setEdges((items) => [...items, { ...structuredClone(edge), id: uid('edge'), selected: false }])
        else selectObject(contextTarget.id, 'edge')
        setContextTarget(undefined)
        return
      }
      handleObjectAction(contextTarget.id, actionName)
    },
    [contextTarget, edges, handleObjectAction, nodes, selectObject],
  )

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = !!target?.closest('input,textarea,select,[contenteditable="true"]')
      if (event.key === 'Escape') {
        setConnectMode(undefined)
        setDraftMembrane(undefined)
        setDrawingTool('select')
        setContextTarget(undefined)
        setNotice('선택 모드')
        return
      }
      if (typing) return
      const key = event.key.toLowerCase()
      const command = event.ctrlKey || event.metaKey
      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (command && key === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (command && key === 'c') {
        event.preventDefault()
        copySelected()
        return
      }
      if (command && key === 'v') {
        event.preventDefault()
        pasteObjects()
        return
      }
      if (command && key === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
        return
      }
      const shortcuts: Partial<Record<string, DrawingTool>> = {
        v: 'select',
        h: 'pan',
        m: 'freehand_membrane',
        c: 'place_cell',
        p: 'place_receptor',
        a: 'place_antibody',
        l: 'place_ligand',
        t: 'place_annotation',
      }
      if (shortcuts[key]) {
        event.preventDefault()
        setDrawingTool(shortcuts[key]!)
        setConnectMode(undefined)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [copySelected, deleteSelected, duplicateSelected, pasteObjects, redo, undo])

  const changeVisualizationProfile = useCallback(
    (profile: VisualizationProfile) => {
      const scoped = applyVisualizationProfile(nodes, edges, profile)
      setVisualizationProfile(profile)
      setNodes(scoped.nodes)
      setEdges(scoped.edges)
      setActiveViewId(undefined)
      setNotice(`${sceneTypeLabels[profile.sceneType]} 적용됨`)
      requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.12, duration: 350 }))
    },
    [edges, nodes],
  )

  const startEmptyCanvas = useCallback(() => {
    const profile = { ...visualizationProfile, sceneType: 'empty' as const, layoutMode: 'single' as const }
    setNodes([])
    setEdges([])
    setVisualizationProfile(profile)
    setViews([])
    setActiveViewId(undefined)
    setTemplateId(DEFAULT_TEMPLATE_ID)
    setSceneTitle('새 MoA 그림')
    setSceneCreatedAt(new Date().toISOString())
    setMechanism(undefined)
    setReview({ status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() })
    setLiterature([])
    setCollaboration(emptyCollaboration())
    setWorkspace({ ...defaultFigureWorkspace })
    setDrawingTool('select')
    setConnectMode(undefined)
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    setNotice('빈 캔버스가 준비되었습니다. 좌측 팔레트에서 세포·단백질·항체를 클릭해 추가하세요.')
  }, [visualizationProfile])

  const loadBlueprint = useCallback((bp: StudioBlueprint) => {
    const built = bp.build()
    setNodes(built.nodes)
    setEdges(built.edges)
    setSceneTitle(built.title)
    setMoleculeLibrary((curr) => [
      ...curr,
      ...built.library.filter((m) => !curr.some((x) => x.id === m.id)),
    ])
    setConnectMode(undefined)
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    setNotice(`‘${bp.title}’ 표준 도식이 로드되었습니다. 모든 개체를 드래그·편집할 수 있습니다.`)
    window.setTimeout(() => instanceRef.current?.fitView({ padding: 0.12, duration: 350 }), 60)
  }, [])

  const handleNodeDragStop = useCallback(
    (node: BioNodeType) => {
      setNodes((current) => {
        // Free, responsive positioning inside cells: keep membrane snap smooth without locking Y on non-membrane objects!
        const parentCell = current.find((item) => item.id === node.parentId && item.data.kind === 'cell')
        if (parentCell && parentCell.data.cellShape === 'membrane_zoom' && node.data.kind === 'receptor') {
          const snappedY = Math.abs(node.position.y - 174) < 42 ? 174 : node.position.y
          const cellWidth = Number(parentCell.style?.width ?? 660)
          const pathPosition = Math.max(0.04, Math.min(0.96, (node.position.x + 48) / cellWidth))
          return current.map((item) =>
            item.id === node.id
              ? {
                  ...node,
                  position: { x: node.position.x, y: snappedY },
                  data: {
                    ...node.data,
                    positionMode: 'manual',
                    membraneAnchor: snappedY === 174 ? { membraneId: parentCell.id, pathPosition, orientation: 'normal', angle: 0 } : node.data.membraneAnchor,
                  },
                }
              : item,
          )
        }

        const dragged = { ...constrainNode(node, mode, current), data: { ...node.data, positionMode: 'manual' as const } }
        if (dragged.data.kind === 'membrane') {
          const next = current.map((item) => (item.id === dragged.id ? dragged : item))
          return repositionMembraneAnchors(next, dragged)
        }
        if (dragged.data.kind !== 'receptor' || dragged.parentId) {
          return current.map((item) => (item.id === dragged.id ? dragged : item))
        }

        // Snap free-floating receptor onto drawn freehand/straight membrane when dragged nearby
        const size = nodeSize(dragged)
        const center = { x: dragged.position.x + size.width / 2, y: dragged.position.y + size.height / 2 }
        let best: { membrane: BioNodeType; distance: number; pathPosition: number; angle: number; x: number; y: number } | undefined
        for (const membraneNode of current.filter((item) => item.data.kind === 'membrane' && item.data.membrane)) {
          const localQuery = { x: center.x - membraneNode.position.x, y: center.y - membraneNode.position.y }
          const nearest = nearestPathPoint(membraneNode.data.membrane!.path, localQuery)
          if (!best || nearest.distance < best.distance) {
            best = {
              membrane: membraneNode,
              distance: nearest.distance,
              pathPosition: nearest.pathPosition,
              angle: nearest.angle,
              x: membraneNode.position.x + nearest.point.x,
              y: membraneNode.position.y + nearest.point.y,
            }
          }
        }
        if (!best || best.distance > 75) {
          return current.map((item) => {
            if (item.id === dragged.id) return { ...dragged, data: { ...dragged.data, membraneAnchor: undefined } }
            if (item.data.kind === 'membrane' && item.data.membrane?.anchors.some((anchor) => anchor.objectId === dragged.id)) {
              return {
                ...item,
                data: {
                  ...item.data,
                  membrane: { ...item.data.membrane, anchors: item.data.membrane.anchors.filter((anchor) => anchor.objectId !== dragged.id) },
                },
              }
            }
            return item
          })
        }
        const anchor = { membraneId: best.membrane.id, pathPosition: best.pathPosition, orientation: 'normal' as const, angle: best.angle }
        const nextMembraneData: MembraneDefinition = {
          ...best.membrane.data.membrane!,
          anchors: [...best.membrane.data.membrane!.anchors.filter((item) => item.objectId !== dragged.id), { objectId: dragged.id, pathPosition: best.pathPosition, orientation: 'normal' }],
        }
        setNotice(`${dragged.data.label} 수용체가 막에 자석 고정되었습니다.`)
        return current.map((item) =>
          item.id === dragged.id
            ? { ...dragged, position: { x: best!.x - size.width / 2, y: best!.y - size.height / 2 }, data: { ...dragged.data, compartment: 'membrane', membraneAnchor: anchor } }
            : item.id === best!.membrane.id
              ? { ...item, data: { ...item.data, membrane: nextMembraneData } }
              : item,
        )
      })
    },
    [mode],
  )

  const saveWorkspace = useCallback((next: FigureWorkspace) => {
    setWorkspace(next)
    setShowWorkspaceSetup(false)
    setNotice(`캔버스 크기 ${Math.round(next.width)} × ${Math.round(next.height)} ${next.unit} 적용됨`)
    requestAnimationFrame(() => instanceRef.current?.fitBounds({ x: 0, y: 0, width: next.width, height: next.height }, { padding: 0.04, duration: 350 }))
  }, [])

  const fitWorkspaceToContent = useCallback(() => {
    const visible = nodes.filter((node) => !node.hidden)
    const right = Math.max(800, ...visible.map((node) => node.position.x + nodeSize(node).width + 80))
    const bottom = Math.max(600, ...visible.map((node) => node.position.y + nodeSize(node).height + 80))
    const next = { ...workspace, preset: 'custom' as const, width: Math.ceil(right), height: Math.ceil(bottom) }
    setWorkspace(next)
    requestAnimationFrame(() => instanceRef.current?.fitBounds({ x: 0, y: 0, width: next.width, height: next.height }, { padding: 0.04, duration: 350 }))
  }, [nodes, workspace])

  const startDrawing = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!['freehand_membrane', 'straight_membrane'].includes(drawingTool) || !instanceRef.current) return
      if ((event.target as HTMLElement).closest('.react-flow__panel,.react-flow__controls,.react-flow__minimap')) return
      const rect = flowRef.current?.getBoundingClientRect()
      if (!rect) return
      const flow = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setDraftMembrane({ flow: [flow], screen: [{ x: event.clientX - rect.left, y: event.clientY - rect.top }] })
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [drawingTool],
  )

  const continueDrawing = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!draftMembrane || !instanceRef.current || !['freehand_membrane', 'straight_membrane'].includes(drawingTool)) return
      const rect = flowRef.current?.getBoundingClientRect()
      if (!rect) return
      const flow = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      setDraftMembrane((draft) => {
        if (!draft) return draft
        const last = draft.screen[draft.screen.length - 1]
        if (Math.hypot(screen.x - last.x, screen.y - last.y) < 4) return draft
        return { flow: [...draft.flow, flow], screen: [...draft.screen, screen] }
      })
    },
    [draftMembrane, drawingTool],
  )

  const finishDrawing = useCallback(() => {
    if (!draftMembrane || !['freehand_membrane', 'straight_membrane'].includes(drawingTool)) return
    const raw =
      drawingTool === 'straight_membrane' && draftMembrane.flow.length > 1
        ? [draftMembrane.flow[0], draftMembrane.flow[draftMembrane.flow.length - 1]]
        : draftMembrane.flow
    setDraftMembrane(undefined)
    if (raw.length < 2 || Math.hypot(raw.at(-1)!.x - raw[0].x, raw.at(-1)!.y - raw[0].y) < 20) return
    const smoothed = drawingTool === 'freehand_membrane' ? smoothMembranePoints(raw, 0.72) : raw
    const minX = Math.min(...smoothed.map((point) => point.x))
    const minY = Math.min(...smoothed.map((point) => point.y))
    const maxX = Math.max(...smoothed.map((point) => point.x))
    const maxY = Math.max(...smoothed.map((point) => point.y))
    const pad = 30
    const path = smoothed.map((point) => ({ x: point.x - minX + pad, y: point.y - minY + pad }))
    const id = uid('membrane')
    const membrane: MembraneDefinition = {
      id,
      name: 'Plasma membrane',
      boundaryType: 'plasma_membrane',
      path,
      sideA: 'extracellular',
      sideB: 'cytoplasm',
      closed: false,
      style: 'detailed',
      thickness: 14,
      smoothing: 65,
      anchors: [],
    }
    const node: BioNodeType = {
      id,
      type: 'membrane',
      deletable: false,
      selected: true,
      position: { x: minX - pad, y: minY - pad },
      style: { width: Math.max(80, maxX - minX + pad * 2), height: Math.max(70, maxY - minY + pad * 2) },
      data: createBioData('membrane', 'Plasma membrane', { membrane, visibility: 'visible', positionMode: 'manual' }),
    }
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node])
    setSelectedNodeId(id)
    setAlignmentNodeIds([id])
    if (!continuousTool) setDrawingTool('select')
    setNotice('인지질 이중층 막이 생성되었습니다. 수용체를 가까이 드래그하면 막에 고정됩니다.')
  }, [continuousTool, draftMembrane, drawingTool])

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      setContextTarget(undefined)
      if (!instanceRef.current) return
      const position = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (drawingTool === 'place_cell') placeCellAt(position)
      else if (drawingTool === 'place_receptor') placeNodeAt('receptor', position)
      else if (drawingTool === 'place_antibody') placeNodeAt('antibody', position)
      else if (drawingTool === 'place_ligand') placeNodeAt('ligand', position)
      else if (drawingTool === 'place_annotation') placeCalloutAt(position)
      else if (drawingTool === 'select') {
        setConnectMode(undefined)
        setSelectedNodeId(undefined)
        setSelectedEdgeId(undefined)
        setAlignmentNodeIds([])
      }
    },
    [drawingTool, placeCalloutAt, placeCellAt, placeNodeAt],
  )

  const handleNodeClickInStudio = useCallback(
    (event: React.MouseEvent, node: BioNodeType) => {
      if (connectMode) {
        if (['cell', 'membrane', 'annotation'].includes(node.data.kind)) {
          setNotice('세포 배경 대신 연결할 분자(항체·수용체·사이토카인·신호단백질)를 클릭하세요.')
          return
        }
        if (!connectMode.sourceId) {
          setConnectMode({ ...connectMode, sourceId: node.id })
          setNotice(`${node.data.label} 출발 선택됨 → 도착 분자${connectMode.interaction === 'BLOCK' ? ' 또는 차단할 신호선' : ''}을 클릭하세요.`)
        } else {
          performStudioConnect(connectMode.sourceId, node.id, connectMode.interaction, { indirect: connectMode.indirect })
        }
        return
      }
      selectObject(node.id, 'node', event.shiftKey)
    },
    [connectMode, performStudioConnect, selectObject],
  )

  const handleEdgeClickInStudio = useCallback(
    (_: React.MouseEvent, edge: BioEdge) => {
      if (connectMode && connectMode.interaction === 'BLOCK' && connectMode.sourceId) {
        performStudioConnect(connectMode.sourceId, edge.target, 'BLOCK', { blockedEdgeId: edge.id })
        return
      }
      selectObject(edge.id, 'edge')
    },
    [connectMode, performStudioConnect, selectObject],
  )

  const runLayout = useCallback(async () => {
    setIsLayingOut(true)
    try {
      const laidOut = nodes.some((n) => n.data.simpleCell) ? layoutSimpleCells(nodes, false) : await autoLayout(nodes, edges, false)
      setNodes(laidOut)
      requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.12, duration: 400 }))
      setNotice('세포 구획 기준으로 분자 배치가 깔끔하게 정렬되었습니다.')
    } catch (error) {
      setNotice(`자동 정렬 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setIsLayingOut(false)
    }
  }, [edges, nodes])

  const loadTemplate = useCallback(
    (nextTemplateId: SceneTemplateId) => {
      const template = cloneTemplate(nextTemplateId)
      const nextProfile = {
        ...visualizationProfile,
        layoutMode:
          nextTemplateId === 'receptor-blockade-comparison'
            ? ('comparison' as const)
            : nextTemplateId === 'tumor-immune-crosstalk'
              ? ('multi_panel' as const)
              : ('single' as const),
      }
      const scoped = applyVisualizationProfile(template.nodes, template.edges, nextProfile)
      setTemplateId(nextTemplateId)
      setVisualizationProfile(nextProfile)
      setSceneTitle(template.title)
      setSceneCreatedAt(new Date().toISOString())
      setMechanism(undefined)
      setNodes(scoped.nodes)
      setEdges(scoped.edges)
      setSelectedNodeId(undefined)
      setSelectedEdgeId(undefined)
      setNotice(`${template.title} 템플릿이 적용되었습니다.`)
      requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.1, duration: 400 }))
    },
    [visualizationProfile],
  )

  const generateFromMechanism = useCallback((parsed: ParsedMechanism) => {
    const generated = sceneFromMechanism(parsed)
    const profile = { ...defaultVisualizationProfile, detailLevel: 4 as const }
    const scoped = applyVisualizationProfile(generated.nodes, generated.edges, profile)
    setVisualizationProfile(profile)
    setNodes(scoped.nodes)
    setEdges(scoped.edges)
    setTemplateId(generated.templateId)
    setSceneTitle(generated.title)
    setSceneCreatedAt(new Date().toISOString())
    setMechanism(parsed)
    setShowMechanismComposer(false)
    setNotice(`${parsed.entities.length}개 생물학 개체와 ${parsed.interactions.length}개 상호작용이 자동 생성되었습니다.`)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.1, duration: 450 }))
  }, [])

  const saveJson = useCallback(() => {
    downloadText(`bioscene-${templateId}.json`, JSON.stringify(currentScene, null, 2), 'application/json')
    setNotice('작업 파일(.json)이 다운로드되었습니다.')
  }, [currentScene, templateId])

  const loadJson = useCallback(
    async (file: File) => {
      try {
        const parsed = parseSceneFile(JSON.parse(await file.text()))
        if (!parsed) throw new Error('Invalid scene schema')
        applySceneState(parsed)
        setNotice(`${file.name} 파일이 복원되었습니다.`)
      } catch {
        setNotice('유효한 BioScene JSON 파일이 아닙니다.')
      }
    },
    [applySceneState],
  )

  const exportFigure = useCallback(
    async (format: 'png' | 'svg' | 'pptx' | 'package') => {
      const target = flowRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!target) return
      let restorePaint: (() => void) | undefined
      try {
        setSelectedNodeId(undefined)
        setSelectedEdgeId(undefined)
        setNodes((items) => items.map((n) => ({ ...n, selected: false })))
        setEdges((items) => items.map((e) => ({ ...e, selected: false })))
        await instanceRef.current?.fitView({ padding: 0.12, duration: 0 })
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        assertVisibleBlocksForCapture(
          target,
          edges
            .filter(
              (edge) =>
                edge.data?.interaction === 'BLOCK' &&
                !edge.hidden &&
                !instanceRef.current?.getNode(edge.source)?.hidden &&
                !instanceRef.current?.getNode(edge.target)?.hidden,
            )
            .map((edge) => edge.id),
        )
        const spec = exportSpecs[exportPreset]
        const background = exportPreset === 'transparent' ? undefined : styleBackground[stylePreset]
        const attribution = assetAttribution(nodes)
        const filter = (element: HTMLElement) => element.dataset?.exportExclude !== 'true'
        const bounds = instanceRef.current?.getNodesBounds(nodes.filter((n) => !n.hidden))
        const zoom = bounds ? Math.min((spec.width - 140) / Math.max(1, bounds.width), (spec.height - 140) / Math.max(1, bounds.height)) : 1
        const captureStyle = bounds
          ? {
              transform: `translate(${(spec.width - bounds.width * zoom) / 2 - bounds.x * zoom}px, ${(spec.height - bounds.height * zoom) / 2 - bounds.y * zoom}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }
          : undefined
        restorePaint = inlineSvgPaintForCapture(target)
        if (format === 'svg' || format === 'package') {
          const rawSvg = await toSvg(target, { backgroundColor: background, cacheBust: true, width: spec.width, height: spec.height, filter, style: captureStyle })
          const dataUrl = addSvgCredit(rawSvg, attribution.compact, spec.width, spec.height)
          if (format === 'package') {
            const zip = new JSZip()
            zip.file('scene.svg', decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1)))
            zip.file('scene.json', JSON.stringify(currentScene, null, 2))
            zip.file(
              'scene_prompt.md',
              `# ${sceneTitle}\n\nBeautify this scientific blueprint. Preserve every molecule, label, compartment, connection and inhibition mark. Do not infer extra biology.\n\nObjects:\n${nodes.map((n) => `- ${n.data.label} (${n.data.kind}, ${n.data.compartment})`).join('\n')}\n\nRelationships:\n${edges.map((e) => `- ${blueprintRelationship(e, nodes, edges)}`).join('\n')}\n\n${attribution.full}`,
            )
            const blob = await zip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'bioscene-ai-blueprint.zip'
            a.click()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          } else {
            const anchor = document.createElement('a')
            anchor.href = dataUrl
            anchor.download = `bioscene-${exportPreset}.svg`
            anchor.click()
          }
        } else {
          const raw = await toPng(target, { backgroundColor: background, pixelRatio: 2, cacheBust: true, filter, width: spec.width, height: spec.height, style: captureStyle })
          const dataUrl = await fitDataUrl(raw, spec.width, spec.height, background, attribution.compact)
          if (format === 'png') {
            const anchor = document.createElement('a')
            anchor.href = dataUrl
            anchor.download = `bioscene-${exportPreset}.png`
            anchor.click()
          } else {
            const pptx = new PptxGenJS()
            pptx.author = 'BioScene Engine'
            pptx.subject = sceneTitle
            pptx.title = sceneTitle
            pptx.defineLayout({ name: 'BIOSCENE_SQUARE', width: 10, height: 10 })
            pptx.layout = spec.layout
            const slide = pptx.addSlide()
            slide.background = { color: background?.replace('#', '') ?? 'FFFFFF', transparency: background ? 0 : 100 }
            const size = spec.layout === 'LAYOUT_WIDE' ? { w: 13.333, h: 7.5 } : spec.layout === 'LAYOUT_4X3' ? { w: 10, h: 7.5 } : { w: 10, h: 10 }
            slide.addImage({ data: dataUrl, x: 0, y: 0, w: size.w, h: size.h })
            await pptx.writeFile({ fileName: `bioscene-${exportPreset}.pptx` })
          }
        }
        setNotice(`${format.toUpperCase()} 파일 내보내기가 완료되었습니다.`)
      } catch (error) {
        setNotice(`내보내기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      } finally {
        restorePaint?.()
      }
    },
    [currentScene, edges, exportPreset, nodes, sceneTitle, stylePreset],
  )

  const createSnapshot = useCallback(() => {
    const next: SceneRevision = {
      id: uid('revision'),
      label: `스냅샷 ${revisions.length + 1}`,
      createdAt: new Date().toISOString(),
      scene: JSON.parse(JSON.stringify(currentScene)) as SceneFile,
    }
    setRevisions((items) => [next, ...items].slice(0, 5))
    setNotice(`${next.label} 저장됨`)
  }, [currentScene, revisions.length])

  const restoreRevision = useCallback(
    (revision: SceneRevision) => {
      applySceneState(revision.scene)
      setShowProductionPanel(false)
      setNotice(`${revision.label} 복원됨`)
    },
    [applySceneState],
  )

  const alignSelection = useCallback(
    (action: AlignmentAction) => {
      const selectedIds = new Set(alignmentNodeIds.filter((id) => nodes.find((node) => node.id === id)?.data.kind !== 'cell'))
      if (selectedIds.size < 2) {
        setNotice('Shift+클릭으로 2개 이상의 분자를 선택한 뒤 정렬하세요.')
        return
      }
      const selected = nodes.filter((node) => selectedIds.has(node.id))
      const width = (node: BioNodeType) => node.measured?.width ?? node.width ?? 96
      const height = (node: BioNodeType) => node.measured?.height ?? node.height ?? 76
      const left = Math.min(...selected.map((node) => node.position.x))
      const right = Math.max(...selected.map((node) => node.position.x + width(node)))
      const top = Math.min(...selected.map((node) => node.position.y))
      const bottom = Math.max(...selected.map((node) => node.position.y + height(node)))
      setNodes((items) =>
        items.map((node) => {
          if (!selectedIds.has(node.id)) return node
          let x = node.position.x
          let y = node.position.y
          if (action === 'left') x = left
          if (action === 'center-x') x = (left + right - width(node)) / 2
          if (action === 'top') y = top
          if (action === 'center-y') y = (top + bottom - height(node)) / 2
          return { ...node, position: { x, y } }
        }),
      )
      setNotice(`${selected.length}개 개체 정렬 완료`)
    },
    [alignmentNodeIds, nodes],
  )

  const attachLiterature = useCallback(
    (literatureId: string) => {
      const record = literature.find((item) => item.id === literatureId)
      if (!selectedEdgeId || !record) return
      setEdges((items) =>
        items.map((edge) => {
          if (edge.id !== selectedEdgeId) return edge
          const evidence = edge.data?.evidence ?? { status: 'needs-review' as const, citation: '' }
          const literatureIds = Array.from(new Set([...(evidence.literatureIds ?? []), literatureId]))
          return {
            ...edge,
            data: { ...(edge.data ?? { interaction: 'BIND' }), evidence: { ...evidence, literatureIds, citation: evidence.citation || record.title, url: evidence.url || record.url } },
          }
        }),
      )
    },
    [literature, selectedEdgeId],
  )

  const updateLiterature = useCallback((records: LiteratureRecord[]) => {
    const kept = new Set(records.map((record) => record.id))
    setLiterature(records)
    setEdges((items) =>
      items.map((edge) =>
        edge.data?.evidence ? { ...edge, data: { ...edge.data, evidence: { ...edge.data.evidence, literatureIds: edge.data.evidence.literatureIds?.filter((id) => kept.has(id)) } } } : edge,
      ),
    )
  }, [])

  const enrichLiteratureRecord = useCallback(
    async (id: string) => {
      const record = literature.find((item) => item.id === id)
      if (!record || !room.endpoint) return
      setEnrichingLiteratureId(id)
      try {
        const patch = await enrichLiterature(room, roomToken, record)
        setLiterature((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
      } catch {
        setLiterature((items) => items.map((item) => (item.id === id ? { ...item, metadataStatus: 'failed' } : item)))
      } finally {
        setEnrichingLiteratureId(undefined)
      }
    },
    [literature, room, roomToken],
  )

  const selectedCell = selectedNode?.data.kind === 'cell' ? selectedNode : nodes.find((node) => node.id === selectedNode?.parentId)

  const saveTissueModule = useCallback(() => {
    if (!selectedCell) return
    const ids = new Set([selectedCell.id])
    let changed = true
    while (changed) {
      changed = false
      for (const node of nodes) {
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
          ids.add(node.id)
          changed = true
        }
      }
    }
    const moduleNodes = nodes.filter((node) => ids.has(node.id))
    const moduleEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    const item: TissueModule = {
      id: uid('module'),
      name: selectedCell.data.label,
      description: `Reusable ${selectedCell.data.label} network`,
      createdAt: new Date().toISOString(),
      nodes: JSON.parse(JSON.stringify(moduleNodes)),
      edges: JSON.parse(JSON.stringify(moduleEdges)),
      literature: [],
    }
    setModules((items) => [item, ...items])
  }, [edges, nodes, selectedCell])

  const insertTissueModule = useCallback(
    (item: TissueModule) => {
      const root = item.nodes.find((node) => node.data.kind === 'cell' && !node.parentId)
      if (!root) return
      const idMap = new Map(item.nodes.map((node) => [node.id, uid('module-node')]))
      const rightEdge = Math.max(0, ...nodes.filter((node) => node.data.kind === 'cell').map((node) => node.position.x + Number(node.style?.width ?? 620)))
      const nextNodes = item.nodes.map((node) => ({
        ...JSON.parse(JSON.stringify(node)),
        id: idMap.get(node.id)!,
        parentId: node.parentId ? idMap.get(node.parentId) : undefined,
        selected: false,
        data: { ...node.data, panelId: targetPanel },
        position: node.id === root.id ? { x: rightEdge + 80, y: root.position.y } : { ...node.position },
      })) as BioNodeType[]
      const nextEdges = item.edges.map((edge) => ({
        ...JSON.parse(JSON.stringify(edge)),
        id: uid('edge'),
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        selected: false,
      })) as BioEdge[]
      setNodes((current) => [...current, ...nextNodes])
      setEdges((current) => [...current, ...nextEdges])
      setShowModulePanel(false)
    },
    [nodes, targetPanel],
  )

  const syncRoom = useCallback(
    async (direction: 'push' | 'pull') => {
      if (!room.endpoint || !room.roomId) return
      setIsSyncing(true)
      try {
        if (direction === 'push') {
          const syncedAt = new Date().toISOString()
          const result = await pushRoom(room, roomToken, currentScene)
          setRoom((value) => ({ ...value, endpoint: result.endpoint, revision: result.revision, lastSyncedAt: syncedAt }))
        } else {
          createSnapshot()
          const result = await pullRoom(room, roomToken)
          applySceneState(result.scene)
          setRoom((value) => ({ ...value, endpoint: result.endpoint, revision: result.revision, lastSyncedAt: new Date().toISOString() }))
        }
        setNotice(`협업 룸 ${direction === 'push' ? '업로드' : '가져오기'} 완료`)
      } catch (error) {
        setNotice(error instanceof BackendConflictError ? error.message : `동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      } finally {
        setIsSyncing(false)
      }
    },
    [applySceneState, createSnapshot, currentScene, room, roomToken],
  )

  const exportReviewPackage = useCallback(async () => {
    const target = flowRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!target) return
    try {
      setSelectedNodeId(undefined)
      setSelectedEdgeId(undefined)
      await instanceRef.current?.fitView({ padding: 0.14, duration: 0 })
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const figure = await toPng(target, { backgroundColor: styleBackground[stylePreset], pixelRatio: 2, cacheBust: true })
      const zip = new JSZip()
      zip.file('scene.json', JSON.stringify(currentScene, null, 2))
      zip.file('figure.png', figure.split(',')[1], { base64: true })
      zip.file('REVIEW.md', `# ${sceneTitle}\nStatus: ${review.status}\n\n${review.notes}`)
      const csv = ['edge_id,interaction,source,target', ...edges.map((e) => [e.id, e.data?.interaction, e.source, e.target].map(csvCell).join(','))].join('\n')
      zip.file('evidence.csv', csv)
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `bioscene-${templateId}-review.zip`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setNotice('리뷰 패키지 내보내기 실패')
    }
  }, [currentScene, edges, review.notes, review.status, sceneTitle, stylePreset, templateId])

  const warnings = useMemo(() => biologicalWarnings(nodes, edges), [edges, nodes])

  // Palette Handlers
  const handleAddCatalogProtein = useCallback(
    (item: CatalogItem, count: number) => {
      setMoleculeLibrary((curr) => (curr.some((m) => m.id === item.molecule.id) ? curr : [...curr, item.molecule]))
      const result = placeCatalogMolecule(nodes, item.molecule, {
        targetCellId: selectedCell?.id,
        category: item.category,
        customColor: item.customColor,
        count,
      })
      const lastId = result.createdIds.at(-1)
      setNodes(result.nodes.map((n) => ({ ...n, selected: n.id === lastId })))
      setSelectedNodeId(lastId)
      setSelectedEdgeId(undefined)
      setNotice(`${item.name} (${count}개) 배치됨 — 드래그해 위치를 다듬거나 바로 연결하세요.`)
      window.setTimeout(() => instanceRef.current?.fitView({ padding: 0.12, duration: 260 }), 50)
    },
    [nodes, selectedCell?.id],
  )

  const handleAddUniProtMolecule = useCallback(
    (molecule: MoleculeDefinition, count: number) => {
      setMoleculeLibrary((curr) => (curr.some((m) => m.id === molecule.id) ? curr.map((m) => (m.id === molecule.id ? molecule : m)) : [...curr, molecule]))
      const category =
        molecule.topology === 'nuclear'
          ? 'transcription'
          : molecule.topology === 'intracellular'
            ? 'signaling'
            : molecule.topology === 'secreted'
              ? 'cytokine'
              : 'receptor'
      const result = placeCatalogMolecule(nodes, molecule, { targetCellId: selectedCell?.id, category, count })
      const lastId = result.createdIds.at(-1)
      setNodes(result.nodes.map((n) => ({ ...n, selected: n.id === lastId })))
      setSelectedNodeId(lastId)
      setSelectedEdgeId(undefined)
      setNotice(`${molecule.name} (UniProt ${molecule.uniprotAccession ?? ''}) 배치됨`)
    },
    [nodes, selectedCell?.id],
  )

  const handleAddTherapeutic = useCallback(
    (opts: {
      molecule: MoleculeDefinition
      nodeOverrides: Partial<BioNodeType['data']>
      connectTargetIds?: string[]
      interaction?: InteractionType
    }) => {
      setMoleculeLibrary((curr) => [...curr, opts.molecule])
      const added = addSimpleDrug(nodes, opts.molecule, selectedCell?.id)
      let workingNodes = added.nodes.map((n) =>
        n.id === added.id ? { ...n, data: { ...n.data, ...opts.nodeOverrides, showName: true } } : n,
      )

      // Smart positioning right above/near target molecule so visual layout is immediately clean!
      const primaryTarget = opts.connectTargetIds?.[0] ? workingNodes.find((n) => n.id === opts.connectTargetIds![0]) : undefined
      if (primaryTarget && (!opts.connectTargetIds || opts.connectTargetIds.length === 1)) {
        workingNodes = workingNodes.map((n) => {
          if (n.id !== added.id) return n
          const sameParent = n.parentId === primaryTarget.parentId
          return {
            ...n,
            parentId: primaryTarget.parentId,
            ...(primaryTarget.parentId ? { extent: 'parent' as const } : {}),
            position: sameParent
              ? {
                  x: primaryTarget.position.x + (primaryTarget.data.kind === 'ligand' ? -135 : 0),
                  y: Math.max(24, primaryTarget.position.y - (primaryTarget.data.kind === 'ligand' ? 6 : 124)),
                }
              : n.position,
            data: { ...n.data, positionMode: 'manual' },
          }
        })
      }

      const createdEdges: BioEdge[] = []
      if (opts.interaction && opts.connectTargetIds?.length) {
        for (const targetId of opts.connectTargetIds) {
          try {
            const connected = connectStudioNodes(workingNodes, added.id, targetId, opts.interaction)
            workingNodes = connected.nodes
            createdEdges.push(connected.edge)
          } catch {
            /* skip incompatible */
          }
        }
      }

      setNodes(workingNodes.map((n) => ({ ...n, selected: n.id === added.id })))
      if (createdEdges.length) setEdges((curr) => [...curr, ...createdEdges])
      setSelectedNodeId(added.id)
      setSelectedEdgeId(undefined)
      setNotice(
        createdEdges.length
          ? `${opts.molecule.name} 배치 및 ${opts.interaction} 연결 완료!`
          : `${opts.molecule.name} 배치 완료`,
      )
      window.setTimeout(() => instanceRef.current?.fitView({ padding: 0.12, duration: 260 }), 50)
    },
    [nodes, selectedCell?.id],
  )

  const handleInsertSvgAsset = useCallback(
    (asset: AssetReference, applyToSelected: boolean) => {
      if (applyToSelected && selectedNodeId) {
        attachAsset(asset)
        return
      }
      const id = uid('bio')
      const parent = selectedCell
      const node: BioNodeType = {
        id,
        type: 'bio',
        ...(parent ? { parentId: parent.id, extent: 'parent' as const } : {}),
        position: parent ? { x: 180, y: 120 } : { x: 320, y: 200 },
        selected: true,
        data: createBioData('ligand', asset.name, { asset, showName: true, positionMode: 'manual', visibility: 'visible' }),
      }
      setNodes((curr) => [...curr.map((n) => ({ ...n, selected: false })), node])
      setSelectedNodeId(id)
      setSelectedEdgeId(undefined)
      setNotice(`${asset.name} SVG 개체가 캔버스에 추가되었습니다.`)
    },
    [attachAsset, selectedCell, selectedNodeId],
  )

  return (
    <div className="studio-shell" data-style={stylePreset}>
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void loadJson(file)
          event.target.value = ''
        }}
      />

      {/* Row 1: Unified Studio Header */}
      <header className="studio-header" data-export-exclude="true">
        <div className="studio-brand">
          <span className="studio-brand-icon">
            <FlaskConical size={18} />
          </span>
          <div>
            <strong>BioScene</strong>
            <small>MoA STUDIO</small>
          </div>
        </div>

        <div className="studio-title-box">
          <input
            className="studio-title-input"
            aria-label="Figure title"
            value={sceneTitle}
            onChange={(e) => setSceneTitle(e.target.value)}
            title="클릭하여 도식 제목 수정"
          />
        </div>
        <span className="studio-save-pill" role="status">
          {autosaveStatus === 'saved' ? '자동 저장됨' : '저장 중…'}
        </span>

        <div className="studio-header-spacer" />

        <div className="studio-header-actions">
          <button
            className="studio-btn"
            data-testid="undo"
            aria-label="Undo"
            title="실행 취소 (⌘Z)"
            disabled={!undoStack.current.length}
            onClick={undo}
            data-history-version={historyVersion}
          >
            <Undo2 size={15} /> 취소
          </button>
          <button className="studio-btn" data-testid="redo" aria-label="Redo" title="다시 실행 (⇧⌘Z)" disabled={!redoStack.current.length} onClick={redo}>
            <Redo2 size={15} /> 재실행
          </button>

          <button className="studio-secondary-btn" onClick={() => setShowMechanismComposer(true)} title="문장으로 기전 설명을 입력하면 자동으로 도식을 생성합니다">
            <Sparkles size={14} /> 문장 생성
          </button>

          <button className="studio-secondary-btn" data-testid="protein-setup" onClick={() => openMoleculeBuilder()} title="단백질 UniProt/AlphaFold 구조 및 항체 도메인 상세 설계">
            <Workflow size={14} /> 분자 설계
          </button>

          <button className="studio-secondary-btn" data-testid="save-json" onClick={saveJson} title="현재 장면을 BioScene JSON으로 저장">
            <Save size={14} /> 저장
          </button>
          <button className="studio-secondary-btn" onClick={() => fileInput.current?.click()} title="저장한 JSON 불러오기">
            <FolderOpen size={14} /> 열기
          </button>

          <details className="studio-more-menu">
            <summary>
              <Settings2 size={14} /> 고급 도구
            </summary>
            <div className="studio-more-popover">
              <button data-testid="workspace-settings" onClick={() => setShowWorkspaceSetup(true)}>
                <PanelsTopLeft size={14} /> 캔버스 크기 · 여백 설정
              </button>
              <button onClick={() => setShowProductionPanel(true)}>
                <Download size={14} /> 스냅샷 · 출판 내보내기
              </button>
              <button onClick={() => setShowLiteraturePanel(true)}>
                <BookOpen size={14} /> PMID · DOI 문헌 근거
              </button>
              <button onClick={() => setShowCollaborationPanel(true)}>
                <Cloud size={14} /> 클라우드 협업 룸 동기화
              </button>
              <button onClick={() => setShowReviewPanel(true)}>
                <ClipboardCheck size={14} /> 과학 검수 ({review.status})
              </button>
              <button onClick={() => setShowShortcuts(true)}>
                <HelpCircle size={14} /> 단축키 안내
              </button>
              <hr />
              <label>
                장면 범위 (Scene scope)
                <select
                  aria-label="Scene type"
                  value={visualizationProfile.sceneType}
                  onChange={(event) =>
                    changeVisualizationProfile({
                      ...visualizationProfile,
                      sceneType: event.target.value as VisualizationProfile['sceneType'],
                    })
                  }
                >
                  {Object.entries(sceneTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                레거시 템플릿 불러오기
                <select aria-label="Mechanism template" value={templateId} onChange={(event) => loadTemplate(event.target.value as SceneTemplateId)}>
                  {Object.values(sceneTemplates).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.description}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>

          <div className="studio-export-combo">
            <select aria-label="Export format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}>
              <option value="svg">SVG 벡터</option>
              <option value="png">PNG 고화질</option>
              <option value="pptx">PPTX 슬라이드</option>
              <option value="package">AI 패키지 (.zip)</option>
            </select>
            <button className="studio-primary-btn" disabled={!nodes.length} onClick={() => void exportFigure(exportFormat)}>
              <Download size={14} /> 내보내기
            </button>
          </div>
        </div>
      </header>

      {/* Row 2: Direct Manipulation & 1-Click Interaction Toolbar */}
      <nav className="studio-subtoolbar" aria-label="BioScene 편집 도구" data-export-exclude="true">
        <div className="tool-cluster" role="group" aria-label="선택 및 화면 이동">
          <button
            className={`tool-chip ${drawingTool === 'select' && !connectMode ? 'is-active' : ''}`}
            data-testid="tool-select"
            onClick={() => {
              setDrawingTool('select')
              setConnectMode(undefined)
            }}
            title="선택 및 직접 이동 (V)"
          >
            <MousePointer2 size={14} /> 선택 <kbd>V</kbd>
          </button>
          <button
            className={`tool-chip ${drawingTool === 'pan' ? 'is-active' : ''}`}
            data-testid="tool-pan"
            onClick={() => {
              setDrawingTool('pan')
              setConnectMode(undefined)
            }}
            title="화면 드래그 이동 (H)"
          >
            <Hand size={14} /> 손바닥 <kbd>H</kbd>
          </button>
        </div>

        <div className="tool-cluster" role="group" aria-label="빠른 개체 그리기">
          <button
            className={`tool-chip ${drawingTool === 'place_cell' ? 'is-active' : ''}`}
            data-testid="tool-place_cell"
            onClick={() => {
              setDrawingTool('place_cell')
              setConnectMode(undefined)
            }}
            title="캔버스 클릭 위치에 새 세포 생성 (C)"
          >
            <Circle size={14} /> 세포 <kbd>C</kbd>
          </button>
          <button
            className={`tool-chip ${drawingTool === 'freehand_membrane' ? 'is-active' : ''}`}
            data-testid="tool-freehand_membrane"
            onClick={() => {
              setDrawingTool('freehand_membrane')
              setConnectMode(undefined)
            }}
            title="드래그해 자유 곡선 인지질 막 그리기 (M)"
          >
            <Copy size={14} /> 곡선막 <kbd>M</kbd>
          </button>
          <button
            className={`tool-chip ${drawingTool === 'straight_membrane' ? 'is-active' : ''}`}
            data-testid="tool-straight_membrane"
            onClick={() => {
              setDrawingTool('straight_membrane')
              setConnectMode(undefined)
            }}
            title="드래그해 직선 인지질 막 그리기"
          >
            <Minus size={14} /> 직선막
          </button>
          <button
            className={`tool-chip ${drawingTool === 'place_receptor' ? 'is-active' : ''}`}
            data-testid="tool-place_receptor"
            onClick={() => {
              setDrawingTool('place_receptor')
              setConnectMode(undefined)
            }}
            title="수용체 클릭 배치 (P)"
          >
            <Component size={14} /> 수용체 <kbd>P</kbd>
          </button>
          <button
            className={`tool-chip ${drawingTool === 'place_antibody' ? 'is-active' : ''}`}
            data-testid="tool-place_antibody"
            onClick={() => {
              setDrawingTool('place_antibody')
              setConnectMode(undefined)
            }}
            title="항체 클릭 배치 (A)"
          >
            <ShieldCheck size={14} /> 항체 <kbd>A</kbd>
          </button>
          <button
            className={`tool-chip ${drawingTool === 'place_ligand' ? 'is-active' : ''}`}
            data-testid="tool-place_ligand"
            onClick={() => {
              setDrawingTool('place_ligand')
              setConnectMode(undefined)
            }}
            title="사이토카인/리간드 클릭 배치 (L)"
          >
            <Pill size={14} /> 리간드 <kbd>L</kbd>
          </button>
          <button
            className={`tool-chip ${drawingTool === 'place_annotation' ? 'is-active' : ''}`}
            data-testid="tool-place_annotation"
            onClick={() => {
              setDrawingTool('place_annotation')
              setConnectMode(undefined)
            }}
            title="설명 텍스트 콜아웃 배치 (T)"
          >
            <Type size={14} /> 설명 <kbd>T</kbd>
          </button>
          <button
            className={`tool-chip ${continuousTool ? 'is-active' : ''}`}
            data-testid="continuous-tool"
            aria-pressed={continuousTool}
            onClick={() => setContinuousTool((v) => !v)}
            title="연속 그리기 고정"
          >
            <Pin size={13} />
          </button>
        </div>

        <div className="tool-cluster" role="group" aria-label="상호작용 연결 도구">
          {([
            ['BLOCK', false, '차단 ⊣', 'rel-block', Ban],
            ['BIND', false, '결합 —', 'rel-bind', Link2],
            ['ACTIVATE', false, '활성 →', 'rel-activate', Zap],
            ['PHOSPHORYLATE', false, '인산화 +P', 'rel-activate', Plus],
            ['TRANSLOCATE', false, '핵·막 이동 ⇢', 'rel-bind', Sparkles],
          ] as const).map(([type, ind, label, cls, Icon]) => {
            const active = connectMode?.interaction === type && Boolean(connectMode?.indirect) === ind
            return (
              <button
                key={label}
                className={`tool-chip ${cls} ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => {
                  setDrawingTool('select')
                  if (active) {
                    setConnectMode(undefined)
                    setNotice('선택 모드')
                  } else {
                    setConnectMode({ interaction: type, indirect: ind, sourceId: undefined })
                    setNotice(`${label}: 출발 분자를 먼저 클릭한 뒤 도착 분자를 클릭하세요 (ESC 취소).`)
                  }
                }}
              >
                <Icon size={13} /> {label}
              </button>
            )
          })}
        </div>

        <div className="subtoolbar-spacer" />

        <div className="tool-cluster" role="group" aria-label="정렬 및 화면 맞춤">
          <button className="tool-chip" title="좌측 맞춤 정렬" onClick={() => alignSelection('left')}>
            <AlignStartVertical size={14} />
          </button>
          <button className="tool-chip" title="수평 중앙 정렬" onClick={() => alignSelection('center-x')}>
            <AlignCenterVertical size={14} />
          </button>
          <button className="tool-chip" title="상단 맞춤 정렬" onClick={() => alignSelection('top')}>
            <AlignStartHorizontal size={14} />
          </button>
          <button className="tool-chip" title="수직 중앙 정렬" onClick={() => alignSelection('center-y')}>
            <AlignCenterHorizontal size={14} />
          </button>
          <button className="tool-chip" onClick={() => void runLayout()} disabled={isLayingOut} title="구획 기준으로 겹침 없이 자동 정렬">
            <Sparkles size={13} /> 자동 정렬
          </button>
          <button className="tool-chip" onClick={() => instanceRef.current?.fitView({ padding: 0.12, duration: 300 })} title="전체 그림 화면에 맞추기">
            <Maximize2 size={13} /> 화면 맞춤
          </button>
        </div>
      </nav>

      {/* Row 3: 3-Column Studio Workspace */}
      <div className="studio-workspace">
        <StudioPalette
          activeTab={paletteTab}
          onTabChange={setPaletteTab}
          nodes={nodes}
          library={moleculeLibrary}
          selectedNode={selectedNode}
          onLoadBlueprint={loadBlueprint}
          onStartEmpty={startEmptyCanvas}
          onAddCell={(opts) => {
            const added = placeStudioCell(nodes, opts)
            setNodes(added.nodes.map((n) => ({ ...n, selected: n.id === added.cellId })))
            setSelectedNodeId(added.cellId)
            setSelectedEdgeId(undefined)
            setNotice(`${opts.name} 세포가 추가되었습니다. 이제 ‘단백질’ 탭에서 수용체를 추가해 보세요.`)
            window.setTimeout(() => instanceRef.current?.fitView({ padding: 0.12, duration: 300 }), 60)
          }}
          onCloneTreatedComparison={() => {
            const next = treatedComparison(nodes, edges)
            setNodes(next.nodes)
            setEdges(next.edges)
            setNotice('우측에 처치군(Treated) 비교 패널이 복제되었습니다. 항체와 신호 상태를 편집해 비교 도식을 완성하세요.')
            window.setTimeout(() => instanceRef.current?.fitView({ padding: 0.1, duration: 350 }), 80)
          }}
          onAddCatalogProtein={handleAddCatalogProtein}
          onAddUniProtMolecule={handleAddUniProtMolecule}
          onAddTherapeutic={handleAddTherapeutic}
          onInsertSvgAsset={handleInsertSvgAsset}
          onOpenAdvancedMoleculeSetup={() => openMoleculeBuilder()}
          onOpenMechanismComposer={() => setShowMechanismComposer(true)}
        />

        <main
          className={`canvas-wrap tool-${drawingTool}`}
          ref={flowRef}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
          onPointerCancel={() => setDraftMembrane(undefined)}
        >
          <CanvasDisplayProvider value={canvasDisplay}>
            <ReactFlow<BioNodeType, BioEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onInit={(instance) => {
                instanceRef.current = instance
                window.setTimeout(() => instance.fitView({ padding: 0.12, duration: 0 }), 40)
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClickInStudio}
              onNodeContextMenu={(event, node) => {
                event.preventDefault()
                selectObject(node.id)
                setContextTarget({ id: node.id, kind: 'node', x: event.clientX, y: event.clientY })
              }}
              onEdgeClick={handleEdgeClickInStudio}
              onEdgeContextMenu={(event, edge) => {
                event.preventDefault()
                selectObject(edge.id, 'edge')
                setContextTarget({ id: edge.id, kind: 'edge', x: event.clientX, y: event.clientY })
              }}
              onSelectionChange={handleSelectionChange}
              onPaneClick={handlePaneClick}
              onNodeDragStop={(_, node) => handleNodeDragStop(node)}
              panOnDrag={drawingTool === 'pan' || drawingTool === 'select'}
              selectionOnDrag={false}
              nodesDraggable={drawingTool === 'select'}
              nodesConnectable={drawingTool === 'select'}
              elementsSelectable={drawingTool === 'select'}
              snapToGrid={workspace.snapToGrid}
              snapGrid={[workspace.gridSize, workspace.gridSize]}
              fitView
              fitViewOptions={{ padding: 0.12 }}
              minZoom={0.15}
              maxZoom={2.2}
              selectionKeyCode="Shift"
              multiSelectionKeyCode="Shift"
              deleteKeyCode={null}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={stylePreset === 'presentation-dark' ? '#334a42' : '#d5e2dc'} />

              {visualizationProfile.sceneType === 'empty' && nodes.length === 0 && (
                <ViewportPortal>
                  <div
                    className="figure-workspace-frame"
                    style={{ width: workspace.width, height: workspace.height, backgroundColor: workspaceBackground(workspace) ?? 'transparent' }}
                  >
                    <span className="workspace-dimensions" data-export-exclude="true">
                      {Math.round(workspace.width)} × {Math.round(workspace.height)} {workspace.unit}
                    </span>
                  </div>
                </ViewportPortal>
              )}

              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                position="bottom-right"
                style={{ width: 128, height: 82 }}
                nodeColor={(node) => (node.type === 'cell' ? '#d7ece3' : '#4a967c')}
                maskColor="rgba(244, 249, 246, 0.78)"
              />

              {connectMode && (
                <Panel position="top-center" className="active-connect-banner" data-export-exclude="true">
                  <span>
                    {connectMode.sourceId
                      ? `연결 대상 클릭 대기 중 (${connectMode.interaction})`
                      : `출발 분자를 클릭하세요 (${connectMode.interaction})`}
                  </span>
                  <button onClick={() => setConnectMode(undefined)}>취소 (ESC)</button>
                </Panel>
              )}

              <Panel position="bottom-center" className="notice-bar" data-export-exclude="true" title={warnings.join('\n')}>
                <span role="status">{notice}</span>
              </Panel>
            </ReactFlow>
          </CanvasDisplayProvider>

          {draftMembrane && (
            <svg className="membrane-drawing-preview" aria-hidden="true">
              <path
                d={membranePathD(
                  drawingTool === 'straight_membrane' && draftMembrane.screen.length > 1
                    ? [draftMembrane.screen[0], draftMembrane.screen.at(-1)!]
                    : draftMembrane.screen,
                )}
              />
            </svg>
          )}
        </main>

        {selectedNode?.data.kind === 'membrane' ? (
          <Inspector
            selectedNode={selectedNode}
            selectedEdgeId={selectedEdgeId}
            selectedInteraction={selectedEdge?.data?.interaction}
            selectedEdgeData={selectedEdge?.data}
            onNodeChange={updateSelectedNode}
            onEdgeChange={updateSelectedEdge}
            onEdgeDataChange={updateSelectedEdgeData}
            onDelete={deleteSelected}
            onBrowseAssets={() => setShowAssetBrowser(true)}
            onDetachAsset={detachAsset}
            onEditStructure={() => openMoleculeBuilder(selectedNode)}
            constraintMode={mode}
          />
        ) : (
          <StudioInspector
            nodes={nodes}
            edges={edges}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            stylePreset={stylePreset}
            exportPreset={exportPreset}
            showCompartmentLabels={canvasOverlays.compartments}
            showInteractionLabels={canvasOverlays.interactionLabels}
            onStylePreset={setStylePreset}
            onExportPreset={setExportPreset}
            onToggleCompartmentLabels={() => toggleCanvasOverlay('compartments')}
            onToggleInteractionLabels={() => toggleCanvasOverlay('interactionLabels')}
            onSelectObject={selectObject}
            onUpdateNode={updateSelectedNode}
            onChangeCount={(count) => {
              if (!selectedNode) return
              const next = changeRepresentation(nodes, selectedNode.id, count)
              setNodes(next)
              setEdges((items) => pruneSimpleEdges(next, items))
            }}
            onConnectNodes={(src, dst, rel, blockedEdgeId) => performStudioConnect(src, dst, rel, { blockedEdgeId })}
            onUpdateEdge={updateSelectedEdge}
            onUpdateEdgeData={updateSelectedEdgeData}
            onDuplicateSelected={duplicateSelected}
            onDeleteSelected={deleteSelected}
            onDetachAsset={detachAsset}
            onEditAdvancedStructure={() => openMoleculeBuilder(selectedNode)}
            onExport={(fmt) => void exportFigure(fmt)}
          />
        )}
      </div>

      {contextTarget && (
        <ObjectContextMenu
          target={contextTarget}
          isMembrane={nodes.find((node) => node.id === contextTarget.id)?.data.kind === 'membrane'}
          locked={!!nodes.find((node) => node.id === contextTarget.id)?.data.locked}
          onAction={handleContextAction}
        />
      )}

      {showShortcuts && (
        <div className="shortcut-overlay" onMouseDown={() => setShowShortcuts(false)}>
          <section className="shortcut-card" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">EDITOR HELP</span>
                <h2>키보드 단축키</h2>
              </div>
              <button onClick={() => setShowShortcuts(false)}>×</button>
            </header>
            <div>
              <kbd>V</kbd>
              <span>선택 · 이동</span>
              <kbd>H</kbd>
              <span>화면 드래그</span>
              <kbd>C</kbd>
              <span>세포 배치</span>
              <kbd>M</kbd>
              <span>인지질 막 그리기</span>
              <kbd>P</kbd>
              <span>수용체 배치</span>
              <kbd>A</kbd>
              <span>항체 배치</span>
              <kbd>T</kbd>
              <span>설명 텍스트</span>
              <kbd>Del</kbd>
              <span>선택 삭제</span>
              <kbd>⌘/Ctrl Z</kbd>
              <span>실행 취소</span>
              <kbd>⌘/Ctrl D</kbd>
              <span>복제</span>
              <kbd>더블클릭</kbd>
              <span>캔버스에서 바로 이름 수정</span>
              <kbd>Esc</kbd>
              <span>연결 취소 · 선택 모드 복귀</span>
            </div>
          </section>
        </div>
      )}

      {showMechanismComposer && <MechanismComposer onClose={() => setShowMechanismComposer(false)} onGenerate={generateFromMechanism} />}
      {showAssetBrowser && <SmartAssetBrowser selectedNode={selectedNode} onClose={() => setShowAssetBrowser(false)} onAttach={attachAsset} />}
      {showProductionPanel && (
        <ProductionPanel
          stylePreset={stylePreset}
          exportPreset={exportPreset}
          revisions={revisions}
          onStyle={setStylePreset}
          onExportPreset={setExportPreset}
          onSnapshot={createSnapshot}
          onRestore={restoreRevision}
          onExport={exportFigure}
          onClose={() => setShowProductionPanel(false)}
        />
      )}
      {showReviewPanel && <ReviewPanel value={review} onChange={setReview} onClose={() => setShowReviewPanel(false)} onExportPackage={exportReviewPackage} />}
      {showLiteraturePanel && (
        <LiteraturePanel
          records={literature}
          selectedEdgeId={selectedEdgeId}
          attachedIds={selectedEdge?.data?.evidence?.literatureIds ?? []}
          enrichingId={enrichingLiteratureId}
          canEnrich={!!room.endpoint}
          onChange={updateLiterature}
          onAttach={attachLiterature}
          onEnrich={enrichLiteratureRecord}
          onClose={() => setShowLiteraturePanel(false)}
        />
      )}
      {showModulePanel && (
        <TissueModulePanel
          modules={modules}
          canSave={!!selectedCell}
          onSave={saveTissueModule}
          onInsert={insertTissueModule}
          onDelete={(id) => setModules((items) => items.filter((item) => item.id !== id))}
          onClose={() => setShowModulePanel(false)}
        />
      )}
      {showCollaborationPanel && (
        <CollaborationPanel
          value={collaboration}
          room={room}
          token={roomToken}
          busy={isSyncing}
          supabaseConfigured={supabaseConfigured}
          signedInEmail={signedInEmail}
          authBusy={isAuthenticating}
          onSignIn={signIn}
          onSignOut={signOut}
          onChange={setCollaboration}
          onRoomChange={setRoom}
          onTokenChange={setRoomToken}
          onPush={() => syncRoom('push')}
          onPull={() => syncRoom('pull')}
          onClose={() => setShowCollaborationPanel(false)}
        />
      )}
      {showSceneSettings && (
        <SceneSettingsPanel
          profile={visualizationProfile}
          views={views}
          warnings={warnings}
          onChange={changeVisualizationProfile}
          onSaveView={() => {
            const name = window.prompt('저장할 뷰 이름', `${sceneTypeLabels[visualizationProfile.sceneType]} view`)
            if (!name?.trim()) return
            const view = captureView(uid('view'), name.trim(), visualizationProfile, nodes)
            setViews((items) => [...items, view])
            setActiveViewId(view.id)
          }}
          onApplyView={(view) => {
            const restored = restoreView(view, nodes, edges)
            setVisualizationProfile(view.profile)
            setNodes(restored.nodes)
            setEdges(restored.edges)
            setActiveViewId(view.id)
            setShowSceneSettings(false)
          }}
          onDeleteView={(id) => setViews((items) => items.filter((view) => view.id !== id))}
          onClose={() => setShowSceneSettings(false)}
        />
      )}
      {showMoleculeSetup && (
        <MoleculeSetupPanel
          molecules={moleculeLibrary}
          customFunctions={customFunctions}
          initialMoleculeId={setupMoleculeId}
          canApply={!!selectedNode && !['cell', 'annotation', 'signal', 'transcription'].includes(selectedNode.data.kind)}
          instanceCounts={moleculeInstanceCounts}
          onChange={setMoleculeLibrary}
          onCustomFunctions={setCustomFunctions}
          onSave={saveMoleculeDefinition}
          onDelete={deleteMoleculeDefinition}
          onAdd={addMoleculeToScene}
          onClose={() => setShowMoleculeSetup(false)}
        />
      )}
      {showWorkspaceSetup && <WorkspaceSetupPanel value={workspace} hasContent={nodes.length > 0} onSave={saveWorkspace} onFitContent={fitWorkspaceToContent} onClose={() => setShowWorkspaceSetup(false)} />}
      <ContextHelp />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <AppCanvas />
      </ReactFlowProvider>
    </ErrorBoundary>
  )
}
