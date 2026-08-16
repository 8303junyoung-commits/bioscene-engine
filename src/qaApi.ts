import type { BioEdge, BioNode, FigureWorkspace, MoleculeDefinition } from './types'

export interface BioSceneQaApi {
  readonly version: 1
  getSceneObjects(): BioNode[]
  getSceneObject(id:string): BioNode | undefined
  getSelectedObject(): BioNode | undefined
  getMoleculeDefinitions(): MoleculeDefinition[]
  getMoleculeDefinition(name:string): MoleculeDefinition | undefined
  getInteractions(): BioEdge[]
  getMembranes(): BioNode[]
  getWorkspace(): FigureWorkspace
  getCurrentView(): Record<string, unknown>
  getHistoryState(): { undoCount:number; redoCount:number }
  getAppErrors(): string[]
}

declare global { interface Window { __BIOSCENE_QA__?: BioSceneQaApi } }

export const qaApiEnabled = () => import.meta.env.DEV || import.meta.env.VITE_BIOSCENE_QA === 'true'
export const qaClone = <T,>(value:T):T => structuredClone(value)
