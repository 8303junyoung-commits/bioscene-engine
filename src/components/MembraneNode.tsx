import { NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react'
import { Copy, FlipVertical2, Pencil, Scissors, Trash2 } from 'lucide-react'
import type { BioNode } from '../types'
import { membraneLipidSamples, membranePathD, offsetMembranePoints } from '../membraneGeometry'

const action = (id: string, name: string, detail: Record<string, unknown> = {}) => window.dispatchEvent(new CustomEvent('bioscene:object-action', { detail: { id, action: name, ...detail } }))

export function MembraneNode({ id, data, selected, width, height }: NodeProps<BioNode>) {
  const flow = useReactFlow()
  const membrane = data.membrane
  if (!membrane) return null
  const path = membranePathD(membrane.path)
  const offset = Math.max(2, membrane.thickness / 2)
  const outerPath = membranePathD(offsetMembranePoints(membrane.path,-offset))
  const innerPath = membranePathD(offsetMembranePoints(membrane.path,offset))
  const lipids = membraneLipidSamples(membrane.path,membrane.style==='detailed'?11:17)
  const headRadius=Math.max(1.4,Math.min(2.5,offset*.32)); const tailGap=Math.max(.8,headRadius*.55)
  const startPointDrag = (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation(); event.preventDefault()
    if (event.altKey && membrane.path.length > 2) { action(id, 'remove-point', { index }); return }
    const start = membrane.path[index]; const x = event.clientX; const y = event.clientY; const zoom = flow.getZoom() || 1
    const move = (next: PointerEvent) => action(id, 'move-point', { index, point: { x: start.x + (next.clientX - x) / zoom, y: start.y + (next.clientY - y) / zoom } })
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const addPoint = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!selected) return
    event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect()
    action(id, 'add-point', { point: { x: (event.clientX - rect.left) * ((width || rect.width) / rect.width), y: (event.clientY - rect.top) * ((height || rect.height) / rect.height) } })
  }
  return <div className={`membrane-node membrane-${membrane.style} ${selected ? 'is-selected' : ''}`} data-help="생물학적 막 경계입니다. 클릭하면 경로점이 나타납니다. 점을 드래그해 모양을 바꾸고 Alt+클릭으로 점을 삭제하며, 선을 더블클릭하면 점을 추가합니다.">
    <NodeToolbar isVisible={selected} className="selection-mini-toolbar" data-export-exclude="true">
      <button onClick={() => action(id, 'edit')}><Pencil size={13}/> Edit</button><button onClick={() => action(id, 'straighten')}><Scissors size={13}/> Straighten</button><button onClick={() => action(id, 'flip')}><FlipVertical2 size={13}/> Flip</button><button onClick={() => action(id, 'duplicate')}><Copy size={13}/> Duplicate</button><button className="danger" onClick={() => action(id, 'delete')}><Trash2 size={13}/> Delete</button>
    </NodeToolbar>
    <svg viewBox={`0 0 ${width || 1000} ${height || 1000}`} preserveAspectRatio="none" aria-label={`${membrane.name} membrane path`} onDoubleClick={addPoint}>
      <path className="membrane-hit" d={path}/>
      {membrane.style === 'simple'
        ? <path className="membrane-band" style={{ strokeWidth: membrane.thickness }} d={path}/>
        : <><path className="membrane-core" d={path}/><path className="membrane-leaflet outer" d={outerPath}/><path className="membrane-leaflet inner" d={innerPath}/><g className="membrane-phospholipids">{lipids.map((sample,index)=><g className="phospholipid-pair" key={index} transform={`translate(${sample.point.x} ${sample.point.y}) rotate(${sample.angle-90})`}>
          <circle className="lipid-head outer" cx="0" cy={-offset} r={headRadius}/><line className="lipid-tail" x1={-tailGap} y1={-offset+headRadius} x2={-tailGap*.55} y2="-0.7"/><line className="lipid-tail" x1={tailGap} y1={-offset+headRadius} x2={tailGap*.55} y2="-0.7"/>
          <circle className="lipid-head inner" cx="0" cy={offset} r={headRadius}/><line className="lipid-tail" x1={-tailGap} y1={offset-headRadius} x2={-tailGap*.55} y2="0.7"/><line className="lipid-tail" x1={tailGap} y1={offset-headRadius} x2={tailGap*.55} y2="0.7"/>
        </g>)}</g></>}
    </svg>
    {selected && <div className="membrane-control-points" data-export-exclude="true">{membrane.path.map((point, index) => <button key={`${index}-${point.x}-${point.y}`} className={index === 0 || index === membrane.path.length - 1 ? 'endpoint' : ''} style={{ left: point.x, top: point.y }} onPointerDown={(event) => startPointDrag(event, index)} title={index === 0 || index === membrane.path.length - 1 ? '끝점을 드래그해 막을 연장하거나 줄입니다.' : '드래그해 경로를 수정합니다. Alt+클릭으로 삭제합니다.'}/>)}</div>}
    <span className="membrane-side side-a">{membrane.sideA}</span><span className="membrane-side side-b">{membrane.sideB}</span>
  </div>
}

