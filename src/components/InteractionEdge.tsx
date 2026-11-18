import { BaseEdge, EdgeLabelRenderer, useInternalNode, useReactFlow, useStore, type EdgeProps } from '@xyflow/react'
import type { BioEdge, BioNode } from '../types'
import { interactionPath } from '../interactionGeometry'
import { interactionColors } from '../visualGrammar'
import { useCanvasDisplay } from './CanvasDisplayContext'

export function InteractionEdge(props: EdgeProps<BioEdge>) {
  const display = useCanvasDisplay()
  const flow=useReactFlow<BioNode, BioEdge>()
  const blocked = useStore(state => props.data?.blockedEdgeId ? state.edgeLookup.get(props.data.blockedEdgeId) : undefined)
  // The blocked edge's source can move independently of this BLOCK's endpoints.
  useInternalNode(blocked?.source ?? props.source)
  useInternalNode(blocked?.target ?? props.target)
  const interaction = props.data?.interaction ?? 'BIND'
  const inhibitory=interaction==='BLOCK'||interaction==='INHIBIT'
  const geometry = interactionPath({ ...props, sourceHandle:props.sourceHandleId, targetHandle:props.targetHandleId }, flow.getInternalNode, flow.getEdge, !!display.simple, props)
  if (!geometry) return null // Invalid references are rejected by the export guard.
  const [path, labelX, labelY] = geometry
  const color = interactionColors[interaction]
  const dash = props.data?.indirect || interaction === 'SIGNAL_ABSENT' ? '2 6' : ['TRANSLOCATE', 'SECRETE', 'INTERNALIZE'].includes(interaction) ? '7 5' : interaction === 'COMPETE' ? '3 4' : undefined
  const markerId=`inhibitory-${props.id}`

  return (
    <>
      {inhibitory&&<defs><marker id={markerId} markerWidth="12" markerHeight="16" refX="2" refY="8" orient="auto" markerUnits="userSpaceOnUse"><path className="inhibition-mark" d="M2 1V15" stroke={color} strokeWidth="3"/></marker></defs>}
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={inhibitory?`url(#${markerId})`:props.markerEnd}
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
