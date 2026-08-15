import type { NodeProps } from '@xyflow/react'
import type { BioNode } from '../types'
import { membranePathD } from '../membraneGeometry'

export function MembraneNode({ data, selected, width, height }: NodeProps<BioNode>) {
  const membrane = data.membrane
  if (!membrane) return null
  const path = membranePathD(membrane.path)
  const offset = Math.max(2, membrane.thickness / 2)
  return <div className={`membrane-node membrane-${membrane.style} ${selected ? 'is-selected' : ''}`} data-help="생물학적 막 경계입니다. 선택하면 Inspector에서 세포외/세포질 방향, 막 종류, 표현 방식, 두께와 곡률을 편집할 수 있습니다.">
    <svg viewBox={`0 0 ${width || 1000} ${height || 1000}`} preserveAspectRatio="none" aria-label={`${membrane.name} membrane path`}>
      <path className="membrane-hit" d={path}/>
      {membrane.style === 'simple'
        ? <path className="membrane-band" style={{ strokeWidth: membrane.thickness }} d={path}/>
        : <><path className="membrane-leaflet outer" style={{ transform: `translateY(-${offset}px)` }} d={path}/><path className="membrane-leaflet inner" style={{ transform: `translateY(${offset}px)` }} d={path}/>{membrane.style === 'detailed' && <path className="membrane-lipids" style={{ strokeWidth: Math.max(8, membrane.thickness * 2) }} d={path}/>}</>}
    </svg>
    <span className="membrane-side side-a">{membrane.sideA}</span><span className="membrane-side side-b">{membrane.sideB}</span>
  </div>
}
