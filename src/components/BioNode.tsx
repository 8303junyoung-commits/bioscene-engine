import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Activity, CircleDot, Dna, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import type { BioNode as BioNodeType, PortDefinition } from '../types'
import { stateLabel } from '../biology'
import { AssetImage } from './AssetImage'
import { StructureGlyph } from './StructureGlyph'

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
  membrane: CircleDot,
}

function AntibodyGlyph() {
  return (
    <svg className="antibody-glyph" viewBox="0 0 42 42" aria-hidden="true">
      <path d="M21 35V20M21 21 9 7M21 21 33 7" />
      <path d="M6 10 11 5M30 5l5 5" />
    </svg>
  )
}

const portHelp = (port: PortDefinition) => `${port.role === 'source' ? '이 포트에서 다른 개체의 호환 포트로 드래그하면 상호작용 선을 만듭니다.' : '다른 개체의 호환 포트를 이곳으로 드래그하면 상호작용 선을 만듭니다.'} ${port.semantic} 계열 포트이며 허용 관계는 ${port.allowedInteractions.join(', ')}입니다.`

export function BioNode({ data, selected }: NodeProps<BioNodeType>) {
  const Icon = icons[data.kind]
  const isAntibody = data.kind === 'antibody'
  const fallbackIcon = isAntibody ? <AntibodyGlyph /> : <Icon size={19} strokeWidth={1.8} />

  return (
    <div className={`bio-node bio-${data.kind} ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${data.membraneAnchor ? 'is-membrane-anchored' : ''} ${selected ? 'is-selected' : ''}`} style={data.membraneAnchor ? { transform: `rotate(${data.membraneAnchor.angle}deg)` } : undefined}>
      {data.ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type={port.role}
          position={positions[port.side]}
          className={`bio-handle handle-${port.semantic}`}
          data-help={portHelp(port)}
          title={`${port.semantic}: ${port.id} · ${port.allowedInteractions.join('/')}`}
        />
      ))}
      <div className="bio-node-icon structural-icon">{data.asset ? <AssetImage file={data.asset.file} alt="" fallback={<StructureGlyph data={data}/>} /> : ['receptor','ligand','antibody'].includes(data.kind) ? <StructureGlyph data={data}/> : fallbackIcon}</div>
      <div className="bio-node-copy">
        <strong>{data.label}</strong>
        {data.subtitle && <small>{data.subtitle}</small>}
      </div>
      {data.state && <span className="state-pill">{stateLabel(data)}</span>}
      {data.provenance === 'inferred' && <span className="provenance-badge" data-help="사용자 문장에 직접 쓰이지 않았지만 알려진 기전 경로를 완성하기 위해 파서가 추론한 개체입니다. 점선 테두리로 구분되며 리뷰 ZIP의 PROVENANCE.csv에도 inferred로 기록됩니다.">INFERRED</span>}
    </div>
  )
}
