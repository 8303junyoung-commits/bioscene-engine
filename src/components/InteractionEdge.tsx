import { BaseEdge, EdgeLabelRenderer, useInternalNode, useReactFlow, useStore, type EdgeProps } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import type { BioEdge, BioNode, InteractionType } from '../types'
import { interactionPath } from '../interactionGeometry'
import { interactionColors } from '../visualGrammar'
import { useCanvasDisplay } from './CanvasDisplayContext'

const interactionKoreanBadge: Partial<Record<InteractionType, string>> = {
  BIND: '결합',
  BLOCK: '차단 ⊣',
  INHIBIT: '억제 ⊣',
  ACTIVATE: '활성 →',
  PHOSPHORYLATE: '+P 인산화',
  TRANSLOCATE: '이동 ⇢',
  SECRETE: '분비 ⇢',
  INTERNALIZE: '내재화 ⇢',
  SIGNAL_ABSENT: '신호 억제 Ø',
}

const dispatchEdgeAction = (id: string, actionName: string, payload?: Record<string, unknown>) =>
  window.dispatchEvent(new CustomEvent('bioscene:edge-action', { detail: { id, action: actionName, ...payload } }))

export function InteractionEdge(props: EdgeProps<BioEdge>) {
  const display = useCanvasDisplay()
  const flow = useReactFlow<BioNode, BioEdge>()
  const blocked = useStore((state) => (props.data?.blockedEdgeId ? state.edgeLookup.get(props.data.blockedEdgeId) : undefined))
  useInternalNode(blocked?.source ?? props.source)
  useInternalNode(blocked?.target ?? props.target)

  const interaction = props.data?.interaction ?? 'BIND'
  const inhibitory = interaction === 'BLOCK' || interaction === 'INHIBIT'
  const geometry = interactionPath(
    { ...props, sourceHandle: props.sourceHandleId, targetHandle: props.targetHandleId },
    flow.getInternalNode,
    flow.getEdge,
    !!display.simple,
    props,
  )
  if (!geometry) return null
  const [path, labelX, labelY] = geometry
  const color = interactionColors[interaction]
  const dash =
    props.data?.indirect || interaction === 'SIGNAL_ABSENT'
      ? '4 5'
      : ['TRANSLOCATE', 'SECRETE', 'INTERNALIZE'].includes(interaction)
        ? '7 5'
        : interaction === 'COMPETE'
          ? '3 4'
          : undefined
  const markerId = `inhibitory-${props.id}`
  const arrowId = `arrow-${props.id}`
  const hasDirectionalArrow = !inhibitory && !['BIND', 'DIMERIZE', 'CLUSTER', 'COMPETE', 'SIGNAL_ABSENT'].includes(interaction)

  return (
    <>
      <defs>
        {inhibitory && (
          <marker id={markerId} markerWidth="14" markerHeight="18" refX="3" refY="9" orient="auto" markerUnits="userSpaceOnUse">
            <path className="inhibition-mark" d="M3 1.5V16.5" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
            <path className="inhibition-mark" d="M3 1.5V16.5" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
          </marker>
        )}
        {hasDirectionalArrow && (
          <marker id={arrowId} markerWidth="12" markerHeight="12" refX="9.5" refY="6" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M1.5 1.8 L10.2 6 L1.5 10.2 L3.4 6 Z" fill={color} stroke={color} strokeWidth="0.8" strokeLinejoin="round" />
          </marker>
        )}
      </defs>

      {/* Crisp white halo under-stroke so lines crossing membranes stay clean */}
      <path d={path} fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth={props.selected ? 6.8 : 5.2} strokeLinecap="round" pointerEvents="none" />

      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={inhibitory ? `url(#${markerId})` : hasDirectionalArrow ? `url(#${arrowId})` : undefined}
        style={{
          stroke: color,
          strokeWidth: props.selected ? 3.5 : inhibitory ? 2.8 : 2.4,
          strokeDasharray: dash,
          strokeLinecap: 'round',
        }}
      />

      {/* Signal-absent X badge or Phosphorylation +P pill */}
      {(interaction === 'SIGNAL_ABSENT' || interaction === 'PHOSPHORYLATE' || display.overlays.interactionLabels || props.selected) && (
        <EdgeLabelRenderer>
          {props.selected ? (
            <div
              className="edge-floating-toolbar nodrag nopan"
              data-export-exclude="true"
              style={{ transform: `translate(-50%, -135%) translate(${labelX}px, ${labelY}px)` }}
            >
              {([
                ['BLOCK', '차단 ⊣'],
                ['BIND', '결합'],
                ['ACTIVATE', '활성 →'],
                ['PHOSPHORYLATE', '+P'],
                ['TRANSLOCATE', '이동 ⇢'],
                ['SIGNAL_ABSENT', '억제 Ø'],
              ] as const).map(([type, text]) => (
                <button
                  key={type}
                  className={interaction === type ? 'is-active' : ''}
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatchEdgeAction(props.id, 'set-type', { interaction: type })
                  }}
                >
                  {text}
                </button>
              ))}
              <button
                className={props.data?.indirect ? 'is-active' : ''}
                title="점선(간접 경로) 전환"
                onClick={(e) => {
                  e.stopPropagation()
                  dispatchEdgeAction(props.id, 'toggle-indirect')
                }}
              >
                점선
              </button>
              <button
                className="danger"
                title="연결선 삭제"
                onClick={(e) => {
                  e.stopPropagation()
                  dispatchEdgeAction(props.id, 'delete')
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ) : interaction === 'SIGNAL_ABSENT' ? (
            <div
              className="edge-pill-badge edge-absent-pill"
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            >
              ✕
            </div>
          ) : interaction === 'PHOSPHORYLATE' && !display.overlays.interactionLabels ? (
            <div
              className="edge-pill-badge edge-phospho-pill"
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            >
              +P
            </div>
          ) : display.overlays.interactionLabels ? (
            <div
              className={`edge-label edge-${interaction.toLowerCase()}`}
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            >
              {interactionKoreanBadge[interaction] ?? interaction}
              {props.data?.evidence && (
                <span className={`evidence-dot evidence-${props.data.evidence.status}`} title={`Evidence: ${props.data.evidence.status}`} />
              )}
            </div>
          ) : null}
        </EdgeLabelRenderer>
      )}
    </>
  )
}
