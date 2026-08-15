import { AlertTriangle, Lightbulb, MessageSquareText } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'
import type { BioNode } from '../types'

const icons = { info: MessageSquareText, finding: Lightbulb, warning: AlertTriangle }

export function AnnotationNode({ data, selected }: NodeProps<BioNode>) {
  const tone = data.annotation?.tone ?? 'info'
  const Icon = icons[tone]
  return <aside className={`annotation-node annotation-${tone} ${selected ? 'is-selected' : ''}`}>
    <Icon size={17} />
    <div><strong>{data.annotation?.title ?? data.label}</strong><p>{data.annotation?.body ?? data.subtitle}</p></div>
  </aside>
}
