import { Handle, NodeResizer, NodeToolbar, Position, useStore, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { useLayoutEffect, useState } from 'react'
import { Ban, Copy, Link2, RotateCw, Trash2, Zap } from 'lucide-react'
import type { BioNode as BioNodeType, PortDefinition } from '../types'
import { stateLabel } from '../biology'
import { MoleculeRenderer } from './MoleculeRenderer'
import { useCanvasDisplay } from './CanvasDisplayContext'
import { hasLabelAbove } from '../interactionGeometry'

const positions: Record<PortDefinition['side'], Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

const portHelp = (port: PortDefinition) =>
  `${port.role === 'source' ? '이 포트에서 드래그해 연결선을 만듭니다.' : '다른 분자에서 이곳으로 드래그해 연결합니다.'} (${port.allowedInteractions.join(', ')})`

const dispatchObjectAction = (id: string, actionName: string, payload?: Record<string, unknown>) =>
  window.dispatchEvent(new CustomEvent('bioscene:object-action', { detail: { id, action: actionName, ...payload } }))

export function BioNode({ id, data, selected }: NodeProps<BioNodeType>) {
  const display = useCanvasDisplay()
  const updateNodeInternals = useUpdateNodeInternals()
  const [editingLabel, setEditingLabel] = useState(false)
  const [draftLabel, setDraftLabel] = useState(data.label)

  const portGeometry = data.ports.map((port) => `${port.id}:${port.role}:${port.side}`).join('|')
  useLayoutEffect(() => {
    updateNodeInternals(id)
  }, [id, portGeometry, updateNodeInternals])

  // Auto-aim antibody Fab arms toward connected target(s) when autoAimTarget !== false and manual rotation is 0
  const autoAimDeg = useStore((state) => {
    if (data.kind !== 'antibody' || data.autoAimTarget === false || (data.visualRotation ?? 0) !== 0) return 0
    const self = state.nodeLookup.get(id)
    if (!self) return 0
    const outgoing = state.edges.filter(
      (e) => e.source === id && ['BIND', 'BLOCK', 'AGONIZE', 'COMPETE'].includes(String((e.data as Record<string, unknown> | undefined)?.interaction ?? 'BIND')),
    )
    if (!outgoing.length) return 0
    const sx = self.internals.positionAbsolute.x + (self.measured.width ?? 92) / 2
    const sy = self.internals.positionAbsolute.y + (self.measured.height ?? 78) / 2
    let ux = 0
    let uy = 0
    for (const edge of outgoing) {
      const targetNode = state.nodeLookup.get(edge.target)
      if (!targetNode) continue
      const tx = targetNode.internals.positionAbsolute.x + (targetNode.measured.width ?? 92) / 2
      const ty = targetNode.internals.positionAbsolute.y + (targetNode.measured.height ?? 78) / 2
      const dx = tx - sx
      const dy = ty - sy
      const len = Math.hypot(dx, dy) || 1
      ux += dx / len
      uy += dy / len
    }
    if (Math.hypot(ux, uy) < 0.15) return 0
    // Native IgGGlyph Fab arms point straight down (+Y = 90deg)
    const raw = (Math.atan2(uy, ux) * 180) / Math.PI - 90
    return Math.round(((raw + 540) % 360) - 180)
  })

  const definition = display.molecules.find((item) => item.id === data.moleculeId)
  const showNames = display.simple ? data.showName !== false : display.overlays.names || data.showName === true
  const labelAbove = hasLabelAbove(data)
  const effectiveRotation = (data.visualRotation ?? 0) + autoAimDeg
  const multiplicity = data.visualRepresentation?.count ?? 1
  const tooltip = [data.label, data.subtitle, data.state ? `상태: ${stateLabel(data)}` : '', data.compartment].filter(Boolean).join(' · ')

  const commitRename = () => {
    setEditingLabel(false)
    const trimmed = draftLabel.trim()
    if (trimmed && trimmed !== data.label) {
      dispatchObjectAction(id, 'patch', { patch: { label: trimmed } })
    }
  }

  return (
    <div
      data-visual-detail={display.visualDetail}
      title={tooltip}
      className={`bio-node studio-bio-node bio-${data.kind} ${labelAbove ? 'label-above' : 'label-below'} view-${display.mode} ${display.overlays.ports ? 'show-ports' : ''} ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${data.membraneAnchor ? 'is-membrane-anchored' : ''} ${selected ? 'is-selected' : ''}`}
      style={data.membraneAnchor && data.membraneAnchor.angle ? { transform: `rotate(${data.membraneAnchor.angle}deg)` } : undefined}
    >
      <NodeResizer
        isVisible={!display.simple && selected && !data.locked}
        minWidth={84}
        minHeight={64}
        lineClassName="selection-resize-line"
        handleClassName="selection-resize-handle"
      />

      {/* Sleek Floating Quick-Action Toolbar on Selection */}
      <NodeToolbar isVisible={selected} className="selection-mini-toolbar molecule-floating-toolbar" data-export-exclude="true">
        <button
          className="connect-chip block-chip"
          title="이 분자에서 차단(⊣) 연결 시작"
          onClick={() => dispatchObjectAction(id, 'start-connect', { relation: 'Block' })}
        >
          <Ban size={12} /> 차단 ⊣
        </button>
        <button
          className="connect-chip bind-chip"
          title="이 분자에서 결합 연결 시작"
          onClick={() => dispatchObjectAction(id, 'start-connect', { relation: 'Bind' })}
        >
          <Link2 size={12} /> 결합
        </button>
        <button
          className="connect-chip signal-chip"
          title="이 분자에서 활성화(→) 신호 연결 시작"
          onClick={() => dispatchObjectAction(id, 'start-connect', { relation: 'Signal' })}
        >
          <Zap size={12} /> 신호 →
        </button>
        <span className="mini-divider" />
        <button
          title="45° 회전"
          onClick={() => {
            const next = (((data.visualRotation ?? 0) + 45 + 180) % 360) - 180
            dispatchObjectAction(id, 'patch', { patch: { visualRotation: next } })
          }}
        >
          <RotateCw size={12} /> 회전
        </button>
        {['receptor', 'signal', 'transcription'].includes(data.kind) && (
          <button
            className={data.phosphorylated ? 'is-active' : ''}
            title="인산화(P) 배지 표시 전환"
            onClick={() => dispatchObjectAction(id, 'patch', { patch: { phosphorylated: !data.phosphorylated } })}
          >
            +P
          </button>
        )}
        <button
          title="크기 키우기"
          onClick={() => {
            const cur = data.visualScale ?? 1
            const next = cur >= 1.45 ? 0.85 : Number((cur + 0.15).toFixed(2))
            dispatchObjectAction(id, 'patch', { patch: { visualScale: next } })
          }}
        >
          {Math.round((data.visualScale ?? 1) * 100)}%
        </button>
        <button title="복제 (⌘D)" onClick={() => dispatchObjectAction(id, 'duplicate')}>
          <Copy size={12} />
        </button>
        <button className="danger" title="삭제 (Delete)" onClick={() => dispatchObjectAction(id, 'delete')}>
          <Trash2 size={12} />
        </button>
      </NodeToolbar>

      {data.ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type={port.role}
          position={positions[port.side]}
          className={`bio-handle handle-${port.semantic}`}
          data-export-exclude="true"
          data-help={portHelp(port)}
          title={`${port.semantic}: ${port.id} · ${port.allowedInteractions.join('/')}`}
        />
      ))}

      {labelAbove && showNames && (
        <div
          className="bio-node-copy studio-label-pill"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setDraftLabel(data.label)
            setEditingLabel(true)
          }}
          title="더블클릭하여 이름 수정"
        >
          {editingLabel ? (
            <input
              className="inline-rename-input"
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditingLabel(false)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <strong>{data.label}</strong>
          )}
          {display.overlays.functions && data.subtitle && <small>{data.subtitle}</small>}
        </div>
      )}

      <div
        className="bio-node-icon structural-icon studio-glyph-box"
        style={{ transform: `rotate(${effectiveRotation}deg) scale(${data.visualScale ?? 1})` }}
      >
        <MoleculeRenderer data={data} definition={definition} />
      </div>

      {!labelAbove && showNames && (
        <div
          className="bio-node-copy studio-label-pill"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setDraftLabel(data.label)
            setEditingLabel(true)
          }}
          title="더블클릭하여 이름 수정"
        >
          {editingLabel ? (
            <input
              className="inline-rename-input"
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditingLabel(false)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <strong>{data.label}</strong>
          )}
          {display.overlays.functions && data.subtitle && <small>{data.subtitle}</small>}
        </div>
      )}

      {multiplicity > 1 && display.overlays.debug && <span className="count-pill">×{multiplicity}</span>}
      {display.overlays.state && data.state && <span className="state-pill">{stateLabel(data)}</span>}
      {display.overlays.domains && data.domains.length > 0 && (
        <div className="canvas-domain-strip">
          {data.domains.slice(0, 3).map((domain) => (
            <span key={domain.id}>{domain.label}</span>
          ))}
        </div>
      )}
      {display.overlays.debug && data.provenance === 'inferred' && <span className="provenance-badge">INFERRED</span>}
      {display.overlays.ids && <code className="canvas-object-id">{id}</code>}
    </div>
  )
}
