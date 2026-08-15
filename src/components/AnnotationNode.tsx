import { AlertTriangle, Lightbulb, MessageSquareText } from 'lucide-react'
import { NodeResizer, NodeToolbar, type NodeProps } from '@xyflow/react'
import { Copy, Trash2 } from 'lucide-react'
import type { BioNode } from '../types'

const icons = { info: MessageSquareText, finding: Lightbulb, warning: AlertTriangle }

const action = (id: string, name: string) => window.dispatchEvent(new CustomEvent('bioscene:object-action', { detail: { id, action: name } }))

export function AnnotationNode({ id, data, selected }: NodeProps<BioNode>) {
  const tone = data.annotation?.tone ?? 'info'
  const Icon = icons[tone]
  return <aside className={`annotation-node annotation-${tone} ${selected ? 'is-selected' : ''}`}>
    <NodeResizer isVisible={selected && !data.locked} minWidth={150} minHeight={70} lineClassName="selection-resize-line" handleClassName="selection-resize-handle" />
    <NodeToolbar isVisible={selected} className="selection-mini-toolbar" data-export-exclude="true"><button onClick={() => action(id, 'duplicate')}><Copy size={13}/> Duplicate</button><button className="danger" onClick={() => action(id, 'delete')}><Trash2 size={13}/> Delete</button></NodeToolbar>
    <Icon size={17} />
    <div><strong>{data.annotation?.title ?? data.label}</strong><p>{data.annotation?.body ?? data.subtitle}</p></div>
  </aside>
}
