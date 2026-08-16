/* eslint-disable react-refresh/only-export-components -- context, hook, and presets are intentionally colocated */
import { createContext, useContext, type ReactNode } from 'react'
import type { MoleculeDefinition } from '../types'

export type CanvasViewMode = 'clean' | 'detail'
export type FigurePreset = 'publication' | 'presentation' | 'mechanism' | 'debug'
export type CanvasOverlay = 'names' | 'ports' | 'anchors' | 'domains' | 'functions' | 'state' | 'compartments' | 'ids' | 'debug' | 'interactionLabels'
export type CanvasOverlays = Record<CanvasOverlay, boolean>

export const cleanOverlays: CanvasOverlays = { names:false, ports:false, anchors:false, domains:false, functions:false, state:false, compartments:false, ids:false, debug:false, interactionLabels:false }
export const detailOverlays: CanvasOverlays = { names:true, ports:true, anchors:true, domains:true, functions:true, state:true, compartments:true, ids:false, debug:false, interactionLabels:true }

export const figurePresetOverlays: Record<FigurePreset, CanvasOverlays> = {
  publication: { ...cleanOverlays },
  presentation: { ...cleanOverlays, names:true },
  mechanism: { ...cleanOverlays, names:true, functions:true, state:true, compartments:true, interactionLabels:true },
  debug: { ...detailOverlays, ids:true, debug:true },
}

interface CanvasDisplayValue {
  mode: CanvasViewMode
  overlays: CanvasOverlays
  molecules: MoleculeDefinition[]
}

const CanvasDisplayContext = createContext<CanvasDisplayValue>({ mode:'clean', overlays:cleanOverlays, molecules:[] })

export function CanvasDisplayProvider({ value, children }:{ value:CanvasDisplayValue; children:ReactNode }) {
  return <CanvasDisplayContext.Provider value={value}>{children}</CanvasDisplayContext.Provider>
}

export const useCanvasDisplay = () => useContext(CanvasDisplayContext)
