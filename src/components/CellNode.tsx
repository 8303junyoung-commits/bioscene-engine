import type { NodeProps } from '@xyflow/react'
import type { BioNode } from '../types'

export function CellNode({ data, selected }: NodeProps<BioNode>) {
  const panelLabel = data.panelId === 'untreated' ? 'UNTREATED' : data.panelId === 'treated' ? 'TREATED' : data.panelId === 'tissue' ? 'TISSUE' : 'MECHANISM'
  return (
    <div className={`cell-node ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${selected ? 'is-selected' : ''}`}>
      <span className={`panel-label panel-${data.panelId ?? 'single'}`}>{panelLabel}</span>
      <div className="cell-label">
        <span className="cell-dot" />
        <span>{data.label}</span>
        <small>matched biological container</small>
      </div>
      <div className="zone zone-extracellular"><span>EXTRACELLULAR</span></div>
      <div className="zone zone-membrane"><span>PLASMA MEMBRANE</span></div>
      <div className="zone zone-cytoplasm"><span>CYTOPLASM</span></div>
      <div className="zone zone-nucleus"><span>NUCLEUS</span></div>
      <div className="organelle organelle-endosome"><span>ENDOSOME</span></div>
      <div className="organelle organelle-mitochondria"><span>MITOCHONDRIA</span></div>
    </div>
  )
}
