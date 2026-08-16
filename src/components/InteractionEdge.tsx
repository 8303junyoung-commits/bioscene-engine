import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { BioEdge } from '../types'
import { interactionColors } from '../visualGrammar'
import { useCanvasDisplay } from './CanvasDisplayContext'

export function InteractionEdge(props: EdgeProps<BioEdge>) {
  const display = useCanvasDisplay()
  const [path, labelX, labelY] = getBezierPath(props)
  const interaction = props.data?.interaction ?? 'BIND'
  const color = interactionColors[interaction]
  const dash = interaction === 'SIGNAL_ABSENT' ? '2 6' : ['TRANSLOCATE', 'SECRETE', 'INTERNALIZE'].includes(interaction) ? '7 5' : interaction === 'COMPETE' ? '3 4' : undefined

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={{ stroke: color, strokeWidth: props.selected ? 3.2 : 2.1, strokeDasharray: dash }}
      />
      {display.overlays.interactionLabels && <EdgeLabelRenderer>
        <div
          className={`edge-label edge-${interaction.toLowerCase()}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {interaction}
          {(interaction === 'BLOCK' || interaction === 'INHIBIT') && <span className="block-mark">⊣</span>}
          {interaction === 'SIGNAL_ABSENT' && <span className="block-mark"> Ø</span>}
          {props.data?.evidence && <span className={`evidence-dot evidence-${props.data.evidence.status}`} title={`Evidence: ${props.data.evidence.status}`} />}
        </div>
      </EdgeLabelRenderer>}
    </>
  )
}
