import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import type { BioEdge, BioNode } from '../types'

type Props = {
  nodes: BioNode[]
  edges: BioEdge[]
  selectedIds: string[]
  open: boolean
  onOpen: () => void
  onSelect: (id: string, kind: 'node' | 'edge') => void
  onVisibility: (id: string) => void
  onLock: (id: string) => void
}

export function LayersPanel({ nodes, edges, selectedIds, open, onOpen, onSelect, onVisibility, onLock }: Props) {
  const roots = nodes.filter((node) => !node.parentId)
  const children = (parentId: string) => nodes.filter((node) => node.parentId === parentId)
  const Row = ({ node, nested = false }: { node: BioNode; nested?: boolean }) => <div className={`layer-row ${nested ? 'nested' : ''} ${selectedIds.includes(node.id) ? 'selected' : ''}`}>
    <button className="layer-name" onClick={() => onSelect(node.id, 'node')} title={node.id}><span className={`layer-kind kind-${node.data.kind}`}/><span>{node.data.label}</span></button>
    <button aria-label={node.hidden ? 'Show object' : 'Hide object'} onClick={() => onVisibility(node.id)}>{node.hidden ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
    <button aria-label={node.data.locked ? 'Unlock object' : 'Lock object'} onClick={() => onLock(node.id)}>{node.data.locked ? <Lock size={13}/> : <Unlock size={13}/>}</button>
  </div>
  return <aside className={open ? 'layers-panel open' : 'layers-panel'} data-export-exclude="true">
    <button className="layers-toggle" onClick={onOpen}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Layers <b>{nodes.length + edges.length}</b></button>
    {open && <div className="layers-content">
      {roots.map((node) => <div key={node.id}><Row node={node}/>{children(node.id).map((child) => <Row key={child.id} node={child} nested/>)}</div>)}
      {!!edges.length && <><div className="layers-section">Interactions</div>{edges.map((edge) => <button key={edge.id} className={`layer-edge ${selectedIds.includes(edge.id) ? 'selected' : ''}`} onClick={() => onSelect(edge.id, 'edge')}><span>↗</span>{edge.data?.interaction ?? 'Interaction'}</button>)}</>}
    </div>}
  </aside>
}
