import { getBezierPath, Position, type InternalNode } from '@xyflow/react'
import type { BioEdge, BioNode } from './types'

type Geometry = Parameters<typeof getBezierPath>[0]
type NodeLookup = (id: string) => InternalNode<BioNode> | undefined
type EdgeLike = Pick<BioEdge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'data'>

function endpoints(edge: EdgeLike, node: NodeLookup, simple: boolean): Geometry | undefined {
  const source = node(edge.source), target = node(edge.target)
  if (!source || !target) return
  if (simple) {
    // Shared clean glyph connection geometry, independent of membrane anchors.
    const sourceX = source.internals.positionAbsolute.x + (source.measured.width ?? 92) / 2
    const targetX = target.internals.positionAbsolute.x + (target.measured.width ?? 92) / 2
    const inhibitory = ['BLOCK', 'INHIBIT', 'ACTIVATE'].includes(edge.data?.interaction ?? '')
    const clearance = inhibitory ? (target.data.kind === 'receptor' ? 10 : 16) : 0
    return { sourceX, sourceY: source.internals.positionAbsolute.y + 34,
      targetX, targetY: target.internals.positionAbsolute.y + 34 - clearance,
      sourcePosition: edge.data?.indirect ? Position.Right : Position.Bottom,
      targetPosition: edge.data?.indirect ? Position.Right : Position.Top }
  }
  const point = (n: InternalNode<BioNode>, role: 'source' | 'target', id?: string | null) => {
    const handles = n.internals.handleBounds?.[role]
    const h = id ? handles?.find(handle => handle.id === id) : handles?.[0]
    if (!h) return
    const x = n.internals.positionAbsolute.x + h.x, y = n.internals.positionAbsolute.y + h.y
    return { x: x + (h.position === Position.Left ? 0 : h.position === Position.Right ? h.width : h.width / 2),
      y: y + (h.position === Position.Top ? 0 : h.position === Position.Bottom ? h.height : h.height / 2), position: h.position }
  }
  const a = point(source, 'source', edge.sourceHandle), b = point(target, 'target', edge.targetHandle)
  if (a && b) return { sourceX:a.x, sourceY:a.y, sourcePosition:a.position, targetX:b.x, targetY:b.y, targetPosition:b.position }
}

// getBezierPath emits one M/C cubic. Its two-thirds point keeps the inhibition
// mark below a receptor's label on a short receptor→adaptor signal, while still
// terminating exactly on that relationship (not on a fake target node).
export function blockadeJunction(path: ReturnType<typeof getBezierPath>) {
  const p = path[0].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number)
  if (!p || p.length !== 8) return { x:path[1], y:path[2] }
  const t=2/3, u=1-t
  return { x:u**3*p[0]+3*u*u*t*p[2]+3*u*t*t*p[4]+t**3*p[6],
    y:u**3*p[1]+3*u*u*t*p[3]+3*u*t*t*p[5]+t**3*p[7] }
}

// A relationship and a BLOCK aimed at it share the exact path calculation,
// including Signal clearance and Indirect routing.
export function interactionPath(edge: EdgeLike, node: NodeLookup, getEdge: (id: string) => BioEdge | undefined, simple: boolean, fallback?: Geometry, seen = new Set<string>()): ReturnType<typeof getBezierPath> | undefined {
  if (seen.has(edge.id)) return
  seen.add(edge.id)
  const geometry = endpoints(edge, node, simple) ?? fallback
  if (!geometry) return
  const blockedId = edge.data?.blockedEdgeId
  if (blockedId) {
    const blocked = getEdge(blockedId)
    const path = blocked && interactionPath(blocked, node, getEdge, simple, undefined, seen)
    if (!path) return
    const junction=blockadeJunction(path)
    return getBezierPath({ ...geometry, targetX:junction.x, targetY:junction.y, targetPosition:Position.Top })
  }
  return getBezierPath(geometry)
}
