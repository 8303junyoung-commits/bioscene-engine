import { NodeResizer, NodeToolbar, type NodeProps } from '@xyflow/react'
import { Copy, Trash2 } from 'lucide-react'
import type { BioNode } from '../types'
import { useCanvasDisplay } from './CanvasDisplayContext'

const action = (id: string, name: string) => window.dispatchEvent(new CustomEvent('bioscene:object-action', { detail: { id, action: name } }))

export function CellNode({ id, data, selected }: NodeProps<BioNode>) {
  const display = useCanvasDisplay()
  const showCompartments = display.overlays.compartments && data.showCompartmentLabels !== false
  const panelLabel = data.panelId === 'untreated' ? 'UNTREATED' : data.panelId === 'treated' ? 'TREATED' : data.panelId === 'tissue' ? 'TISSUE' : 'MECHANISM'
  return (
    <div className={`cell-node scene-${data.sceneType ?? 'full_signaling'} ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${selected ? 'is-selected' : ''}`}>
      <NodeResizer isVisible={selected && !data.locked} minWidth={420} minHeight={300} lineClassName="selection-resize-line" handleClassName="selection-resize-handle" />
      <NodeToolbar isVisible={selected} className="selection-mini-toolbar" data-export-exclude="true"><button onClick={() => action(id, 'duplicate')}><Copy size={13}/> Duplicate</button><button className="danger" onClick={() => action(id, 'delete')}><Trash2 size={13}/> Delete</button></NodeToolbar>
      {display.overlays.names && <span className={`panel-label panel-${data.panelId ?? 'single'}`}>{panelLabel}</span>}
      {display.overlays.names && <div className="cell-label">
        <span className="cell-dot" />
        <span>{data.label}</span>
        <small>matched biological container</small>
      </div>}
      {!['intracellular', 'environment'].includes(data.sceneType ?? '') && <div className="zone zone-extracellular"><span>{showCompartments ? 'EXTRACELLULAR' : ''}</span></div>}
      {!['intracellular', 'environment'].includes(data.sceneType ?? '') && <div className="zone zone-membrane"><span>{showCompartments ? 'PLASMA MEMBRANE' : ''}</span></div>}
      {data.sceneType !== 'ecm_membrane' && <div className="zone zone-cytoplasm"><span>{showCompartments ? 'CYTOPLASM' : ''}</span></div>}
      {data.sceneType !== 'ecm_membrane' && <div className="zone zone-nucleus"><span>{showCompartments ? 'NUCLEUS' : ''}</span></div>}
      {data.showOrganelles !== false && !['ecm_membrane', 'environment'].includes(data.sceneType ?? '') && <><div className="organelle organelle-endosome"><span>{showCompartments?'ENDOSOME':''}</span></div><div className="organelle organelle-mitochondria"><span>{showCompartments?'MITOCHONDRIA':''}</span></div></>}
    </div>
  )
}
