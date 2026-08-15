import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Activity, CircleDot, Dna, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import type { BioNode as BioNodeType, PortDefinition } from '../types'
import { stateLabel } from '../biology'
import { AssetImage } from './AssetImage'

const positions: Record<PortDefinition['side'], Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

const icons = {
  ligand: Sparkles,
  receptor: CircleDot,
  antibody: ShieldCheck,
  signal: Activity,
  transcription: Dna,
  cell: CircleDot,
  annotation: MessageSquareText,
}

function AntibodyGlyph() {
  return (
    <svg className="antibody-glyph" viewBox="0 0 42 42" aria-hidden="true">
      <path d="M21 35V20M21 21 9 7M21 21 33 7" />
      <path d="M6 10 11 5M30 5l5 5" />
    </svg>
  )
}

export function BioNode({ data, selected }: NodeProps<BioNodeType>) {
  const Icon = icons[data.kind]
  const isAntibody = data.kind === 'antibody'
  const fallbackIcon = isAntibody ? <AntibodyGlyph /> : <Icon size={19} strokeWidth={1.8} />

  return (
    <div className={`bio-node bio-${data.kind} ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${selected ? 'is-selected' : ''}`}>
      {data.ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type={port.role}
          position={positions[port.side]}
          className={`bio-handle handle-${port.semantic}`}
          title={`${port.semantic}: ${port.id} · ${port.allowedInteractions.join('/')}`}
        />
      ))}
      <div className="bio-node-icon">{data.asset ? <AssetImage file={data.asset.file} alt="" fallback={fallbackIcon} /> : fallbackIcon}</div>
      <div className="bio-node-copy">
        <strong>{data.label}</strong>
        {data.subtitle && <small>{data.subtitle}</small>}
      </div>
      {data.state && <span className="state-pill">{stateLabel(data)}</span>}
      {data.provenance === 'inferred' && <span className="provenance-badge" title="Inferred by the mechanism parser">INFERRED</span>}
    </div>
  )
}
