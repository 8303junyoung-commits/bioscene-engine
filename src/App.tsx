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
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react'
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, BookOpen, ClipboardCheck, Cloud, Download, FileJson, FlaskConical, LayoutTemplate, LockKeyhole, PanelsTopLeft, Plus, Redo2, RotateCcw, Save, Settings2, Sparkles, Undo2, UnlockKeyhole, Upload, Workflow } from 'lucide-react'
import { toPng, toSvg } from 'html-to-image'
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import { BioNode } from './components/BioNode'
import { CellNode } from './components/CellNode'
import { Inspector } from './components/Inspector'
import { InteractionEdge } from './components/InteractionEdge'
import { MechanismComposer } from './components/MechanismComposer'
import { Sidebar } from './components/Sidebar'
import { SmartAssetBrowser } from './components/SmartAssetBrowser'
import { ProductionPanel } from './components/ProductionPanel'
import { AnnotationNode } from './components/AnnotationNode'
import { ReviewPanel } from './components/ReviewPanel'
import { LiteraturePanel } from './components/LiteraturePanel'
import { TissueModulePanel } from './components/TissueModulePanel'
import { CollaborationPanel } from './components/CollaborationPanel'
import { ContextHelp } from './components/ContextHelp'
import { SceneSettingsPanel } from './components/SceneSettingsPanel'
import { NewFigureDialog } from './components/NewFigureDialog'
import { MoleculeSetupPanel } from './components/MoleculeSetupPanel'
import { MembraneNode } from './components/MembraneNode'
import { WorkspaceSetupPanel } from './components/WorkspaceSetupPanel'
import { BlankQuickStart } from './components/BlankQuickStart'
import { EditorToolbar } from './components/EditorToolbar'
import { LayersPanel } from './components/LayersPanel'
import { ObjectContextMenu, type ContextTarget } from './components/ObjectContextMenu'
import { createBioData, inferInteraction, semanticDefaults, validateConnection } from './biology'
import { cloneTemplate, DEFAULT_TEMPLATE_ID, sceneTemplates } from './data'
import { sceneFromMechanism } from './mechanism'
import type { AlignmentAction, AssetReference, BioEdge, BioKind, BioNode as BioNodeType, BioNodePatch, CollaborationState, ConstraintMode, DrawingTool, ExportPreset, FigureWorkspace, InteractionData, InteractionType, LiteratureRecord, MembraneDefinition, MembranePoint, MoleculeDefinition, ParsedMechanism, ReviewMetadata, RoomConfig, SceneFile, SceneRevision, SceneTemplateId, SceneView, StylePreset, TissueModule, VisualizationProfile } from './types'
import { autoLayout, biologicalWarnings, constrainNode, downloadText, findAvailablePosition, parseSceneFile, parseTissueModule } from './utils'
import { uid } from './identity'
import { markerForInteraction } from './visualGrammar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { BackendConflictError, enrichLiterature, pullRoom, pushRoom, sanitizedEndpoint } from './backend'
import { sendMagicLink, signOutSupabase, supabaseApiEndpoint, supabaseConfigured, watchSupabaseSession } from './supabaseClient'
import { applyVisualizationProfile, captureView, defaultVisualizationProfile, restoreView, sceneTypeLabels } from './sceneViews'
import { applyMoleculeToNode, createMolecule, portsFromDomains } from './molecules'
import { membranePathD, nearestPathPoint, pathPointAt, smoothMembranePoints } from './membraneGeometry'
import { defaultFigureWorkspace, workspaceBackground } from './workspace'

const nodeTypes = { cell: CellNode, bio: BioNode, annotation: AnnotationNode, membrane: MembraneNode }
const edgeTypes = { interaction: InteractionEdge }
const AUTOSAVE_KEY = 'bioscene.scene.autosave.v0.13'
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
const styleBackground: Record<StylePreset, string> = { 'scientific-clean': '#f8fbf9', 'journal-light': '#ffffff', 'presentation-dark': '#17211e' }
const defaultLabels: Record<Exclude<BioKind, 'cell' | 'annotation' | 'membrane'>, string> = {
  receptor: 'Receptor', ligand: 'Ligand', antibody: 'Antibody', signal: 'Signal node', transcription: 'Transcription',
}

function readAutosavedScene() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY) ?? localStorage.getItem('bioscene.scene.autosave.v0.12') ?? localStorage.getItem('bioscene.scene.autosave.v0.11') ?? localStorage.getItem('bioscene.scene.autosave.v0.10') ?? localStorage.getItem('bioscene.scene.autosave.v0.9') ?? localStorage.getItem('bioscene.scene.autosave.v0.8')
    if (!raw) return undefined
    return parseSceneFile(JSON.parse(raw))
  } catch {
    return undefined
  }
}

function readRevisions(): SceneRevision[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REVISION_KEY) ?? localStorage.getItem('bioscene.scene.revisions.v0.9') ?? '[]')
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Partial<SceneRevision>
      const scene = parseSceneFile(candidate.scene)
      return typeof candidate.id === 'string' && typeof candidate.label === 'string' && typeof candidate.createdAt === 'string' && scene
        ? [{ id: candidate.id, label: candidate.label, createdAt: candidate.createdAt, scene }]
        : []
    }).slice(0, 5)
  } catch { return [] }
}

function readModules(): TissueModule[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MODULE_KEY) ?? localStorage.getItem('bioscene.tissue.modules.v0.9') ?? '[]')
    return Array.isArray(value) ? value.map(parseTissueModule).filter((item): item is TissueModule => !!item).slice(0, 30) : []
  } catch { return [] }
}

function readRoom(): RoomConfig {
  const fallbackEndpoint = String(import.meta.env.VITE_BIOSCENE_API_BASE ?? '')
  try {
    const value = JSON.parse(localStorage.getItem(ROOM_KEY) ?? localStorage.getItem('bioscene.room.config.v0.9') ?? '{}')
    const endpoint = typeof value.endpoint === 'string' && value.endpoint ? sanitizedEndpoint(value.endpoint) : (fallbackEndpoint ? sanitizedEndpoint(fallbackEndpoint) : '')
    return {
      endpoint, roomId: typeof value.roomId === 'string' ? value.roomId : '',
      authMode: ['none', 'bearer', 'api-key'].includes(value.authMode) ? value.authMode : 'none',
      apiKeyHeader: typeof value.apiKeyHeader === 'string' && /^[A-Za-z][A-Za-z0-9-]{1,63}$/.test(value.apiKeyHeader) ? value.apiKeyHeader : 'X-API-Key',
      revision: typeof value.revision === 'string' ? value.revision : undefined,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : undefined,
    }
  } catch { return { endpoint: fallbackEndpoint, roomId: '', authMode: 'none', apiKeyHeader: 'X-API-Key' } }
}

function readRoomToken() { try { return sessionStorage.getItem(ROOM_TOKEN_KEY) ?? '' } catch { return '' } }

function csvCell(value: unknown) {
  const source = String(value ?? '')
  const safe = /^[=+\-@\t\r]/.test(source) ? `'${source}` : source
  return `"${safe.replaceAll('"', '""')}"`
}

async function fitDataUrl(source: string, width: number, height: number, background?: string, credit?: string) {
  const image = new window.Image()
  image.src = source
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Image render failed')) })
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable')
  if (background) { context.fillStyle = background; context.fillRect(0, 0, width, height) }
  const scale = Math.min(width / image.width, height / image.height) * .94
  const drawWidth = image.width * scale; const drawHeight = image.height * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  if (credit) { context.fillStyle = background === '#17211e' ? 'rgba(23,33,30,.88)' : 'rgba(255,255,255,.88)'; context.fillRect(0, height - 34, width, 34); context.fillStyle = background === '#17211e' ? '#d8e5df' : '#53665e'; context.font = '16px sans-serif'; context.textAlign = 'right'; context.fillText(credit.slice(0, 180), width - 18, height - 11) }
  return canvas.toDataURL('image/png')
}

function assetAttribution(nodes: BioNodeType[]) {
  const assets = Array.from(new Map(nodes.flatMap((node) => node.data.asset ? [[node.data.asset.id, node.data.asset] as const] : [])).values())
  const full = assets.map((asset) => `${asset.name} — ${asset.author} — ${asset.licenseSpdx}\nSource: ${asset.sourceUrl}\nLicense: ${asset.licenseUrl}`).join('\n\n')
  const compact = assets.length ? `Assets: ${assets.slice(0, 3).map((asset) => `${asset.name} © ${asset.author} (${asset.licenseSpdx})`).join('; ')}${assets.length > 3 ? `; +${assets.length - 3} more` : ''}` : ''
  return { full, compact }
}

function addSvgCredit(dataUrl: string, credit: string, width: number, height: number) {
  if (!credit) return dataUrl
  const comma = dataUrl.indexOf(','); if (comma < 0) return dataUrl
  const payload = dataUrl.slice(comma + 1)
  const svg = dataUrl.slice(0, comma).includes(';base64') ? new TextDecoder().decode(Uint8Array.from(atob(payload), (character) => character.charCodeAt(0))) : decodeURIComponent(payload)
  const escaped = credit.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const next = svg.replace('</svg>', `<rect x="0" y="${height - 32}" width="${width}" height="32" fill="rgba(255,255,255,.88)"/><text x="${width - 16}" y="${height - 10}" text-anchor="end" font-family="sans-serif" font-size="14" fill="#53665e">${escaped.slice(0, 180)}</text></svg>`)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(next)}`
}

function nodeSize(node: BioNodeType) {
  const width = typeof node.style?.width === 'number' ? node.style.width : Number.parseFloat(String(node.style?.width ?? 155)) || 155
  const height = typeof node.style?.height === 'number' ? node.style.height : Number.parseFloat(String(node.style?.height ?? 64)) || 64
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

function AppCanvas() {
  const autosavedScene = useMemo(readAutosavedScene, [])
  const initialTemplate = useMemo(() => cloneTemplate(autosavedScene?.templateId ?? DEFAULT_TEMPLATE_ID), [autosavedScene?.templateId])
  const [nodes, setNodes] = useState<BioNodeType[]>(() => autosavedScene?.nodes ?? initialTemplate.nodes)
  const [edges, setEdges] = useState<BioEdge[]>(() => autosavedScene?.edges ?? initialTemplate.edges)
  const [mode, setMode] = useState<ConstraintMode>(() => autosavedScene?.constraintMode ?? 'biological')
  const [templateId, setTemplateId] = useState<SceneTemplateId>(() => autosavedScene?.templateId ?? DEFAULT_TEMPLATE_ID)
  const [sceneTitle, setSceneTitle] = useState(() => autosavedScene?.title ?? initialTemplate.title)
  const [sceneCreatedAt, setSceneCreatedAt] = useState(() => autosavedScene?.createdAt ?? new Date().toISOString())
  const [mechanism, setMechanism] = useState<ParsedMechanism | undefined>(() => autosavedScene?.mechanism)
  const [review, setReview] = useState<ReviewMetadata>(() => autosavedScene?.review ?? { status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() })
  const [literature, setLiterature] = useState<LiteratureRecord[]>(() => autosavedScene?.literature ?? [])
  const [collaboration, setCollaboration] = useState<CollaborationState>(() => autosavedScene?.collaboration ?? emptyCollaboration())
  const [room, setRoom] = useState<RoomConfig>(readRoom)
  const [roomToken, setRoomToken] = useState(readRoomToken)
  const [signedInEmail, setSignedInEmail] = useState<string>()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [modules, setModules] = useState<TissueModule[]>(readModules)
  const [stylePreset, setStylePreset] = useState<StylePreset>(() => autosavedScene?.stylePreset ?? 'scientific-clean')
  const [visualizationProfile, setVisualizationProfile] = useState<VisualizationProfile>(() => autosavedScene?.visualizationProfile ?? { ...defaultVisualizationProfile })
  const [views, setViews] = useState<SceneView[]>(() => autosavedScene?.views ?? [])
  const [activeViewId, setActiveViewId] = useState<string | undefined>(() => autosavedScene?.activeViewId)
  const [moleculeLibrary, setMoleculeLibrary] = useState<MoleculeDefinition[]>(() => autosavedScene?.moleculeLibrary ?? [])
  const [customFunctions, setCustomFunctions] = useState<string[]>(() => autosavedScene?.customFunctions ?? [])
  const [workspace, setWorkspace] = useState<FigureWorkspace>(() => autosavedScene?.workspace ?? { ...defaultFigureWorkspace })
  const [showWorkspaceSetup, setShowWorkspaceSetup] = useState(false)
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('select')
  const [draftMembrane, setDraftMembrane] = useState<{ flow: MembranePoint[]; screen: MembranePoint[] }>()
  const [continuousTool, setContinuousTool] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [layersOpen, setLayersOpen] = useState(true)
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
  const [showNewFigure, setShowNewFigure] = useState(false)
  const [showMoleculeSetup, setShowMoleculeSetup] = useState(false)
  const [setupMoleculeId, setSetupMoleculeId] = useState<string>()
  const [isSyncing, setIsSyncing] = useState(false)
  const [enrichingLiteratureId, setEnrichingLiteratureId] = useState<string>()
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [alignmentNodeIds, setAlignmentNodeIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [notice, setNotice] = useState(autosavedScene ? 'Autosaved scene restored' : 'Untreated vs treated template loaded')
  const [isLayingOut, setIsLayingOut] = useState(false)
  const flowRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const instanceRef = useRef<ReactFlowInstance<BioNodeType, BioEdge> | undefined>(undefined)
  const undoStack = useRef<SceneFile[]>([])
  const redoStack = useRef<SceneFile[]>([])
  const lastHistoryScene = useRef<string | undefined>(undefined)
  const [historyVersion, setHistoryVersion] = useState(0)
  const editorClipboard = useRef<{ nodes: BioNodeType[]; edges: BioEdge[] } | undefined>(undefined)

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
  const targetPanel = selectedNode?.data.panelId ?? (nodes.some((node) => node.data.panelId === 'treated') ? 'treated' : 'single')
  const documentNodes = useMemo(() => nodes.map((node) => ({ ...node, selected: undefined })), [nodes])
  const documentEdges = useMemo(() => edges.map((edge) => ({ ...edge, selected: undefined })), [edges])
  const currentScene = useMemo<SceneFile>(() => ({
    schema: 'bioscene.scene.v0.13', title: sceneTitle, templateId, createdAt: sceneCreatedAt,
    constraintMode: mode, nodes: documentNodes, edges: documentEdges, mechanism, stylePreset, review, literature, collaboration,
    visualizationProfile, views, activeViewId, moleculeLibrary, customFunctions, workspace,
  }), [activeViewId, collaboration, customFunctions, documentEdges, documentNodes, literature, mechanism, mode, moleculeLibrary, review, sceneCreatedAt, sceneTitle, stylePreset, templateId, views, visualizationProfile, workspace])

  useEffect(() => {
    setAutosaveStatus('saving')
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(currentScene)); setAutosaveStatus('saved') } catch { setNotice('Autosave stopped: storage is full. Save JSON now.') }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [currentScene])

  useEffect(() => { try { localStorage.setItem(REVISION_KEY, JSON.stringify(revisions.slice(0, 5))) } catch { setNotice('Revision storage is full. Export JSON before continuing.') } }, [revisions])
  useEffect(() => { try { localStorage.setItem(MODULE_KEY, JSON.stringify(modules.slice(0, 30))) } catch { setNotice('Module storage is full. Remove old modules.') } }, [modules])
  useEffect(() => { try { localStorage.setItem(ROOM_KEY, JSON.stringify({ ...room, endpoint: room.endpoint ? sanitizedEndpoint(room.endpoint) : '' })) } catch { /* incomplete or unsafe endpoints are intentionally not persisted */ } }, [room])
  useEffect(() => { try { if (roomToken) sessionStorage.setItem(ROOM_TOKEN_KEY, roomToken); else sessionStorage.removeItem(ROOM_TOKEN_KEY) } catch { /* session-only credentials are optional */ } }, [roomToken])
  useEffect(() => watchSupabaseSession((session) => {
    setSignedInEmail(session?.user.email)
    if (session?.access_token) {
      setRoomToken(session.access_token)
      setRoom((value) => ({ ...value, endpoint: value.endpoint || supabaseApiEndpoint, authMode: 'bearer' }))
    } else if (room.endpoint === supabaseApiEndpoint) setRoomToken('')
  }), [room.endpoint])

  const signIn = useCallback(async (email: string) => {
    setIsAuthenticating(true)
    try { await sendMagicLink(email); setNotice(`Sign-in link sent to ${email.trim().toLowerCase()}`) }
    catch (error) { setNotice(`Sign-in failed: ${error instanceof Error ? error.message : 'unknown error'}`) }
    finally { setIsAuthenticating(false) }
  }, [])

  const signOut = useCallback(async () => {
    setIsAuthenticating(true)
    try { await signOutSupabase(); setSignedInEmail(undefined); setRoomToken(''); setNotice('Signed out') }
    catch (error) { setNotice(`Sign-out failed: ${error instanceof Error ? error.message : 'unknown error'}`) }
    finally { setIsAuthenticating(false) }
  }, [])

  const applySceneState = useCallback((scene: SceneFile) => {
    setNodes(scene.nodes); setEdges(scene.edges); setMode(scene.constraintMode); setTemplateId(scene.templateId ?? DEFAULT_TEMPLATE_ID); setSceneTitle(scene.title); setSceneCreatedAt(scene.createdAt); setMechanism(scene.mechanism); setStylePreset(scene.stylePreset); setReview(scene.review); setLiterature(scene.literature); setCollaboration(scene.collaboration); setVisualizationProfile(scene.visualizationProfile); setViews(scene.views); setActiveViewId(scene.activeViewId); setMoleculeLibrary(scene.moleculeLibrary); setCustomFunctions(scene.customFunctions); setWorkspace(scene.workspace); setDrawingTool('select'); setSelectedNodeId(undefined); setSelectedEdgeId(undefined)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: .1, duration: 350 }))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const serialized = JSON.stringify(currentScene)
      if (!lastHistoryScene.current) { lastHistoryScene.current = serialized; return }
      if (lastHistoryScene.current === serialized) return
      const previous = parseSceneFile(JSON.parse(lastHistoryScene.current))
      if (previous) undoStack.current = [...undoStack.current, previous].slice(-50)
      redoStack.current = []; lastHistoryScene.current = serialized; setHistoryVersion((value) => value + 1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [currentScene])

  const undo = useCallback(() => {
    const scene = undoStack.current.pop(); if (!scene) return
    redoStack.current.push(currentScene); lastHistoryScene.current = JSON.stringify(scene); applySceneState(scene); setHistoryVersion((value) => value + 1); setNotice('Undo applied')
  }, [applySceneState, currentScene])
  const redo = useCallback(() => {
    const scene = redoStack.current.pop(); if (!scene) return
    undoStack.current.push(currentScene); lastHistoryScene.current = JSON.stringify(scene); applySceneState(scene); setHistoryVersion((value) => value + 1); setNotice('Redo applied')
  }, [applySceneState, currentScene])
  const onNodesChange = useCallback((changes: NodeChange<BioNodeType>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange<BioEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current))
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    const source = nodes.find((node) => node.id === connection.source)
    const target = nodes.find((node) => node.id === connection.target)
    const sourcePort = source?.data.ports.find((port) => port.id === connection.sourceHandle)
    const interaction = inferInteraction(sourcePort, source?.data.kind)
    const connectionError = validateConnection(source, target, connection.sourceHandle, connection.targetHandle, interaction)
    if (mode === 'biological' && connectionError) {
      setNotice(`Biological constraint: ${connectionError}`)
      return
    }
    setEdges((current) => addEdge({
      ...connection,
      id: uid('edge'),
      type: 'interaction',
      data: { interaction, evidence: { status: 'needs-review', citation: '' } },
      markerEnd: markerForInteraction(interaction),
    }, current))
    setNotice(`${interaction} interaction created`)
  }, [mode, nodes])

  const selectObject = useCallback((id: string, kind: 'node' | 'edge' = 'node', additive = false) => {
    setContextTarget(undefined)
    if (kind === 'edge') {
      setSelectedEdgeId(id); setSelectedNodeId(undefined); setAlignmentNodeIds([id])
      setEdges((items) => items.map((edge) => ({ ...edge, selected: edge.id === id })))
      setNodes((items) => items.map((node) => ({ ...node, selected: false })))
      return
    }
    setSelectedNodeId(id); setSelectedEdgeId(undefined)
    setAlignmentNodeIds((current) => additive ? (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) : [id])
    setNodes((items) => items.map((node) => ({ ...node, selected: additive ? (node.id === id ? !node.selected : node.selected) : node.id === id })))
    setEdges((items) => items.map((edge) => ({ ...edge, selected: false })))
  }, [])

  const placeNodeAt = useCallback((kind: 'receptor' | 'antibody' | 'ligand', position: { x: number; y: number }) => {
    const id = uid(kind)
    const node: BioNodeType = { id, type: 'bio', position, selected: true, data: createBioData(kind, defaultLabels[kind], { panelId: 'single', visibility: 'visible', positionMode: 'manual' }) }
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node]); selectObject(id); setNotice(`${defaultLabels[kind]} created. Drag to move; double-click to edit.`)
    if (!continuousTool) setDrawingTool('select')
  }, [continuousTool, selectObject])

  const placeCellAt = useCallback((position: { x: number; y: number }) => {
    const id = uid('cell')
    const node: BioNodeType = { id, type: 'cell', position, selected: true, style: { width: 540, height: 380 }, data: createBioData('cell', 'Cell', { panelId: 'single', visibility: 'visible', positionMode: 'manual', sceneType: 'full_signaling' }) }
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node]); selectObject(id); setNotice('Cell created. Resize it with the selection handles.')
    if (!continuousTool) setDrawingTool('select')
  }, [continuousTool, selectObject])

  const placeCalloutAt = useCallback((position: { x: number; y: number }) => {
    const id = uid('callout')
    const node: BioNodeType = { id, type: 'annotation', position, selected: true, style: { width: 230, height: 100 }, data: createBioData('annotation', 'Key finding', { panelId: 'single', visibility: 'visible', positionMode: 'manual' }) }
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node]); selectObject(id); setNotice('Text callout created. Type its content in the Inspector.')
    if (!continuousTool) setDrawingTool('select')
  }, [continuousTool, selectObject])

  const addBiologicalNode = useCallback((kind: Exclude<BioKind, 'cell' | 'annotation' | 'membrane'>) => {
    const defaults = semanticDefaults[kind]
    const label = defaultLabels[kind]
    const targetCell = selectedNode?.data.kind === 'cell'
      ? selectedNode
      : nodes.find((item) => item.id === selectedNode?.parentId)
        ?? nodes.find((item) => item.data.panelId === 'treated' && item.data.kind === 'cell')
        ?? nodes.find((item) => item.data.kind === 'cell')
    const node: BioNodeType = {
      id: uid(kind),
      type: 'bio',
      ...(targetCell ? { parentId: targetCell.id, extent: 'parent' as const } : {}),
      position: findAvailablePosition(nodes, defaults.compartment, targetCell?.id), selected: true,
      data: createBioData(kind, label, { panelId: targetCell?.data.panelId ?? 'single', visibility: 'visible', positionMode: 'auto' }),
    }
    setNodes((current) => [...current.map((item) => ({ ...item, selected: false })), node])
    setSelectedNodeId(node.id)
    setSelectedEdgeId(undefined)
    setNotice(`${label} added to ${targetCell?.data.panelId ?? 'free canvas'} · ${defaults.compartment}`)
  }, [nodes, selectedNode])

  const addCallout = useCallback(() => {
    const targetCell = selectedNode?.data.kind === 'cell' ? selectedNode : nodes.find((item) => item.id === selectedNode?.parentId) ?? nodes.find((item) => item.data.kind === 'cell')
    const node: BioNodeType = { id: uid('callout'), type: 'annotation', selected: true, ...(targetCell ? { parentId: targetCell.id, extent: 'parent' as const } : {}), position: targetCell ? { x: 56, y: 420 } : { x: 320, y: 180 }, data: createBioData('annotation', 'Key finding', { panelId: targetCell?.data.panelId ?? 'single', visibility: 'visible', positionMode: 'auto' }) }
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node]); setSelectedNodeId(node.id); setAlignmentNodeIds([node.id]); setNotice('Scientific callout added')
  }, [nodes, selectedNode])

  const updateSelectedNode = useCallback((patch: BioNodePatch) => {
    if (!selectedNode) return
    if (patch.compartment && mode === 'biological' && !selectedNode.data.allowedCompartments.includes(patch.compartment)) {
      setNotice(`Biological constraint: ${selectedNode.data.kind} cannot enter ${patch.compartment}`)
      return
    }
    const normalized = { ...patch }
    if (patch.state && mode === 'biological') {
      const nextState = selectedNode.data.states.find((state) => state.id === patch.state)
      if (nextState && !nextState.allowedCompartments.includes(selectedNode.data.compartment)) {
        normalized.compartment = nextState.allowedCompartments[0]
        setNotice(`${nextState.label} state moved ${selectedNode.data.label} to ${normalized.compartment}`)
      }
    }
    setNodes((current) => {
      let changedMembrane: BioNodeType | undefined
      const nextItems = current.map((node) => {
      if (node.id !== selectedNodeId) return node
      const next = { ...node, hidden: normalized.visibility ? normalized.visibility !== 'visible' : node.hidden, data: { ...node.data, ...normalized } }
      const result = (normalized.compartment || normalized.state) && mode === 'biological' ? constrainNode(next, mode, current) : next
      if (result.data.kind === 'membrane') changedMembrane = result
      return result
      })
      return changedMembrane ? repositionMembraneAnchors(nextItems, changedMembrane) : nextItems
    })
  }, [mode, selectedNode, selectedNodeId])

  const attachAsset = useCallback((asset: AssetReference) => {
    if (!selectedNodeId) return
    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, asset } } : node))
    setShowAssetBrowser(false)
    setNotice(`${asset.name} bound to semantic object`)
  }, [selectedNodeId])

  const detachAsset = useCallback(() => {
    if (!selectedNodeId) return
    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, asset: undefined } } : node))
    setNotice('Visual asset detached; semantic object preserved')
  }, [selectedNodeId])

  const openMoleculeBuilder = useCallback((node?: BioNodeType) => {
    const target = node ?? selectedNode
    if (target && !['cell','annotation','signal','transcription'].includes(target.data.kind)) {
      const existing = moleculeLibrary.find((item) => item.id === target.data.moleculeId || item.name.toLowerCase() === target.data.label.toLowerCase())
      if (existing) setSetupMoleculeId(existing.id)
      else {
        const created = { ...createMolecule(target.data.label, target.data.kind === 'antibody' && /slc|custom|bispecific/i.test(target.data.label) ? 'private' : 'public'), geneName: target.data.target }
        setMoleculeLibrary((items) => [...items, created]); setSetupMoleculeId(created.id)
      }
    } else setSetupMoleculeId(undefined)
    setShowMoleculeSetup(true)
  }, [moleculeLibrary, selectedNode])

  const applyMoleculeStructure = useCallback((molecule: MoleculeDefinition) => {
    if (!selectedNodeId) return
    const functionalPorts = portsFromDomains(molecule)
    setNodes((items) => items.map((node) => {
      if (node.id === selectedNodeId) return applyMoleculeToNode(node, molecule)
      const matching = functionalPorts.filter((port) => port.targetHint && [node.data.label,node.data.target].filter(Boolean).some((value) => String(value).toLowerCase().replace(/[^a-z0-9]/g,'') === port.targetHint!.toLowerCase().replace(/[^a-z0-9]/g,'')))
      if (!matching.length) return node
      const counterpartPorts = matching.map((port) => ({ ...port, id: `port:${node.id}:${port.id.split(':').at(-2)}:target`, role: 'target' as const, side: port.side === 'left' ? 'right' as const : 'left' as const, domainId: node.data.structuralModel?.domains.find((domain) => domain.kind === 'extracellular')?.id ?? node.data.domains[0]?.id, targetHint: molecule.name }))
      const existing = new Set(node.data.ports.map((port) => port.id))
      return { ...node, data: { ...node.data, ports: [...node.data.ports, ...counterpartPorts.filter((port) => !existing.has(port.id))] } }
    }))
    setNotice(`${molecule.name} structure and functional ports applied`)
    setShowMoleculeSetup(false)
  }, [selectedNodeId])

  const addMoleculeToScene = useCallback((molecule: MoleculeDefinition) => {
    const kind: 'receptor' | 'antibody' | 'ligand' = molecule.moleculeClass === 'antibody' ? 'antibody' : molecule.structuralModel.topology.transmembrane ? 'receptor' : 'ligand'
    const id = uid(kind)
    const base: BioNodeType = { id, type:'bio', selected:true, position:findAvailablePosition(nodes,kind === 'receptor' ? 'membrane' : 'extracellular'), data:createBioData(kind,molecule.name,{panelId:'single',visibility:'visible',positionMode:'auto'}) }
    let node = applyMoleculeToNode(base,molecule)
    const membrane = kind === 'receptor' ? nodes.find((item)=>item.data.kind === 'membrane' && item.data.membrane) : undefined
    if (membrane) {
      const target = anchoredPosition(membrane,.5)
      if (target) node = { ...node, position:{x:target.x-77.5,y:target.y-32}, data:{...node.data,compartment:'membrane',membraneAnchor:{membraneId:membrane.id,pathPosition:.5,orientation:'normal',angle:target.angle}} }
    }
    setNodes((items)=>[...items.map((item)=>item.id === membrane?.id && item.data.membrane ? {...item,selected:false,data:{...item.data,membrane:{...item.data.membrane,anchors:[...item.data.membrane.anchors.filter((record)=>record.objectId!==id),{objectId:id,pathPosition:.5,orientation:'normal' as const}]}}}:{...item,selected:false}),node])
    setSelectedNodeId(id); setAlignmentNodeIds([id]); setSelectedEdgeId(undefined); setShowMoleculeSetup(false); setNotice(`${molecule.name} structural instance added${membrane?' and anchored to membrane':''}`)
  },[nodes])

  const updateSelectedEdge = useCallback((interaction: InteractionType) => {
    const edge = edges.find((item) => item.id === selectedEdgeId)
    const source = nodes.find((node) => node.id === edge?.source)
    const target = nodes.find((node) => node.id === edge?.target)
    const connectionError = validateConnection(source, target, edge?.sourceHandle, edge?.targetHandle, interaction)
    if (mode === 'biological' && connectionError) {
      setNotice(`Biological constraint: ${connectionError}`)
      return
    }
    setEdges((current) => current.map((edge) => edge.id === selectedEdgeId ? {
      ...edge,
      data: { interaction, note: edge.data?.note, evidence: edge.data?.evidence },
      markerEnd: markerForInteraction(interaction),
    } : edge))
  }, [edges, mode, nodes, selectedEdgeId])

  const updateSelectedEdgeData = useCallback((patch: Partial<InteractionData>) => {
    setEdges((items) => items.map((edge) => edge.id === selectedEdgeId ? { ...edge, data: { ...(edge.data ?? { interaction: 'BIND' }), ...patch } } : edge))
  }, [selectedEdgeId])

  const deleteSelected = useCallback(() => {
    const nodeIds = new Set(alignmentNodeIds.filter((id) => nodes.some((node) => node.id === id)))
    if (selectedNodeId) nodeIds.add(selectedNodeId)
    if (nodeIds.size) {
      const selectedItems = nodes.filter((node) => nodeIds.has(node.id))
      const selectedMembranes = selectedItems.filter((node) => node.data.kind === 'membrane')
      let deleteAnchored = false
      for (const membraneNode of selectedMembranes) {
        const anchored = nodes.filter((node) => node.data.membraneAnchor?.membraneId === membraneNode.id)
        if (anchored.length) {
          const choice = window.prompt(`This membrane has ${anchored.length} anchored object(s).\nDETACH = 막만 삭제하고 개체 보존\nALL = 막과 고정 개체 모두 삭제\nCANCEL = 취소`, 'DETACH')?.trim().toUpperCase()
          if (!choice || choice === 'CANCEL') return
          if (choice !== 'DETACH' && choice !== 'ALL') { setNotice('Delete cancelled: enter DETACH, ALL, or CANCEL.'); return }
          deleteAnchored = choice === 'ALL'
          if (deleteAnchored) anchored.forEach((node) => nodeIds.add(node.id))
        }
      }
      for (const cell of selectedItems.filter((node) => node.data.kind === 'cell')) nodes.filter((node) => node.parentId === cell.id).forEach((node) => nodeIds.add(node.id))
      setNodes((current) => current.filter((node) => !nodeIds.has(node.id)).map((node) => selectedMembranes.some((membrane) => node.data.membraneAnchor?.membraneId === membrane.id) ? { ...node, data: { ...node.data, membraneAnchor: undefined } } : node))
      setEdges((current) => current.filter((edge) => !nodeIds.has(edge.source) && !nodeIds.has(edge.target)))
      setNotice(`${nodeIds.size} object(s) deleted`)
    } else if (selectedEdgeId) {
      setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId)); setNotice('Interaction deleted')
    }
    setSelectedNodeId(undefined); setSelectedEdgeId(undefined); setAlignmentNodeIds([]); setContextTarget(undefined)
  }, [alignmentNodeIds, nodes, selectedEdgeId, selectedNodeId])

  const copySelected = useCallback(() => {
    const ids = new Set(alignmentNodeIds.filter((id) => nodes.some((node) => node.id === id)))
    if (selectedNodeId) ids.add(selectedNodeId)
    if (!ids.size) return
    const copiedNodes = nodes.filter((node) => ids.has(node.id))
    const copiedEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    editorClipboard.current = { nodes: structuredClone(copiedNodes), edges: structuredClone(copiedEdges) }
    setNotice(`${copiedNodes.length} object(s) copied`)
  }, [alignmentNodeIds, edges, nodes, selectedNodeId])

  const pasteObjects = useCallback(() => {
    const copied = editorClipboard.current
    if (!copied?.nodes.length) return
    const map = new Map(copied.nodes.map((node) => [node.id, uid(node.data.kind)]))
    const nextNodes = copied.nodes.map((node) => {
      const id = map.get(node.id)!
      const membrane = node.data.membrane ? { ...structuredClone(node.data.membrane), id, anchors: [] } : undefined
      const anchor = node.data.membraneAnchor && map.has(node.data.membraneAnchor.membraneId) ? { ...node.data.membraneAnchor, membraneId: map.get(node.data.membraneAnchor.membraneId)! } : undefined
      return { ...structuredClone(node), id, parentId: node.parentId ? map.get(node.parentId) : undefined, position: { x: node.position.x + 32, y: node.position.y + 32 }, selected: true, data: { ...structuredClone(node.data), membrane, membraneAnchor: anchor } }
    })
    const nextEdges = copied.edges.map((edge) => ({ ...structuredClone(edge), id: uid('edge'), source: map.get(edge.source)!, target: map.get(edge.target)!, selected: false }))
    setNodes((items) => [...items.map((node) => ({ ...node, selected: false })), ...nextNodes]); setEdges((items) => [...items, ...nextEdges])
    const ids = nextNodes.map((node) => node.id); setAlignmentNodeIds(ids); setSelectedNodeId(ids[0]); setSelectedEdgeId(undefined); setNotice(`${ids.length} object(s) pasted`)
  }, [])

  const duplicateSelected = useCallback(() => { copySelected(); queueMicrotask(pasteObjects) }, [copySelected, pasteObjects])

  const toggleObjectVisibility = useCallback((id: string) => setNodes((items) => items.map((node) => node.id === id ? { ...node, hidden: !node.hidden, data: { ...node.data, visibility: node.hidden ? 'visible' : 'manually_hidden' } } : node)), [])
  const toggleObjectLock = useCallback((id: string) => setNodes((items) => items.map((node) => node.id === id ? { ...node, draggable: !!node.data.locked, data: { ...node.data, locked: !node.data.locked, positionMode: node.data.locked ? 'manual' : 'pinned' } } : node)), [])

  const membraneAction = useCallback((id: string, actionName: string, detail: Record<string, unknown> = {}) => {
    const membraneNode = nodes.find((node) => node.id === id && node.data.membrane)
    if (!membraneNode?.data.membrane) return
    if (actionName === 'edit') { selectObject(id); setNotice('Path edit: drag points, Alt+click a point to delete, double-click the line to add a point.'); return }
    if (actionName === 'flip') { setNodes((items) => items.map((node) => node.id === id ? { ...node, data: { ...node.data, membrane: { ...node.data.membrane!, sideA: node.data.membrane!.sideB, sideB: node.data.membrane!.sideA } } } : node)); setNotice('Membrane inside/outside flipped'); return }
    if (actionName === 'move-point' || actionName === 'add-point' || actionName === 'remove-point' || actionName === 'straighten') {
      let path = [...membraneNode.data.membrane.path]
      if (actionName === 'move-point') path[Number(detail.index)] = detail.point as MembranePoint
      if (actionName === 'remove-point' && path.length > 2) path.splice(Number(detail.index), 1)
      if (actionName === 'add-point') {
        const point = detail.point as MembranePoint; let index = 1; let distance = Infinity
        for (let i = 0; i < path.length - 1; i++) { const mid = { x: (path[i].x + path[i + 1].x) / 2, y: (path[i].y + path[i + 1].y) / 2 }; const next = Math.hypot(point.x - mid.x, point.y - mid.y); if (next < distance) { distance = next; index = i + 1 } }
        path.splice(index, 0, point)
      }
      if (actionName === 'straighten') path = [path[0], path.at(-1)!]
      setNodes((items) => {
        const changed = items.map((node) => node.id === id ? { ...node, data: { ...node.data, membrane: { ...node.data.membrane!, path } } } : node)
        const nextMembrane = changed.find((node) => node.id === id)!
        return repositionMembraneAnchors(changed, nextMembrane)
      })
    }
  }, [nodes, selectObject])

  const deleteObjectById = useCallback((id: string) => {
    const target = nodes.find((node) => node.id === id)
    if (!target) return
    const ids = new Set([id])
    if (target.data.kind === 'cell') nodes.filter((node) => node.parentId === id).forEach((node) => ids.add(node.id))
    if (target.data.kind === 'membrane') {
      const anchored = nodes.filter((node) => node.data.membraneAnchor?.membraneId === id)
      if (anchored.length) {
        const choice = window.prompt(`This membrane has ${anchored.length} anchored object(s).\nDETACH = 막만 삭제하고 개체 보존\nALL = 모두 삭제\nCANCEL = 취소`, 'DETACH')?.trim().toUpperCase()
        if (!choice || choice === 'CANCEL') return
        if (choice === 'ALL') anchored.forEach((node) => ids.add(node.id))
        else if (choice !== 'DETACH') return
      }
    }
    setNodes((items) => items.filter((node) => !ids.has(node.id)).map((node) => node.data.membraneAnchor?.membraneId === id ? { ...node, data: { ...node.data, membraneAnchor: undefined } } : node))
    setEdges((items) => items.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)))
    setSelectedNodeId(undefined); setSelectedEdgeId(undefined); setAlignmentNodeIds([]); setNotice(`${target.data.label} deleted`)
  }, [nodes])

  const duplicateObjectById = useCallback((id: string) => {
    const source = nodes.find((node) => node.id === id)
    if (!source) return
    const nextId = uid(source.data.kind)
    const membrane = source.data.membrane ? { ...structuredClone(source.data.membrane), id: nextId, anchors: [] } : undefined
    const clone: BioNodeType = { ...structuredClone(source), id: nextId, parentId: source.parentId, position: { x: source.position.x + 32, y: source.position.y + 32 }, selected: true, data: { ...structuredClone(source.data), membrane, membraneAnchor: undefined } }
    setNodes((items) => [...items.map((node) => ({ ...node, selected: false })), clone]); setSelectedNodeId(nextId); setSelectedEdgeId(undefined); setAlignmentNodeIds([nextId]); setNotice(`${source.data.label} duplicated`)
  }, [nodes])

  const splitMembrane = useCallback((id: string) => {
    const source = nodes.find((node) => node.id === id && node.data.membrane)
    if (!source?.data.membrane || source.data.membrane.path.length < 3) { setNotice('Split requires a membrane with at least three path points.'); return }
    const middle = Math.floor(source.data.membrane.path.length / 2); const secondId = uid('membrane')
    const firstPath = source.data.membrane.path.slice(0, middle + 1); const secondPath = source.data.membrane.path.slice(middle)
    const firstAnchors = source.data.membrane.anchors.filter((anchor) => anchor.pathPosition <= .5).map((anchor) => ({ ...anchor, pathPosition: anchor.pathPosition * 2 }))
    const secondAnchors = source.data.membrane.anchors.filter((anchor) => anchor.pathPosition > .5).map((anchor) => ({ ...anchor, pathPosition: (anchor.pathPosition - .5) * 2 }))
    const first = { ...source, data: { ...source.data, membrane: { ...source.data.membrane, path: firstPath, anchors: firstAnchors } } }
    const second: BioNodeType = { ...structuredClone(source), id: secondId, position: { x: source.position.x + 12, y: source.position.y + 12 }, selected: true, data: { ...structuredClone(source.data), label: `${source.data.label} 2`, membrane: { ...structuredClone(source.data.membrane), id: secondId, name: `${source.data.membrane.name} 2`, path: secondPath, anchors: secondAnchors } } }
    setNodes((items) => {
      const changed = items.map((node) => {
        if (node.id === id) return first
        const anchor = node.data.membraneAnchor
        if (!anchor || anchor.membraneId !== id) return { ...node, selected: false }
        return anchor.pathPosition <= .5 ? { ...node, data: { ...node.data, membraneAnchor: { ...anchor, pathPosition: anchor.pathPosition * 2 } } } : { ...node, data: { ...node.data, membraneAnchor: { ...anchor, membraneId: secondId, pathPosition: (anchor.pathPosition - .5) * 2 } } }
      })
      return repositionMembraneAnchors(repositionMembraneAnchors([...changed, second], first), second)
    })
    setSelectedNodeId(secondId); setAlignmentNodeIds([secondId]); setNotice('Membrane split into two editable objects')
  }, [nodes])

  const handleObjectAction = useCallback((id: string, actionName: string, detail: Record<string, unknown> = {}) => {
    const node = nodes.find((item) => item.id === id)
    if (!node) return
    if (['move-point','add-point','remove-point','straighten','flip'].includes(actionName)) { membraneAction(id, actionName, detail); return }
    if (actionName === 'split') { splitMembrane(id); return }
    if (actionName === 'delete') { deleteObjectById(id); return }
    if (actionName === 'duplicate') { duplicateObjectById(id); return }
    if (actionName === 'lock') { toggleObjectLock(id); return }
    if (actionName === 'hide') { toggleObjectVisibility(id); setContextTarget(undefined); return }
    if (actionName === 'front' || actionName === 'back') { setNodes((items) => items.map((item) => item.id === id ? { ...item, zIndex: actionName === 'front' ? 100 : -1 } : item)); setContextTarget(undefined); return }
    selectObject(id)
    if (actionName === 'asset') setShowAssetBrowser(true)
    else if (actionName === 'edit' && node.data.kind === 'membrane') membraneAction(id, 'edit')
    else if (actionName === 'edit') openMoleculeBuilder(node)
    setContextTarget(undefined)
  }, [deleteObjectById, duplicateObjectById, membraneAction, nodes, openMoleculeBuilder, selectObject, splitMembrane, toggleObjectLock, toggleObjectVisibility])

  const handleContextAction = useCallback((actionName: string) => {
    if (!contextTarget) return
    if (contextTarget.kind === 'edge') {
      const edge = edges.find((item) => item.id === contextTarget.id)
      if (actionName === 'delete') setEdges((items) => items.filter((item) => item.id !== contextTarget.id))
      else if (actionName === 'duplicate' && edge) setEdges((items) => [...items, { ...structuredClone(edge), id: uid('edge'), selected: false }])
      else selectObject(contextTarget.id, 'edge')
      setContextTarget(undefined); return
    }
    handleObjectAction(contextTarget.id, actionName)
  }, [contextTarget, edges, handleObjectAction, selectObject])

  useEffect(() => {
    const objectAction = (event: Event) => { const detail = (event as CustomEvent<{ id: string; action: string } & Record<string, unknown>>).detail; handleObjectAction(detail.id, detail.action, detail) }
    window.addEventListener('bioscene:object-action', objectAction)
    return () => window.removeEventListener('bioscene:object-action', objectAction)
  }, [handleObjectAction])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = !!target?.closest('input,textarea,select,[contenteditable="true"]')
      if (event.key === 'Escape') { setDraftMembrane(undefined); setDrawingTool('select'); setContextTarget(undefined); setNotice('Select mode'); return }
      if (typing) return
      const key = event.key.toLowerCase(); const command = event.ctrlKey || event.metaKey
      if (command && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (command && key === 'y') { event.preventDefault(); redo(); return }
      if (command && key === 'c') { event.preventDefault(); copySelected(); return }
      if (command && key === 'v') { event.preventDefault(); pasteObjects(); return }
      if (command && key === 'd') { event.preventDefault(); duplicateSelected(); return }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); return }
      const shortcuts: Partial<Record<string, DrawingTool>> = { v: 'select', h: 'pan', m: 'freehand_membrane', c: 'place_cell', p: 'place_receptor', a: 'place_antibody', l: 'place_ligand', t: 'place_annotation' }
      if (shortcuts[key]) { event.preventDefault(); setDrawingTool(shortcuts[key]!); setNotice(`${shortcuts[key]!.replaceAll('_', ' ')} mode`) }
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [copySelected, deleteSelected, duplicateSelected, pasteObjects, redo, undo])

  const changeVisualizationProfile = useCallback((profile: VisualizationProfile) => {
    const scoped = applyVisualizationProfile(nodes, edges, profile)
    setVisualizationProfile(profile)
    setNodes(scoped.nodes)
    setEdges(scoped.edges)
    setActiveViewId(undefined)
    setNotice(`${sceneTypeLabels[profile.sceneType]} · detail ${profile.detailLevel}`)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: .12, duration: 350 }))
  }, [edges, nodes])

  const saveCurrentView = useCallback(() => {
    const name = window.prompt('저장할 뷰 이름을 입력하세요.', `${sceneTypeLabels[visualizationProfile.sceneType]} view`)
    if (!name?.trim()) return
    const view = captureView(uid('view'), name.trim(), visualizationProfile, nodes)
    setViews((items) => [...items, view])
    setActiveViewId(view.id)
    setNotice(`${view.name} view saved`)
  }, [nodes, visualizationProfile])

  const openSavedView = useCallback((view: SceneView) => {
    const restored = restoreView(view, nodes, edges)
    setVisualizationProfile(view.profile)
    setNodes(restored.nodes)
    setEdges(restored.edges)
    setActiveViewId(view.id)
    setNotice(`${view.name} view restored`)
    setShowSceneSettings(false)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: .12, duration: 400 }))
  }, [edges, nodes])

  const createEmptyFigure = useCallback(() => {
    if ((nodes.length || literature.length || review.notes || collaboration.comments.length) && !window.confirm('새 빈 장면을 만들까요? 현재 장면은 자동 저장 기록에서 교체됩니다. 먼저 Save JSON을 권장합니다.')) return
    const profile = { ...visualizationProfile, sceneType: 'empty' as const, layoutMode: 'single' as const }
    setNodes([]); setEdges([]); setVisualizationProfile(profile); setViews([]); setActiveViewId(undefined); setTemplateId(DEFAULT_TEMPLATE_ID); setSceneTitle('Untitled biological figure'); setSceneCreatedAt(new Date().toISOString()); setMechanism(undefined); setReview({ status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() }); setLiterature([]); setCollaboration(emptyCollaboration()); setWorkspace({ ...defaultFigureWorkspace }); setDrawingTool('select'); setSelectedNodeId(undefined); setSelectedEdgeId(undefined); setShowNewFigure(false); setShowWorkspaceSetup(true); setNotice('Choose a figure workspace to begin')
  }, [collaboration.comments.length, literature.length, nodes.length, review.notes, visualizationProfile])

  const handleNodeDragStop = useCallback((node: BioNodeType) => {
    setNodes((current) => {
      const dragged = { ...constrainNode(node, mode, current), data: { ...node.data, positionMode: 'manual' as const } }
      if (dragged.data.kind === 'membrane') {
        const next = current.map((item) => item.id === dragged.id ? dragged : item)
        return repositionMembraneAnchors(next, dragged)
      }
      if (dragged.data.kind !== 'receptor' || dragged.parentId) return current.map((item) => item.id === dragged.id ? dragged : item)
      const size = nodeSize(dragged)
      const center = { x: dragged.position.x + size.width / 2, y: dragged.position.y + size.height / 2 }
      let best: { membrane: BioNodeType; distance: number; pathPosition: number; angle: number; x: number; y: number } | undefined
      for (const membraneNode of current.filter((item) => item.data.kind === 'membrane' && item.data.membrane)) {
        const localQuery = { x: center.x - membraneNode.position.x, y: center.y - membraneNode.position.y }
        const nearest = nearestPathPoint(membraneNode.data.membrane!.path, localQuery)
        if (!best || nearest.distance < best.distance) best = { membrane: membraneNode, distance: nearest.distance, pathPosition: nearest.pathPosition, angle: nearest.angle, x: membraneNode.position.x + nearest.point.x, y: membraneNode.position.y + nearest.point.y }
      }
      if (!best || best.distance > 70) return current.map((item) => {
        if (item.id === dragged.id) return { ...dragged, data: { ...dragged.data, membraneAnchor: undefined } }
        if (item.data.kind === 'membrane' && item.data.membrane?.anchors.some((anchor) => anchor.objectId === dragged.id)) return { ...item, data: { ...item.data, membrane: { ...item.data.membrane, anchors: item.data.membrane.anchors.filter((anchor) => anchor.objectId !== dragged.id) } } }
        return item
      })
      const anchor = { membraneId: best.membrane.id, pathPosition: best.pathPosition, orientation: 'normal' as const, angle: best.angle }
      const nextMembraneData: MembraneDefinition = {
        ...best.membrane.data.membrane!,
        anchors: [...best.membrane.data.membrane!.anchors.filter((item) => item.objectId !== dragged.id), { objectId: dragged.id, pathPosition: best.pathPosition, orientation: 'normal' }],
      }
      setNotice(`${dragged.data.label} snapped to ${best.membrane.data.label}`)
      return current.map((item) => item.id === dragged.id
        ? { ...dragged, position: { x: best!.x - size.width / 2, y: best!.y - size.height / 2 }, data: { ...dragged.data, compartment: 'membrane', membraneAnchor: anchor } }
        : item.id === best!.membrane.id ? { ...item, data: { ...item.data, membrane: nextMembraneData } }
        : item.data.kind === 'membrane' && item.data.membrane?.anchors.some((record) => record.objectId === dragged.id) ? { ...item, data: { ...item.data, membrane: { ...item.data.membrane, anchors: item.data.membrane.anchors.filter((record) => record.objectId !== dragged.id) } } } : item)
    })
  }, [mode])

  const fitWorkspace = useCallback(() => {
    instanceRef.current?.fitBounds({ x: 0, y: 0, width: workspace.width, height: workspace.height }, { padding: .04, duration: 400 })
  }, [workspace.height, workspace.width])

  const saveWorkspace = useCallback((next: FigureWorkspace) => {
    setWorkspace(next); setShowWorkspaceSetup(false); setNotice(`Workspace ${Math.round(next.width)} × ${Math.round(next.height)} ${next.unit} ready`)
    requestAnimationFrame(() => instanceRef.current?.fitBounds({ x: 0, y: 0, width: next.width, height: next.height }, { padding: .04, duration: 450 }))
  }, [])

  const fitWorkspaceToContent = useCallback(() => {
    const visible = nodes.filter((node) => !node.hidden)
    const right = Math.max(800, ...visible.map((node) => node.position.x + nodeSize(node).width + 80))
    const bottom = Math.max(600, ...visible.map((node) => node.position.y + nodeSize(node).height + 80))
    const next = { ...workspace, preset: 'custom' as const, width: Math.ceil(right), height: Math.ceil(bottom) }
    setWorkspace(next); setNotice('Workspace fitted to visible content')
    requestAnimationFrame(() => instanceRef.current?.fitBounds({ x: 0, y: 0, width: next.width, height: next.height }, { padding: .04, duration: 400 }))
  }, [nodes, workspace])

  const startDrawing = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!['freehand_membrane','straight_membrane'].includes(drawingTool) || !instanceRef.current) return
    if ((event.target as HTMLElement).closest('.react-flow__panel,.react-flow__controls,.react-flow__minimap,.blank-quick-start')) return
    const rect = flowRef.current?.getBoundingClientRect(); if (!rect) return
    const flow = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setDraftMembrane({ flow: [flow], screen: [{ x: event.clientX - rect.left, y: event.clientY - rect.top }] })
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [drawingTool])

  const continueDrawing = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!draftMembrane || !instanceRef.current || !['freehand_membrane','straight_membrane'].includes(drawingTool)) return
    const rect = flowRef.current?.getBoundingClientRect(); if (!rect) return
    const flow = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    setDraftMembrane((draft) => {
      if (!draft) return draft
      const last = draft.screen[draft.screen.length - 1]
      if (Math.hypot(screen.x - last.x, screen.y - last.y) < 4) return draft
      return { flow: [...draft.flow, flow], screen: [...draft.screen, screen] }
    })
  }, [draftMembrane, drawingTool])

  const finishDrawing = useCallback(() => {
    if (!draftMembrane || !['freehand_membrane','straight_membrane'].includes(drawingTool)) return
    const raw = drawingTool === 'straight_membrane' && draftMembrane.flow.length > 1 ? [draftMembrane.flow[0], draftMembrane.flow[draftMembrane.flow.length - 1]] : draftMembrane.flow
    setDraftMembrane(undefined)
    if (raw.length < 2 || Math.hypot(raw.at(-1)!.x - raw[0].x, raw.at(-1)!.y - raw[0].y) < 20) return
    const smoothed = drawingTool === 'freehand_membrane' ? smoothMembranePoints(raw, .72) : raw
    const minX = Math.min(...smoothed.map((point) => point.x)); const minY = Math.min(...smoothed.map((point) => point.y))
    const maxX = Math.max(...smoothed.map((point) => point.x)); const maxY = Math.max(...smoothed.map((point) => point.y)); const pad = 30
    const path = smoothed.map((point) => ({ x: point.x - minX + pad, y: point.y - minY + pad }))
    const id = uid('membrane')
    const membrane: MembraneDefinition = { id, name: 'Plasma membrane', boundaryType: 'plasma_membrane', path, sideA: 'extracellular', sideB: 'cytoplasm', closed: false, style: 'standard', thickness: 12, smoothing: 65, anchors: [] }
    const node: BioNodeType = { id, type: 'membrane', deletable: false, selected: true, position: { x: minX - pad, y: minY - pad }, style: { width: Math.max(80, maxX - minX + pad * 2), height: Math.max(70, maxY - minY + pad * 2) }, data: createBioData('membrane', 'Plasma membrane', { membrane, visibility: 'visible', positionMode: 'manual' }) }
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node]); setSelectedNodeId(id); setAlignmentNodeIds([id]); if (!continuousTool) setDrawingTool('select'); setNotice(`Biological membrane created${continuousTool ? '. Draw again or press ESC to exit.' : '. Drag a receptor near it to snap.'}`)
  }, [continuousTool, draftMembrane, drawingTool])

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    setContextTarget(undefined)
    if (!instanceRef.current) return
    const position = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    if (drawingTool === 'place_cell') placeCellAt(position)
    else if (drawingTool === 'place_receptor') placeNodeAt('receptor', position)
    else if (drawingTool === 'place_antibody') placeNodeAt('antibody', position)
    else if (drawingTool === 'place_ligand') placeNodeAt('ligand', position)
    else if (drawingTool === 'place_annotation') placeCalloutAt(position)
    else if (drawingTool === 'select') { setSelectedNodeId(undefined); setSelectedEdgeId(undefined); setAlignmentNodeIds([]) }
  }, [drawingTool, placeCalloutAt, placeCellAt, placeNodeAt])

  const runLayout = useCallback(async () => {
    setIsLayingOut(true)
    try {
      const laidOut = await autoLayout(nodes, edges)
      setNodes(laidOut)
      requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.12, duration: 550 }))
      setNotice('Biology-aware ELK layout applied by compartment')
    } catch (error) { setNotice(`Auto layout failed: ${error instanceof Error ? error.message : 'unknown error'}`) }
    finally { setIsLayingOut(false) }
  }, [edges, nodes])

  const resetScene = useCallback(() => {
    if (!window.confirm('Reset this scene? Current objects, literature links, review notes, and comments will be replaced.')) return
    const template = cloneTemplate(templateId)
    const scoped = applyVisualizationProfile(template.nodes, template.edges, visualizationProfile)
    setNodes(scoped.nodes)
    setEdges(scoped.edges)
    setMode('biological')
    setMechanism(undefined)
    setReview({ status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() })
    setLiterature([])
    setCollaboration(emptyCollaboration())
    setSceneTitle(template.title)
    setSceneCreatedAt(new Date().toISOString())
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    setNotice(`${template.title} template restored`)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.12, duration: 450 }))
  }, [templateId, visualizationProfile])

  const loadTemplate = useCallback((nextTemplateId: SceneTemplateId) => {
    if (nextTemplateId === templateId || !window.confirm('Switch templates? Current objects, literature links, review notes, and comments will be replaced.')) return
    const template = cloneTemplate(nextTemplateId)
    const scoped = applyVisualizationProfile(template.nodes, template.edges, visualizationProfile)
    setTemplateId(nextTemplateId)
    setSceneTitle(template.title)
    setSceneCreatedAt(new Date().toISOString())
    setMechanism(undefined)
    setReview({ status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() })
    setLiterature([])
    setCollaboration(emptyCollaboration())
    setNodes(scoped.nodes)
    setEdges(scoped.edges)
    setViews([])
    setActiveViewId(undefined)
    setMode('biological')
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    setNotice(`${template.title} template loaded`)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.08, duration: 500 }))
  }, [templateId, visualizationProfile])

  const generateFromMechanism = useCallback((parsed: ParsedMechanism) => {
    if (!window.confirm('Generate a new mechanism scene? Current objects, literature links, review notes, and comments will be replaced.')) return
    const generated = sceneFromMechanism(parsed)
    const scoped = applyVisualizationProfile(generated.nodes, generated.edges, visualizationProfile)
    setNodes(scoped.nodes)
    setEdges(scoped.edges)
    setTemplateId(generated.templateId)
    setSceneTitle(generated.title)
    setSceneCreatedAt(new Date().toISOString())
    setMechanism(parsed)
    setReview({ status: 'draft', reviewers: [], notes: '', updatedAt: new Date().toISOString() })
    setLiterature([])
    setCollaboration(emptyCollaboration())
    setMode('biological')
    setViews([])
    setActiveViewId(undefined)
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    setShowMechanismComposer(false)
    setNotice(`Generated ${parsed.entities.length} entities and ${parsed.interactions.length} typed interactions`)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.08, duration: 550 }))
  }, [visualizationProfile])

  const saveJson = useCallback(() => {
    downloadText(`bioscene-${templateId}.json`, JSON.stringify(currentScene, null, 2), 'application/json')
    setNotice('Scene JSON saved')
  }, [currentScene, templateId])

  const loadJson = useCallback(async (file: File) => {
    try {
      const parsed = parseSceneFile(JSON.parse(await file.text()))
      if (!parsed) throw new Error('Invalid scene schema')
      applySceneState(parsed)
      setNotice(`${file.name} restored`)
      requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.12, duration: 450 }))
    } catch {
      setNotice('Could not load scene: invalid BioScene JSON')
    }
  }, [applySceneState])

  const exportFigure = useCallback(async (format: 'png' | 'svg' | 'pptx') => {
    const target = flowRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!target) return
    try {
    setSelectedNodeId(undefined)
    setSelectedEdgeId(undefined)
    const workspaceScene = visualizationProfile.sceneType === 'empty'
    if (workspaceScene) await instanceRef.current?.fitBounds({ x: 0, y: 0, width: workspace.width, height: workspace.height }, { padding: 0, duration: 0 })
    else await instanceRef.current?.fitView({ padding: .14, duration: 0 })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const presetSpec = exportSpecs[exportPreset]
    const spec = workspaceScene ? { ...presetSpec, width: Math.round(workspace.width), height: Math.round(workspace.height) } : presetSpec
    const background = workspaceScene ? workspaceBackground(workspace) : exportPreset === 'transparent' ? undefined : styleBackground[stylePreset]
    const attribution = assetAttribution(nodes)
    const filter = (element: HTMLElement) => element.dataset?.exportExclude !== 'true'
    if (format === 'svg') {
      const rawSvg = await toSvg(target, { backgroundColor: background, cacheBust: true, width: spec.width, height: spec.height, filter })
      const dataUrl = addSvgCredit(rawSvg, attribution.compact, spec.width, spec.height)
      const anchor = document.createElement('a'); anchor.href = dataUrl; anchor.download = `bioscene-${templateId}-${exportPreset}.svg`; anchor.click()
    } else {
      const raw = await toPng(target, { backgroundColor: background, pixelRatio: 2, cacheBust: true, filter })
      const dataUrl = await fitDataUrl(raw, spec.width, spec.height, background, attribution.compact)
      if (format === 'png') {
        const anchor = document.createElement('a'); anchor.href = dataUrl; anchor.download = `bioscene-${templateId}-${exportPreset}.png`; anchor.click()
      } else {
        const pptx = new PptxGenJS()
        pptx.author = 'BioScene Engine'; pptx.subject = sceneTitle; pptx.title = sceneTitle; pptx.company = 'BioScene Engine'
        pptx.defineLayout({ name: 'BIOSCENE_SQUARE', width: 10, height: 10 })
        pptx.layout = spec.layout
        const slide = pptx.addSlide(); slide.background = { color: background?.replace('#', '') ?? 'FFFFFF', transparency: background ? 0 : 100 }
        const size = spec.layout === 'LAYOUT_WIDE' ? { w: 13.333, h: 7.5 } : spec.layout === 'LAYOUT_4X3' ? { w: 10, h: 7.5 } : { w: 10, h: 10 }
        slide.addImage({ data: dataUrl, x: 0, y: 0, w: size.w, h: size.h })
        await pptx.writeFile({ fileName: `bioscene-${templateId}-${exportPreset}.pptx` })
      }
    }
    if (attribution.full) downloadText(`bioscene-${templateId}-ATTRIBUTIONS.txt`, attribution.full, 'text/plain')
    setNotice(`${format.toUpperCase()} exported with ${exportPreset} preset`)
    } catch (error) { setNotice(`${format.toUpperCase()} export failed: ${error instanceof Error ? error.message : 'unknown error'}`) }
  }, [exportPreset, nodes, sceneTitle, stylePreset, templateId, visualizationProfile.sceneType, workspace])

  const createSnapshot = useCallback(() => {
    const next: SceneRevision = { id: uid('revision'), label: `Revision ${revisions.length + 1}`, createdAt: new Date().toISOString(), scene: JSON.parse(JSON.stringify(currentScene)) as SceneFile }
    setRevisions((items) => [next, ...items].slice(0, 5)); setNotice(`${next.label} saved`)
  }, [currentScene, revisions.length])

  const attachLiterature = useCallback((literatureId: string) => {
    const record = literature.find((item) => item.id === literatureId)
    if (!selectedEdgeId || !record) return
    setEdges((items) => items.map((edge) => {
      if (edge.id !== selectedEdgeId) return edge
      const evidence = edge.data?.evidence ?? { status: 'needs-review' as const, citation: '' }
      const literatureIds = Array.from(new Set([...(evidence.literatureIds ?? []), literatureId]))
      return { ...edge, data: { ...(edge.data ?? { interaction: 'BIND' }), evidence: { ...evidence, literatureIds, citation: evidence.citation || record.title, url: evidence.url || record.url } } }
    }))
    setNotice(`Literature attached to ${selectedEdgeId}`)
  }, [literature, selectedEdgeId])

  const updateLiterature = useCallback((records: LiteratureRecord[]) => {
    const kept = new Set(records.map((record) => record.id))
    setLiterature(records)
    setEdges((items) => items.map((edge) => edge.data?.evidence ? { ...edge, data: { ...edge.data, evidence: { ...edge.data.evidence, literatureIds: edge.data.evidence.literatureIds?.filter((id) => kept.has(id)) } } } : edge))
  }, [])

  const enrichLiteratureRecord = useCallback(async (id: string) => {
    const record = literature.find((item) => item.id === id)
    if (!record || !room.endpoint) { setNotice('Configure a production backend before enriching metadata'); return }
    setEnrichingLiteratureId(id)
    try {
      const patch = await enrichLiterature(room, roomToken, record)
      setLiterature((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))
      setNotice(`Metadata enriched for ${patch.title}`)
    } catch (error) {
      setLiterature((items) => items.map((item) => item.id === id ? { ...item, metadataStatus: 'failed' } : item))
      setNotice(`Metadata enrichment failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally { setEnrichingLiteratureId(undefined) }
  }, [literature, room, roomToken])

  const selectedCell = selectedNode?.data.kind === 'cell' ? selectedNode : nodes.find((node) => node.id === selectedNode?.parentId)
  const saveTissueModule = useCallback(() => {
    if (!selectedCell) return
    const ids = new Set([selectedCell.id])
    let changed = true
    while (changed) { changed = false; for (const node of nodes) if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true } }
    const moduleNodes = nodes.filter((node) => ids.has(node.id))
    const moduleEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    const literatureIds = new Set(moduleEdges.flatMap((edge) => edge.data?.evidence?.literatureIds ?? []))
    const item: TissueModule = {
      id: uid('module'), name: selectedCell.data.label, description: `Reusable ${selectedCell.data.label} network`, createdAt: new Date().toISOString(),
      nodes: JSON.parse(JSON.stringify(moduleNodes)), edges: JSON.parse(JSON.stringify(moduleEdges)), literature: JSON.parse(JSON.stringify(literature.filter((record) => literatureIds.has(record.id)))),
    }
    setModules((items) => [item, ...items]); setNotice(`${item.name} saved as tissue module`)
  }, [edges, literature, nodes, selectedCell])

  const insertTissueModule = useCallback((item: TissueModule) => {
    const root = item.nodes.find((node) => node.data.kind === 'cell' && !node.parentId)
    if (!root) return
    const idMap = new Map(item.nodes.map((node) => [node.id, uid('module-node')]))
    const rightEdge = Math.max(0, ...nodes.filter((node) => node.data.kind === 'cell').map((node) => node.position.x + (typeof node.style?.width === 'number' ? node.style.width : Number.parseFloat(String(node.style?.width ?? 620)) || 620)))
    const nextNodes = item.nodes.map((node) => ({ ...JSON.parse(JSON.stringify(node)), id: idMap.get(node.id)!, parentId: node.parentId ? idMap.get(node.parentId) : undefined, selected: false, data: { ...node.data, panelId: targetPanel }, position: node.id === root.id ? { x: rightEdge + 80, y: root.position.y } : { ...node.position } })) as BioNodeType[]
    const nextEdges = item.edges.map((edge) => ({ ...JSON.parse(JSON.stringify(edge)), id: uid('edge'), source: idMap.get(edge.source)!, target: idMap.get(edge.target)!, selected: false })) as BioEdge[]
    setNodes((current) => [...current, ...nextNodes]); setEdges((current) => [...current, ...nextEdges]); setLiterature((current) => [...current, ...(item.literature ?? []).filter((record) => !current.some((existing) => existing.id === record.id))]); setShowModulePanel(false); setNotice(`${item.name} module inserted`)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: .08, duration: 500 }))
  }, [nodes, targetPanel])

  const syncRoom = useCallback(async (direction: 'push' | 'pull') => {
    if (!room.endpoint || !room.roomId) return
    setIsSyncing(true)
    try {
      if (direction === 'push') {
        const syncedAt = new Date().toISOString()
        const event = { id: uid('activity'), actor: collaboration.participants[0] ?? 'Local user', action: `Pushed to room ${room.roomId}`, createdAt: syncedAt }
        const nextCollaboration = { ...collaboration, activity: [event, ...collaboration.activity].slice(0, 50) }
        const result = await pushRoom(room, roomToken, { ...currentScene, collaboration: nextCollaboration })
        setCollaboration(nextCollaboration); setRoom((value) => ({ ...value, endpoint: result.endpoint, revision: result.revision, lastSyncedAt: syncedAt }))
      } else {
        if (!window.confirm('Pulling will replace the current scene. A local snapshot will be created first. Continue?')) return
        createSnapshot()
        const result = await pullRoom(room, roomToken)
        const scene = result.scene
        setNodes(scene.nodes); setEdges(scene.edges); setMode(scene.constraintMode); setTemplateId(scene.templateId ?? DEFAULT_TEMPLATE_ID); setSceneTitle(scene.title); setSceneCreatedAt(scene.createdAt); setMechanism(scene.mechanism); setStylePreset(scene.stylePreset); setReview(scene.review); setLiterature(scene.literature)
        const syncedAt = new Date().toISOString(); setCollaboration({ ...scene.collaboration, activity: [{ id: uid('activity'), actor: scene.collaboration.participants[0] ?? 'Local user', action: `Pulled revision ${result.revision ?? 'unversioned'} from room ${room.roomId}`, createdAt: syncedAt }, ...scene.collaboration.activity].slice(0, 50) }); setRoom((value) => ({ ...value, endpoint: result.endpoint, revision: result.revision, lastSyncedAt: syncedAt }))
      }
      setNotice(`Room ${direction} completed`)
    } catch (error) { setNotice(error instanceof BackendConflictError ? error.message : `Room sync failed: ${error instanceof Error ? error.message : 'unknown error'}`) }
    finally { setIsSyncing(false) }
  }, [collaboration, createSnapshot, currentScene, room, roomToken])

  const exportReviewPackage = useCallback(async () => {
    const target = flowRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!target) return
    try {
    setSelectedNodeId(undefined); setSelectedEdgeId(undefined); await instanceRef.current?.fitView({ padding: .14, duration: 0 })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const figure = await toPng(target, { backgroundColor: styleBackground[stylePreset], pixelRatio: 2, cacheBust: true })
    const zip = new JSZip()
    zip.file('scene.json', JSON.stringify(currentScene, null, 2))
    zip.file('figure.png', figure.split(',')[1], { base64: true })
    const reviewText = `# BioScene scientific review\n\nTitle: ${sceneTitle}\nStatus: ${review.status}\nReviewers: ${review.reviewers.join(', ') || 'Unassigned'}\nUpdated: ${review.updatedAt}\n\n## Review notes\n\n${review.notes || 'No review notes.'}\n\n## Package contents\n\n- figure.png: rendered scene\n- scene.json: editable BioScene v0.10 scene\n- evidence.csv: interaction evidence ledger\n- literature.json: appraised literature library\n- collaboration.json: participants, comments, and activity\n- PROVENANCE.csv: explicit, inferred, and template entity provenance\n- ATTRIBUTIONS.txt: third-party asset credits (when applicable)\n`
    zip.file('REVIEW.md', reviewText)
    const csv = ['edge_id,interaction,source,target,status,citation,url,note,literature_ids,literature_titles,mean_score', ...edges.map((edge) => { const records = (edge.data?.evidence?.literatureIds ?? []).map((id) => literature.find((record) => record.id === id)).filter((record): record is LiteratureRecord => !!record); return [edge.id, edge.data?.interaction, edge.source, edge.target, edge.data?.evidence?.status ?? 'needs-review', edge.data?.evidence?.citation ?? '', edge.data?.evidence?.url ?? '', edge.data?.evidence?.note ?? '', records.map((record) => record.id).join(';'), records.map((record) => record.title).join(';'), records.length ? Math.round(records.reduce((sum, record) => sum + record.score, 0) / records.length) : ''].map(csvCell).join(',') })].join('\n')
    zip.file('evidence.csv', csv)
    zip.file('literature.json', JSON.stringify(literature, null, 2))
    zip.file('collaboration.json', JSON.stringify(collaboration, null, 2))
    const attribution = assetAttribution(nodes)
    zip.file('ATTRIBUTIONS.txt', attribution.full || 'No third-party visual assets are bound in this scene.')
    const provenanceCsv = ['node_id,label,kind,provenance', ...nodes.filter((node) => node.data.kind !== 'cell').map((node) => [node.id, node.data.label, node.data.kind, node.data.provenance ?? 'template'].map(csvCell).join(','))].join('\n')
    zip.file('PROVENANCE.csv', provenanceCsv)
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `bioscene-${templateId}-review.zip`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Review package exported with figure, scene, notes, and evidence ledger')
    } catch (error) { setNotice(`Review package export failed: ${error instanceof Error ? error.message : 'unknown error'}`) }
  }, [collaboration, currentScene, edges, literature, nodes, review, sceneTitle, stylePreset, templateId])

  const restoreRevision = useCallback((revision: SceneRevision) => {
    const scene = revision.scene; setNodes(scene.nodes); setEdges(scene.edges); setMode(scene.constraintMode); setTemplateId(scene.templateId ?? DEFAULT_TEMPLATE_ID); setSceneTitle(scene.title); setSceneCreatedAt(scene.createdAt); setMechanism(scene.mechanism); setStylePreset(scene.stylePreset); setReview(scene.review); setLiterature(scene.literature); setCollaboration(scene.collaboration); setShowProductionPanel(false); setNotice(`${revision.label} restored`)
    requestAnimationFrame(() => instanceRef.current?.fitView({ padding: .12, duration: 450 }))
  }, [])

  const alignSelection = useCallback((action: AlignmentAction) => {
    const selectedIds = new Set(alignmentNodeIds.filter((id) => nodes.find((node) => node.id === id)?.data.kind !== 'cell'))
    nodes.filter((node) => node.selected && node.data.kind !== 'cell').forEach((node) => selectedIds.add(node.id))
    if (selectedNodeId && nodes.find((node) => node.id === selectedNodeId)?.data.kind !== 'cell') selectedIds.add(selectedNodeId)
    const selected = nodes.filter((node) => selectedIds.has(node.id))
    if (selected.length < 2 || new Set(selected.map((node) => node.parentId)).size > 1) { setNotice('Select 2+ objects in the same panel (Shift-click)'); return }
    if (action.startsWith('distribute') && selected.length < 3) { setNotice('Distribution needs 3+ selected objects'); return }
    const width = (node: BioNodeType) => node.measured?.width ?? node.width ?? 150
    const height = (node: BioNodeType) => node.measured?.height ?? node.height ?? 56
    const left = Math.min(...selected.map((node) => node.position.x)); const right = Math.max(...selected.map((node) => node.position.x + width(node)))
    const top = Math.min(...selected.map((node) => node.position.y)); const bottom = Math.max(...selected.map((node) => node.position.y + height(node)))
    const orderedX = [...selected].sort((a, b) => a.position.x - b.position.x); const orderedY = [...selected].sort((a, b) => a.position.y - b.position.y)
    const xStep = selected.length > 1 ? (right - width(orderedX.at(-1)!) / 2 - (left + width(orderedX[0]) / 2)) / (selected.length - 1) : 0
    const yStep = selected.length > 1 ? (bottom - height(orderedY.at(-1)!) / 2 - (top + height(orderedY[0]) / 2)) / (selected.length - 1) : 0
    const xRanks = new Map(orderedX.map((node, index) => [node.id, index])); const yRanks = new Map(orderedY.map((node, index) => [node.id, index]))
    setNodes((items) => items.map((node) => {
      if (!selectedIds.has(node.id)) return node
      let x = node.position.x; let y = node.position.y
      if (action === 'left') x = left; if (action === 'center-x') x = (left + right - width(node)) / 2; if (action === 'right') x = right - width(node)
      if (action === 'top') y = top; if (action === 'center-y') y = (top + bottom - height(node)) / 2; if (action === 'bottom') y = bottom - height(node)
      if (action === 'distribute-x') x = left + width(orderedX[0]) / 2 + (xRanks.get(node.id) ?? 0) * xStep - width(node) / 2
      if (action === 'distribute-y') y = top + height(orderedY[0]) / 2 + (yRanks.get(node.id) ?? 0) * yStep - height(node) / 2
      return constrainNode({ ...node, position: { x, y } }, mode, items)
    }))
    setNotice(`${action} applied to ${selected.length} objects`)
  }, [alignmentNodeIds, mode, nodes, selectedNodeId])

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next = current === 'biological' ? 'free' : 'biological'
      if (next === 'biological') setNodes((items) => items.map((item) => constrainNode(item, next, items)))
      setNotice(next === 'biological' ? 'Biological constraints enabled' : 'Free Edit enabled — warnings only')
      return next
    })
  }, [])

  const warnings = useMemo(() => biologicalWarnings(nodes, edges), [edges, nodes])
  const counts = useMemo(() => ({
    objects: nodes.filter((node) => node.data.kind !== 'cell' && !node.hidden).length,
    interactions: edges.filter((edge) => !edge.hidden).length,
    warnings: warnings.length,
  }), [edges, nodes, warnings.length])

  return (
    <div className="app-shell" data-style={stylePreset}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><FlaskConical size={20} /></span>
          <span><strong>BioScene</strong><small>ENGINE</small></span>
        </div>
        <div className="project-title"><span className="status-dot" /><span className="project-name" title={sceneTitle}>{sceneTitle}</span><small>v0.14 · Interactive editor</small></div>
        <div className="top-actions">
          <button className="ghost-button" data-help="새 그림의 Scene, Detail, Layout을 먼저 선택한 뒤 빈 캔버스·MoA 생성·기존 JSON 불러오기 중 시작 방식을 고릅니다." onClick={() => setShowNewFigure(true)}><Plus size={16}/> New figure</button>
          <button className="ghost-button" data-help="현재 semantic biology는 유지하면서 Scene type, Detail level, Abstraction, Layout과 저장된 여러 view를 관리합니다." onClick={() => setShowSceneSettings(true)}><Settings2 size={16}/> Figure settings</button>
          <button className="ghost-button" data-help="그림에 사용할 protein과 proprietary construct의 topology, visual template, functional domains, targets와 자동 생성 port를 정의합니다. Private construct는 외부 데이터베이스로 전송하지 않습니다." onClick={() => openMoleculeBuilder()}><Workflow size={16}/> Molecule builder</button>
          <button className="ghost-button" data-help="기전 설명을 문장으로 입력하면 인식한 분자·세포·상호작용을 먼저 미리 보여주고, 확인 후 편집 가능한 장면으로 생성합니다. 생성하면 현재 장면과 근거·메모가 교체되므로 확인창이 표시됩니다." onClick={() => setShowMechanismComposer(true)}><Sparkles size={16} /> Generate from MoA</button>
          <button className="ghost-button icon-only" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!undoStack.current.length} onClick={undo} data-history-version={historyVersion}><Undo2 size={16} /></button>
          <button className="ghost-button icon-only" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!redoStack.current.length} onClick={redo}><Redo2 size={16} /></button>
          <button className="ghost-button" onClick={resetScene}><RotateCcw size={16} /> Reset</button>
          <button className="ghost-button" onClick={saveJson}><Save size={16} /> Save JSON</button>
          <button className="ghost-button" data-help="논문·발표용 색상과 출력 비율을 고르고 PNG·SVG·PowerPoint로 내보냅니다. 수동 스냅샷을 만들거나 이전 스냅샷으로 복원할 수도 있습니다." onClick={() => setShowProductionPanel(true)}><PanelsTopLeft size={16} /> Production</button>
          <button className="ghost-button" data-help="PMID·DOI·논문 URL·내부 인용을 등록하고 품질 점수를 매긴 뒤, 선택한 상호작용 선에 근거로 연결합니다." onClick={() => setShowLiteraturePanel(true)}><BookOpen size={16} /> Evidence</button>
          <button className="ghost-button" data-help="검토 참여자와 댓글을 기록하고, Supabase 계정으로 로그인해 Room ID가 같은 사용자끼리 장면 리비전을 Push/Pull합니다." onClick={() => setShowCollaborationPanel(true)}><Cloud size={16} /> Collaborate</button>
          <button className={`ghost-button review-${review.status}`} data-help="현재 장면의 검수 상태(draft/in review/approved), 검토자와 과학 검토 메모를 저장합니다. 이 정보는 Scene JSON과 리뷰 ZIP에 포함됩니다." onClick={() => setShowReviewPanel(true)}><ClipboardCheck size={16} /> {review.status}</button>
          <button className="primary-button" onClick={() => exportFigure('png')}><Download size={16} /> Export PNG</button>
        </div>
      </header>

      <EditorToolbar tool={drawingTool} continuous={continuousTool} onTool={(tool) => { setDrawingTool(tool); setDraftMembrane(undefined); setNotice(`${tool.replaceAll('_', ' ')} mode`) }} onContinuous={() => setContinuousTool((value) => !value)} onShortcuts={() => setShowShortcuts(true)} />

      <div className="workspace">
        <Sidebar onAdd={addBiologicalNode} targetPanel={targetPanel} onBrowseAssets={() => setShowAssetBrowser(true)} onAddCallout={addCallout} onOpenModules={() => setShowModulePanel(true)} />
        <main className={`canvas-wrap tool-${drawingTool}`} ref={flowRef} onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={() => setDraftMembrane(undefined)}>
          <ReactFlow<BioNodeType, BioEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={(instance) => { instanceRef.current = instance }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(event, node) => selectObject(node.id, 'node', event.shiftKey)}
            onNodeDoubleClick={(_, node) => { selectObject(node.id); if (node.data.kind === 'membrane') membraneAction(node.id, 'edit'); else openMoleculeBuilder(node) }}
            onNodeContextMenu={(event, node) => { event.preventDefault(); selectObject(node.id); setContextTarget({ id: node.id, kind: 'node', x: event.clientX, y: event.clientY }) }}
            onEdgeClick={(_, edge) => selectObject(edge.id, 'edge')}
            onEdgeContextMenu={(event, edge) => { event.preventDefault(); selectObject(edge.id, 'edge'); setContextTarget({ id: edge.id, kind: 'edge', x: event.clientX, y: event.clientY }) }}
            onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => { const ids = selectedNodes.map((node) => node.id); setAlignmentNodeIds(ids); setSelectedNodeId(ids[0]); setSelectedEdgeId(selectedEdges[0]?.id) }}
            onPaneClick={handlePaneClick}
            onNodeDragStop={(_, node) => handleNodeDragStop(node)}
            panOnDrag={drawingTool === 'pan'}
            selectionOnDrag={drawingTool === 'select'}
            nodesDraggable={drawingTool === 'select'}
            nodesConnectable={drawingTool === 'select'}
            elementsSelectable={drawingTool === 'select'}
            snapToGrid={workspace.snapToGrid}
            snapGrid={[workspace.gridSize, workspace.gridSize]}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.45}
            maxZoom={1.8}
            multiSelectionKeyCode="Shift"
            deleteKeyCode={null}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#cbd8d1" />
            <ViewportPortal>
              <div className="figure-workspace-frame" style={{ width: workspace.width, height: workspace.height, backgroundColor: workspaceBackground(workspace) ?? 'transparent' }}>
                {workspace.showGrid && <div className="workspace-grid" style={{ backgroundSize: `${workspace.gridSize}px ${workspace.gridSize}px` }} data-export-exclude="true" />}
                {workspace.showSafeMargin && <div className="workspace-safe-margin" style={{ inset: workspace.safeMargin }} data-export-exclude="true" />}
                {workspace.showCenterGuide && <><div className="workspace-center-guide horizontal" data-export-exclude="true"/><div className="workspace-center-guide vertical" data-export-exclude="true"/></>}
                <span className="workspace-dimensions" data-export-exclude="true">{Math.round(workspace.width)} × {Math.round(workspace.height)} {workspace.unit}</span>
              </div>
            </ViewportPortal>
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap position="bottom-right" nodeColor={(node) => node.type === 'cell' ? '#dcece5' : '#5f8878'} maskColor="rgba(245,249,247,.76)" />
            <Panel position="top-left" className="canvas-tools">
              <button className={mode === 'biological' ? 'mode-button active' : 'mode-button'} data-help="ON이면 개체를 허용된 세포 구획 안에만 배치하고 잘못된 연결을 차단합니다. Free Edit로 바꾸면 위치 제약을 풀지만 과학적 경고는 계속 계산됩니다." onClick={toggleMode}>
                {mode === 'biological' ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}
                {mode === 'biological' ? 'Biological Constraint ON' : 'Free Edit'}
              </button>
              <button className="tool-button" data-help="현재 개체와 연결을 ELK가 다시 정렬합니다. Biological Constraint가 켜져 있으면 세포 구획과 부모-자식 관계를 유지한 채 겹침을 줄입니다." onClick={runLayout} disabled={isLayingOut}><Sparkles size={15} /> {isLayingOut ? 'Laying out…' : 'Auto layout'}</button>
              <button className="tool-button" data-help="현재 Production 출력 프리셋의 크기와 배경을 적용해 벡터 SVG를 저장합니다. 사용한 외부 에셋이 있으면 크레딧도 함께 반영됩니다." onClick={() => exportFigure('svg')}><FileJson size={15} /> SVG</button>
              <button className="tool-button" data-help="BioScene에서 저장한 Scene JSON을 불러옵니다. 현재 장면·문헌·검토 메모가 바뀔 수 있으며, 구버전 파일은 최신 스키마로 안전하게 변환합니다." onClick={() => fileInput.current?.click()}><Upload size={15} /> Load</button>
              <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && loadJson(event.target.files[0])} />
              <button className="tool-button" data-help="최종 그림으로 내보낼 Workspace 크기, 배경, 안전 여백과 가이드를 변경합니다. 기존 객체 좌표는 유지됩니다." onClick={() => setShowWorkspaceSetup(true)}>Workspace</button>
              <button className="tool-button" data-help="현재 Workspace 전체가 화면에 들어오도록 확대/축소합니다." onClick={fitWorkspace}>Fit workspace</button>
            </Panel>
            <Panel position="top-center" className="alignment-tools" aria-label="Alignment tools" data-help="Shift+클릭으로 둘 이상의 개체를 선택한 뒤 정렬 또는 균등 분배합니다. 선택한 개체의 세포 구획 제약은 유지됩니다.">
              <button title="Align left" aria-label="Align left" onClick={() => alignSelection('left')}><AlignStartVertical size={15} /></button>
              <button title="Align center horizontally" aria-label="Align center horizontally" onClick={() => alignSelection('center-x')}><AlignCenterVertical size={15} /></button>
              <button title="Align right" aria-label="Align right" onClick={() => alignSelection('right')}><AlignEndVertical size={15} /></button>
              <span />
              <button title="Align top" aria-label="Align top" onClick={() => alignSelection('top')}><AlignStartHorizontal size={15} /></button>
              <button title="Align center vertically" aria-label="Align center vertically" onClick={() => alignSelection('center-y')}><AlignCenterHorizontal size={15} /></button>
              <button title="Align bottom" aria-label="Align bottom" onClick={() => alignSelection('bottom')}><AlignEndHorizontal size={15} /></button>
              <span />
              <button title="Distribute horizontally" aria-label="Distribute horizontally" onClick={() => alignSelection('distribute-x')}><AlignHorizontalDistributeCenter size={15} /></button>
              <button title="Distribute vertically" aria-label="Distribute vertically" onClick={() => alignSelection('distribute-y')}><AlignVerticalDistributeCenter size={15} /></button>
            </Panel>
            <Panel position="top-right" className="scene-badge template-picker" data-help="왼쪽은 현재 biology를 보는 Scene scope이고 오른쪽은 시작용 biology template입니다. Scene 변경은 개체를 삭제하지 않지만 template 변경은 확인 후 전체 장면을 교체합니다."><LayoutTemplate size={14}/><select aria-label="Scene type" value={visualizationProfile.sceneType} onChange={(event) => changeVisualizationProfile({ ...visualizationProfile, sceneType: event.target.value as VisualizationProfile['sceneType'] })}>{Object.entries(sceneTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Mechanism template" value={templateId} onChange={(event) => loadTemplate(event.target.value as SceneTemplateId)}>{Object.values(sceneTemplates).map((template) => <option key={template.id} value={template.id}>{template.description}</option>)}</select></Panel>
            {warnings.length > 0 && <Panel position="top-center" className="biology-warning" title={warnings.join('\n')}><strong>Biology warning</strong><span>{warnings[0]}</span>{warnings.length > 1 && <small>+{warnings.length - 1} more</small>}</Panel>}
            <Panel position="bottom-center" className="notice-bar" title={warnings.join('\n')}><span>{notice}</span><div><b>{counts.objects}</b> objects <b>{counts.interactions}</b> interactions <b className={counts.warnings ? 'warning-count' : 'ok-count'}>{counts.warnings}</b> warnings</div></Panel>
            <Panel position="bottom-left" className="active-tool-status" data-export-exclude="true"><strong>{drawingTool === 'select' ? 'Select Mode' : drawingTool === 'pan' ? 'Pan Mode' : `${drawingTool.replaceAll('_', ' ')} Mode`}</strong><span>{drawingTool === 'select' ? 'Click or drag to select · Shift for multi-select' : drawingTool === 'pan' ? 'Drag canvas to move view · ESC to exit' : continuousTool ? 'Continuous creation · ESC to exit' : 'Create once · ESC to cancel'}</span><i className={autosaveStatus}/>{autosaveStatus === 'saving' ? 'Saving…' : 'Saved'}</Panel>
          </ReactFlow>
          <LayersPanel nodes={nodes} edges={edges} selectedIds={[...alignmentNodeIds, ...(selectedEdgeId ? [selectedEdgeId] : [])]} open={layersOpen} onOpen={() => setLayersOpen((value) => !value)} onSelect={selectObject} onVisibility={toggleObjectVisibility} onLock={toggleObjectLock}/>
          {draftMembrane && <svg className="membrane-drawing-preview" aria-hidden="true"><path d={membranePathD(drawingTool === 'straight_membrane' && draftMembrane.screen.length > 1 ? [draftMembrane.screen[0], draftMembrane.screen.at(-1)!] : draftMembrane.screen)} /></svg>}
          {visualizationProfile.sceneType === 'empty' && nodes.length === 0 && !showWorkspaceSetup && <BlankQuickStart tool={drawingTool} onTool={setDrawingTool} onAdd={addBiologicalNode} onCallout={addCallout} onWorkspace={() => setShowWorkspaceSetup(true)} />}
        </main>
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
      </div>
      {contextTarget && <ObjectContextMenu target={contextTarget} isMembrane={nodes.find((node) => node.id === contextTarget.id)?.data.kind === 'membrane'} locked={!!nodes.find((node) => node.id === contextTarget.id)?.data.locked} onAction={handleContextAction}/>}
      {showShortcuts && <div className="shortcut-overlay" onMouseDown={() => setShowShortcuts(false)}><section className="shortcut-card" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">EDITOR HELP</span><h2>Keyboard shortcuts</h2></div><button onClick={() => setShowShortcuts(false)}>×</button></header><div><kbd>V</kbd><span>Select</span><kbd>H</kbd><span>Pan</span><kbd>M</kbd><span>Membrane</span><kbd>C</kbd><span>Cell</span><kbd>P</kbd><span>Protein</span><kbd>A</kbd><span>Antibody</span><kbd>T</kbd><span>Text</span><kbd>Del</kbd><span>Delete selection</span><kbd>⌘/Ctrl Z</kbd><span>Undo</span><kbd>⇧ ⌘/Ctrl Z</kbd><span>Redo</span><kbd>⌘/Ctrl C · V</kbd><span>Copy · Paste</span><kbd>⌘/Ctrl D</kbd><span>Duplicate</span><kbd>Esc</kbd><span>Cancel · Select mode</span></div></section></div>}
      {showMechanismComposer && <MechanismComposer onClose={() => setShowMechanismComposer(false)} onGenerate={generateFromMechanism} />}
      {showAssetBrowser && <SmartAssetBrowser selectedNode={selectedNode} onClose={() => setShowAssetBrowser(false)} onAttach={attachAsset} />}
      {showProductionPanel && <ProductionPanel stylePreset={stylePreset} exportPreset={exportPreset} revisions={revisions} onStyle={setStylePreset} onExportPreset={setExportPreset} onSnapshot={createSnapshot} onRestore={restoreRevision} onExport={exportFigure} onClose={() => setShowProductionPanel(false)} />}
      {showReviewPanel && <ReviewPanel value={review} onChange={setReview} onClose={() => setShowReviewPanel(false)} onExportPackage={exportReviewPackage} />}
      {showLiteraturePanel && <LiteraturePanel records={literature} selectedEdgeId={selectedEdgeId} attachedIds={selectedEdge?.data?.evidence?.literatureIds ?? []} enrichingId={enrichingLiteratureId} canEnrich={!!room.endpoint} onChange={updateLiterature} onAttach={attachLiterature} onEnrich={enrichLiteratureRecord} onClose={() => setShowLiteraturePanel(false)} />}
      {showModulePanel && <TissueModulePanel modules={modules} canSave={!!selectedCell} onSave={saveTissueModule} onInsert={insertTissueModule} onDelete={(id) => setModules((items) => items.filter((item) => item.id !== id))} onClose={() => setShowModulePanel(false)} />}
      {showCollaborationPanel && <CollaborationPanel value={collaboration} room={room} token={roomToken} busy={isSyncing} supabaseConfigured={supabaseConfigured} signedInEmail={signedInEmail} authBusy={isAuthenticating} onSignIn={signIn} onSignOut={signOut} onChange={setCollaboration} onRoomChange={setRoom} onTokenChange={setRoomToken} onPush={() => syncRoom('push')} onPull={() => syncRoom('pull')} onClose={() => setShowCollaborationPanel(false)} />}
      {showSceneSettings && <SceneSettingsPanel profile={visualizationProfile} views={views} warnings={warnings} onChange={changeVisualizationProfile} onSaveView={saveCurrentView} onApplyView={openSavedView} onDeleteView={(id) => setViews((items) => items.filter((view) => view.id !== id))} onClose={() => setShowSceneSettings(false)}/>}
      {showNewFigure && <NewFigureDialog profile={visualizationProfile} onProfile={setVisualizationProfile} onEmpty={createEmptyFigure} onMoA={() => { setShowNewFigure(false); setShowMechanismComposer(true) }} onLoad={() => { setShowNewFigure(false); fileInput.current?.click() }} onClose={() => setShowNewFigure(false)}/>}
      {showMoleculeSetup && <MoleculeSetupPanel molecules={moleculeLibrary} customFunctions={customFunctions} initialMoleculeId={setupMoleculeId} canApply={!!selectedNode && !['cell','annotation','signal','transcription'].includes(selectedNode.data.kind)} onChange={setMoleculeLibrary} onCustomFunctions={setCustomFunctions} onApply={applyMoleculeStructure} onAdd={addMoleculeToScene} onClose={() => setShowMoleculeSetup(false)}/>}
      {showWorkspaceSetup && <WorkspaceSetupPanel value={workspace} hasContent={nodes.length > 0} onSave={saveWorkspace} onFitContent={fitWorkspaceToContent} onClose={() => setShowWorkspaceSetup(false)} />}
      <ContextHelp />
    </div>
  )
}

export default function App() {
  return <ErrorBoundary><ReactFlowProvider><AppCanvas /></ReactFlowProvider></ErrorBoundary>
}
