import { getBezierPath, Position, type InternalNode } from '@xyflow/react'
import type { BioEdge, BioNode } from './types'

type Geometry = Parameters<typeof getBezierPath>[0]
type NodeLookup = (id: string) => InternalNode<BioNode> | undefined
type EdgeLike = Pick<BioEdge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'data'>

export function hasLabelAbove(data: BioNode['data']) {
  return data.kind === 'antibody' || (data.kind === 'ligand' && data.compartment === 'extracellular')
}

function glyphCenterY(n: InternalNode<BioNode>) {
  const h = n.measured.height ?? 76
  return n.internals.positionAbsolute.y + h / 2
}

function endpoints(edge: EdgeLike, node: NodeLookup, simple: boolean): Geometry | undefined {
  const source = node(edge.source)
  const target = node(edge.target)
  if (!source || !target) return

  // Studio clean glyph perimeter attachment — avoids crossing molecule labels in both modes
  // unless explicit port handles are requested in detailed port-overlay view.
  if (simple || !edge.sourceHandle || edge.sourceHandle.startsWith('simple:') || ['binding-out', 'fab-left', 'fab-right', 'signal-out', 'complex-out', 'transport-out'].includes(edge.sourceHandle)) {
    const sw = source.measured.width ?? 92
    const sh = source.measured.height ?? 78
    const tw = target.measured.width ?? 92
    const th = target.measured.height ?? 78

    const sxCenter = source.internals.positionAbsolute.x + sw / 2
    const syCenter = glyphCenterY(source)
    const txCenter = target.internals.positionAbsolute.x + tw / 2
    const tyCenter = glyphCenterY(target)

    const dx = txCenter - sxCenter
    const dy = tyCenter - syCenter
    const inhibitory = ['BLOCK', 'INHIBIT'].includes(edge.data?.interaction ?? '')
    const clearance = inhibitory ? 6 : 3

    if (edge.data?.indirect) {
      return {
        sourceX: source.internals.positionAbsolute.x + sw - 10,
        sourceY: syCenter,
        targetX: target.internals.positionAbsolute.x + tw - 10,
        targetY: tyCenter,
        sourcePosition: Position.Right,
        targetPosition: Position.Right,
      }
    }

    // Primarily horizontal relationship (e.g. bispecific cell-cell bridge, receptor dimerization, lateral cytokine capture)
    if (Math.abs(dx) > Math.abs(dy) * 1.35 && Math.abs(dy) < 95) {
      const goingRight = dx >= 0
      return {
        sourceX: goingRight ? source.internals.positionAbsolute.x + sw - 10 : source.internals.positionAbsolute.x + 10,
        sourceY: syCenter,
        targetX: goingRight ? target.internals.positionAbsolute.x + 10 + (inhibitory ? -clearance : 0) : target.internals.positionAbsolute.x + tw - 10 + (inhibitory ? clearance : 0),
        targetY: tyCenter,
        sourcePosition: goingRight ? Position.Right : Position.Left,
        targetPosition: goingRight ? Position.Left : Position.Right,
      }
    }

    // Primarily vertical relationship
    if (dy >= 0) {
      // Downward: label-above nodes (antibodies/cytokines) have unobstructed bottom Fab/ligand tips;
      // label-below nodes (receptors/kinases) place their label pill ~22px below the box.
      const sourceBottom = source.internals.positionAbsolute.y + (hasLabelAbove(source.data) ? sh - 6 : sh + 22)
      const targetTop = target.internals.positionAbsolute.y + (hasLabelAbove(target.data) ? -22 : 6) - clearance
      return {
        sourceX: sxCenter,
        sourceY: sourceBottom,
        targetX: txCenter,
        targetY: Math.max(sourceBottom + 12, targetTop),
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
    } else {
      // Upward
      const sourceTop = source.internals.positionAbsolute.y + (hasLabelAbove(source.data) ? -22 : 6)
      const targetBottom = target.internals.positionAbsolute.y + (hasLabelAbove(target.data) ? th - 6 : th + 22) + clearance
      return {
        sourceX: sxCenter,
        sourceY: sourceTop,
        targetX: txCenter,
        targetY: Math.min(sourceTop - 12, targetBottom),
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
      }
    }
  }

  const point = (n: InternalNode<BioNode>, role: 'source' | 'target', id?: string | null) => {
    const handles = n.internals.handleBounds?.[role]
    const h = id ? handles?.find((handle) => handle.id === id) : handles?.[0]
    if (!h) return
    const x = n.internals.positionAbsolute.x + h.x
    const y = n.internals.positionAbsolute.y + h.y
    return {
      x: x + (h.position === Position.Left ? 0 : h.position === Position.Right ? h.width : h.width / 2),
      y: y + (h.position === Position.Top ? 0 : h.position === Position.Bottom ? h.height : h.height / 2),
      position: h.position,
    }
  }
  const a = point(source, 'source', edge.sourceHandle)
  const b = point(target, 'target', edge.targetHandle)
  if (a && b) {
    return {
      sourceX: a.x,
      sourceY: a.y,
      sourcePosition: a.position,
      targetX: b.x,
      targetY: b.y,
      targetPosition: b.position,
    }
  }
}

export function blockadeJunction(path: ReturnType<typeof getBezierPath>) {
  const p = path[0].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number)
  if (!p || p.length !== 8) return { x: path[1], y: path[2] }
  const t = 2 / 3
  const u = 1 - t
  return {
    x: u ** 3 * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t ** 3 * p[6],
    y: u ** 3 * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t ** 3 * p[7],
  }
}

export function interactionPath(
  edge: EdgeLike,
  node: NodeLookup,
  getEdge: (id: string) => BioEdge | undefined,
  simple: boolean,
  fallback?: Geometry,
  seen = new Set<string>(),
): ReturnType<typeof getBezierPath> | undefined {
  if (seen.has(edge.id)) return
  seen.add(edge.id)
  const geometry = endpoints(edge, node, simple) ?? fallback
  if (!geometry) return
  const blockedId = edge.data?.blockedEdgeId
  if (blockedId) {
    const blocked = getEdge(blockedId)
    const path = blocked && interactionPath(blocked, node, getEdge, simple, undefined, seen)
    if (!path) return
    const junction = blockadeJunction(path)
    const dx = junction.x - geometry.sourceX
    const dy = junction.y - geometry.sourceY
    const targetPosition =
      Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? Position.Left : Position.Right) : dy >= 0 ? Position.Top : Position.Bottom
    return getBezierPath({ ...geometry, targetX: junction.x, targetY: junction.y, targetPosition })
  }
  return getBezierPath(geometry)
}
