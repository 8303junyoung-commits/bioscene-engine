import { Handle, NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { Copy, Image, Pencil, Trash2 } from 'lucide-react'
import type { BioNode as BioNodeType, PortDefinition } from '../types'
import { stateLabel } from '../biology'
import { MoleculeRenderer } from './MoleculeRenderer'
import { useCanvasDisplay } from './CanvasDisplayContext'

const positions: Record<PortDefinition['side'], Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

const portHelp = (port: PortDefinition) => `${port.role === 'source' ? '이 포트에서 다른 개체의 호환 포트로 드래그하면 상호작용 선을 만듭니다.' : '다른 개체의 호환 포트를 이곳으로 드래그하면 상호작용 선을 만듭니다.'} ${port.semantic} 계열 포트이며 허용 관계는 ${port.allowedInteractions.join(', ')}입니다.`

const action = (id: string, name: string) => window.dispatchEvent(new CustomEvent('bioscene:object-action', { detail: { id, action: name } }))

export function BioNode({ id, data, selected }: NodeProps<BioNodeType>) {
  const display = useCanvasDisplay()
  const definition = display.molecules.find((item) => item.id === data.moleculeId)
  const showNames = display.overlays.names || data.showName === true
  const tooltip = [data.label, data.subtitle, data.state ? `State: ${stateLabel(data)}` : '', data.compartment].filter(Boolean).join('\n')

  return (
    <div title={tooltip} className={`bio-node bio-${data.kind} view-${display.mode} ${display.overlays.ports ? 'show-ports' : ''} ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${data.membraneAnchor ? 'is-membrane-anchored' : ''} ${selected ? 'is-selected' : ''}`} style={data.membraneAnchor ? { transform:`rotate(${data.membraneAnchor.angle}deg)` } : undefined}>
      <NodeResizer isVisible={selected && !data.locked} minWidth={90} minHeight={46} lineClassName="selection-resize-line" handleClassName="selection-resize-handle" />
      <NodeToolbar isVisible={selected} className="selection-mini-toolbar" data-export-exclude="true">
        {['receptor','ligand','antibody'].includes(data.kind) && <button onClick={() => action(id, 'edit')}><Pencil size={13}/> Structure</button>}
        <button onClick={() => action(id, 'asset')}><Image size={13}/> Asset</button><button onClick={() => action(id, 'duplicate')}><Copy size={13}/> Duplicate</button><button className="danger" onClick={() => action(id, 'delete')}><Trash2 size={13}/> Delete</button>
      </NodeToolbar>
      {data.ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type={port.role}
          position={positions[port.side]}
          className={`bio-handle handle-${port.semantic}`}
          data-export-exclude="true"
          data-help={portHelp(port)}
          title={`${port.semantic}: ${port.id} · ${port.allowedInteractions.join('/')}`}
        />
      ))}
      <div className="bio-node-icon structural-icon" style={{ transform:`rotate(${data.visualRotation ?? 0}deg) scale(${data.visualScale ?? 1})` }}><MoleculeRenderer data={data} definition={definition}/></div>
      {showNames && <div className="bio-node-copy">
        <strong>{data.label}</strong>
        {display.overlays.functions && data.subtitle && <small>{data.subtitle}</small>}
      </div>}
      {display.overlays.state && data.state && <span className="state-pill">{stateLabel(data)}</span>}
      {display.overlays.domains && data.domains.length > 0 && <div className="canvas-domain-strip">{data.domains.slice(0,3).map((domain)=><span key={domain.id}>{domain.label}</span>)}</div>}
      {display.overlays.debug && data.provenance === 'inferred' && <span className="provenance-badge" data-help="사용자 문장에 직접 쓰이지 않았지만 알려진 기전 경로를 완성하기 위해 파서가 추론한 개체입니다.">INFERRED</span>}
      {display.overlays.ids && <code className="canvas-object-id">{id}</code>}
      {display.overlays.anchors && data.anchors.map((anchor)=><span key={anchor.id} className="canvas-anchor" title={`${anchor.type} · ${anchor.compartment}`}/>) }
    </div>
  )
}
