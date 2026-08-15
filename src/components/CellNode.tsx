import type { NodeProps } from '@xyflow/react'
import type { BioNode } from '../types'

export function CellNode({ data, selected }: NodeProps<BioNode>) {
  const panelLabel = data.panelId === 'untreated' ? 'UNTREATED' : data.panelId === 'treated' ? 'TREATED' : data.panelId === 'tissue' ? 'TISSUE' : 'MECHANISM'
  return (
    <div className={`cell-node scene-${data.sceneType ?? 'full_signaling'} ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${selected ? 'is-selected' : ''}`}>
      <span className={`panel-label panel-${data.panelId ?? 'single'}`}>{panelLabel}</span>
      <div className="cell-label">
        <span className="cell-dot" />
        <span>{data.label}</span>
        <small>matched biological container</small>
      </div>
      {!['intracellular', 'environment'].includes(data.sceneType ?? '') && <div className="zone zone-extracellular"><span>{data.showCompartmentLabels === false ? '' : 'EXTRACELLULAR'}</span></div>}
      {!['intracellular', 'environment'].includes(data.sceneType ?? '') && <div className="zone zone-membrane"><span>{data.showCompartmentLabels === false ? '' : 'PLASMA MEMBRANE'}</span></div>}
      {data.sceneType !== 'ecm_membrane' && <div className="zone zone-cytoplasm"><span>{data.showCompartmentLabels === false ? '' : 'CYTOPLASM'}</span></div>}
      {data.sceneType !== 'ecm_membrane' && <div className="zone zone-nucleus"><span>{data.showCompartmentLabels === false ? '' : 'NUCLEUS'}</span></div>}
      {data.showOrganelles !== false && !['ecm_membrane', 'environment'].includes(data.sceneType ?? '') && <><div className="organelle organelle-endosome"><span>ENDOSOME</span></div><div className="organelle organelle-mitochondria"><span>MITOCHONDRIA</span></div></>}
    </div>
  )
}
