import type { FigureWorkspace, WorkspacePreset } from './types'

export const workspacePresets: Record<Exclude<WorkspacePreset, 'custom'>, Pick<FigureWorkspace, 'width' | 'height' | 'unit'>> = {
  presentation_16_9: { width: 1600, height: 900, unit: 'px' },
  presentation_4_3: { width: 1600, height: 1200, unit: 'px' },
  square: { width: 1200, height: 1200, unit: 'px' },
  landscape: { width: 1400, height: 900, unit: 'px' },
  portrait: { width: 900, height: 1400, unit: 'px' },
  a4_landscape: { width: 297, height: 210, unit: 'mm' },
  a4_portrait: { width: 210, height: 297, unit: 'mm' },
}

export const defaultFigureWorkspace: FigureWorkspace = {
  preset: 'presentation_16_9',
  width: 1600,
  height: 900,
  unit: 'px',
  background: 'white',
  safeMargin: 40,
  showSafeMargin: true,
  showGrid: true,
  showCenterGuide: true,
  snapToGrid: false,
  gridSize: 20,
}

export function workspaceBackground(workspace: FigureWorkspace) {
  if (workspace.background === 'transparent') return undefined
  if (workspace.background === 'light_gray') return '#f2f4f3'
  if (workspace.background === 'custom') return workspace.customBackground || '#ffffff'
  return '#ffffff'
}

export function sanitizeWorkspace(value: unknown): FigureWorkspace {
  if (!value || typeof value !== 'object') return { ...defaultFigureWorkspace }
  const candidate = value as Partial<FigureWorkspace>
  const presets: WorkspacePreset[] = ['presentation_16_9','presentation_4_3','square','landscape','portrait','a4_landscape','a4_portrait','custom']
  const backgrounds: FigureWorkspace['background'][] = ['white','transparent','light_gray','custom']
  return {
    preset: presets.includes(candidate.preset as WorkspacePreset) ? candidate.preset! : 'custom',
    width: Number.isFinite(candidate.width) ? Math.max(100, Number(candidate.width)) : defaultFigureWorkspace.width,
    height: Number.isFinite(candidate.height) ? Math.max(100, Number(candidate.height)) : defaultFigureWorkspace.height,
    unit: ['px','pt','mm'].includes(String(candidate.unit)) ? candidate.unit! : 'px',
    background: backgrounds.includes(candidate.background as FigureWorkspace['background']) ? candidate.background! : 'white',
    customBackground: typeof candidate.customBackground === 'string' ? candidate.customBackground : undefined,
    safeMargin: Number.isFinite(candidate.safeMargin) ? Math.max(0, Number(candidate.safeMargin)) : 40,
    showSafeMargin: candidate.showSafeMargin !== false,
    showGrid: candidate.showGrid !== false,
    showCenterGuide: candidate.showCenterGuide !== false,
    snapToGrid: candidate.snapToGrid === true,
    gridSize: Number.isFinite(candidate.gridSize) ? Math.max(2, Number(candidate.gridSize)) : 20,
  }
}
