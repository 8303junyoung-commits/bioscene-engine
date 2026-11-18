import { NodeResizer, NodeToolbar, type NodeProps } from '@xyflow/react'
import { useId, useState } from 'react'
import { Copy, Sparkles, Trash2 } from 'lucide-react'
import { CELL_THEMES, inferCellTheme } from '../studioPresets'
import type { BioNode, CellColorTheme, CellShapeStyle } from '../types'
import { useCanvasDisplay } from './CanvasDisplayContext'

const dispatchObjectAction = (id: string, actionName: string, payload?: Record<string, unknown>) =>
  window.dispatchEvent(new CustomEvent('bioscene:object-action', { detail: { id, action: actionName, ...payload } }))

export function CellNode({ id, data, selected }: NodeProps<BioNode>) {
  const display = useCanvasDisplay()
  const uidPrefix = useId().replace(/:/g, '')
  const [editingLabel, setEditingLabel] = useState(false)
  const [draftLabel, setDraftLabel] = useState(data.label)

  const shape: CellShapeStyle = data.cellShape ?? 'membrane_zoom'
  const themeKey: CellColorTheme = data.cellTheme ?? inferCellTheme(data.label)
  const palette = CELL_THEMES[themeKey]
  const showCompartments = display.overlays.compartments && data.showCompartmentLabels !== false
  const showNames = display.simple ? data.showName !== false : display.overlays.names || data.showName !== false
  const panelLabel =
    data.panelId === 'untreated'
      ? '비처리 (UNTREATED)'
      : data.panelId === 'treated'
        ? '약물 처치 (TREATED)'
        : data.panelId === 'tissue'
          ? 'TISSUE'
          : undefined

  const commitRename = () => {
    setEditingLabel(false)
    const trimmed = draftLabel.trim()
    if (trimmed && trimmed !== data.label) {
      dispatchObjectAction(id, 'patch', { patch: { label: trimmed } })
    }
  }

  return (
    <div
      className={`cell-node cell-shape-${shape} cell-theme-${themeKey} ${data.simpleCell ? 'simple-cell' : ''} scene-${data.sceneType ?? 'full_signaling'} ${data.provenance === 'inferred' ? 'is-inferred' : ''} ${selected ? 'is-selected' : ''}`}
      data-visual-detail={display.visualDetail}
    >
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={420}
        minHeight={320}
        lineClassName="selection-resize-line"
        handleClassName="selection-resize-handle"
      />
      <NodeToolbar isVisible={selected} className="selection-mini-toolbar cell-floating-toolbar" data-export-exclude="true">
        <div className="mini-chip-group" title="세포 표현 형태">
          {([
            ['membrane_zoom', '막 단면'],
            ['round_cell', '원형 세포'],
            ['tumor_cell', '종양형'],
          ] as const).map(([value, text]) => (
            <button
              key={value}
              className={shape === value ? 'is-active' : ''}
              onClick={() => dispatchObjectAction(id, 'patch', { patch: { cellShape: value } })}
            >
              {text}
            </button>
          ))}
        </div>
        <span className="mini-divider" />
        <div className="mini-swatch-group" title="세포 색상 테마">
          {(Object.keys(CELL_THEMES) as CellColorTheme[]).map((t) => (
            <button
              key={t}
              aria-label={`Theme ${t}`}
              className={`swatch-dot ${themeKey === t ? 'is-active' : ''}`}
              style={{ background: CELL_THEMES[t].headFill }}
              onClick={() => dispatchObjectAction(id, 'patch', { patch: { cellTheme: t } })}
            />
          ))}
        </div>
        <span className="mini-divider" />
        <button
          title="미토콘드리아·엔도좀 표시 전환"
          onClick={() => dispatchObjectAction(id, 'patch', { patch: { showOrganelles: !data.showOrganelles } })}
        >
          <Sparkles size={13} /> {data.showOrganelles ? '소기관 숨김' : '소기관 표시'}
        </button>
        <button onClick={() => dispatchObjectAction(id, 'duplicate')}>
          <Copy size={13} /> 복제
        </button>
        <button className="danger" onClick={() => dispatchObjectAction(id, 'delete')}>
          <Trash2 size={13} /> 삭제
        </button>
      </NodeToolbar>

      {panelLabel && <span className={`panel-label panel-${data.panelId ?? 'single'}`}>{panelLabel}</span>}

      {/* Morphology A: BioRender-style Membrane Cross-Section Zoom */}
      {shape === 'membrane_zoom' && (
        <>
          {!['intracellular', 'environment'].includes(data.sceneType ?? '') && (
            <div className="zone zone-extracellular">
              <span>{showCompartments ? 'EXTRACELLULAR SPACE' : ''}</span>
            </div>
          )}

          {data.sceneType !== 'ecm_membrane' && (
            <div
              className="zone zone-cytoplasm studio-cytoplasm-dome"
              style={{
                background: `radial-gradient(ellipse at 35% 32%, ${palette.cytoplasmStart} 0%, ${palette.cytoplasmEnd} 100%)`,
                borderColor: palette.border,
              }}
            >
              <span>{showCompartments ? 'CYTOPLASM' : ''}</span>
            </div>
          )}

          {/* Authentic Double-Leaflet Phospholipid Bilayer SVG Strip */}
          {!['intracellular', 'environment'].includes(data.sceneType ?? '') && (
            <div className="zone zone-membrane studio-bilayer-strip">
              <svg width="100%" height="26" preserveAspectRatio="none" className="bilayer-svg" aria-hidden="true">
                <defs>
                  <pattern id={`${uidPrefix}-lipid`} x="0" y="0" width="12" height="26" patternUnits="userSpaceOnUse">
                    <rect x="0" y="5" width="12" height="16" fill={palette.lipidCore} />
                    {/* Hydrophobic fatty-acid tails */}
                    <path d="M4.2 8.5 C3.4 11, 4.8 12, 4.2 13 M7.8 8.5 C8.6 11, 7.2 12, 7.8 13" stroke={palette.tailStroke} strokeWidth="1.2" fill="none" />
                    <path d="M4.2 17.5 C3.4 15, 4.8 14, 4.2 13 M7.8 17.5 C8.6 15, 7.2 14, 7.8 13" stroke={palette.tailStroke} strokeWidth="1.2" fill="none" />
                    {/* Outer & inner leaflet hydrophilic phosphate heads */}
                    <circle cx="6" cy="5" r="4.1" fill={palette.headFill} stroke={palette.headStroke} strokeWidth="1" />
                    <circle cx="4.7" cy="3.8" r="1.2" fill="rgba(255,255,255,0.45)" />
                    <circle cx="6" cy="21" r="4.1" fill={palette.headFill} stroke={palette.headStroke} strokeWidth="1" />
                    <circle cx="4.7" cy="19.8" r="1.2" fill="rgba(255,255,255,0.35)" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="100%" height="26" rx="12" fill={`url(#${uidPrefix}-lipid)`} />
              </svg>
              {showCompartments && <span className="bilayer-caption">PLASMA MEMBRANE</span>}
            </div>
          )}

          {/* Double-envelope Nucleus with Nuclear Pores & Chromatin */}
          {data.sceneType !== 'ecm_membrane' && (
            <div className="zone zone-nucleus studio-nucleus">
              <svg viewBox="0 0 280 140" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <radialGradient id={`${uidPrefix}-nuc`} cx="38%" cy="38%" r="65%">
                    <stop offset="0%" stopColor={palette.nucleusStart} />
                    <stop offset="100%" stopColor={palette.nucleusEnd} />
                  </radialGradient>
                </defs>
                <ellipse cx="140" cy="70" rx="134" ry="64" fill={`url(#${uidPrefix}-nuc)`} stroke={palette.nucleusBorder} strokeWidth="3.2" strokeDasharray="28 7" />
                <ellipse cx="140" cy="70" rx="127" ry="58" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" />
                {/* Nucleolus & subtle chromatin */}
                <ellipse cx="96" cy="68" rx="22" ry="15" fill={palette.nucleusBorder} fillOpacity="0.22" />
              </svg>
              <span>{showCompartments ? 'NUCLEUS' : ''}</span>
            </div>
          )}

          {/* Optional Mitochondria & Endosome Organelles */}
          {data.showOrganelles && !['ecm_membrane', 'environment'].includes(data.sceneType ?? '') && (
            <>
              <div className="organelle organelle-endosome studio-organelle">
                <svg viewBox="0 0 90 56" width="84" height="52" aria-hidden="true">
                  <ellipse cx="45" cy="28" rx="38" ry="22" fill="#fef3c7" fillOpacity="0.72" stroke="#d97706" strokeWidth="2" strokeDasharray="6 3" />
                  <circle cx="32" cy="25" r="5" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
                  <circle cx="54" cy="31" r="4" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
                </svg>
                <span>{showCompartments ? 'ENDOSOME' : ''}</span>
              </div>
              <div className="organelle organelle-mitochondria studio-organelle">
                <svg viewBox="0 0 110 54" width="104" height="50" aria-hidden="true">
                  <rect x="6" y="8" width="98" height="38" rx="19" fill="#fed7aa" fillOpacity="0.8" stroke="#ea580c" strokeWidth="2" />
                  <path d="M20 27 C26 14, 32 40, 38 27 C44 14, 50 40, 56 27 C62 14, 68 40, 74 27 C80 14, 86 40, 92 27" fill="none" stroke="#c2410c" strokeWidth="1.8" />
                </svg>
                <span>{showCompartments ? 'MITOCHONDRIA' : ''}</span>
              </div>
            </>
          )}
        </>
      )}

      {/* Morphology B & C: Whole Round Immune Cell or Pleomorphic Tumor Cell */}
      {(shape === 'round_cell' || shape === 'tumor_cell') && (
        <svg className="whole-cell-svg" viewBox="0 0 400 360" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id={`${uidPrefix}-whole`} cx="36%" cy="34%" r="68%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
              <stop offset="28%" stopColor={palette.cytoplasmStart} />
              <stop offset="100%" stopColor={palette.cytoplasmEnd} />
            </radialGradient>
          </defs>
          {shape === 'round_cell' ? (
            <>
              <ellipse cx="200" cy="184" rx="174" ry="152" fill={`url(#${uidPrefix}-whole)`} stroke={palette.headFill} strokeWidth="5.5" />
              <ellipse cx="200" cy="184" rx="166" ry="144" fill="none" stroke={palette.lipidCore} strokeWidth="2.5" />
              <ellipse cx="218" cy="204" rx="88" ry="74" fill={palette.nucleusEnd} fillOpacity="0.82" stroke={palette.nucleusBorder} strokeWidth="2.6" strokeDasharray="22 6" />
              <circle cx="198" cy="196" r="18" fill={palette.nucleusBorder} fillOpacity="0.25" />
            </>
          ) : (
            <>
              <path
                d="M72 118 C42 62, 126 24, 198 38 C264 16, 354 52, 362 126 C388 186, 358 278, 294 316 C234 352, 134 344, 78 298 C24 252, 38 176, 72 118 Z"
                fill={`url(#${uidPrefix}-whole)`}
                stroke={palette.headFill}
                strokeWidth="5.5"
              />
              <path
                d="M80 123 C54 72, 130 36, 198 48 C260 28, 342 60, 350 128 C374 184, 346 270, 286 304 C232 338, 138 330, 86 288 C38 246, 50 176, 80 123 Z"
                fill="none"
                stroke={palette.lipidCore}
                strokeWidth="2.4"
              />
              <path
                d="M156 162 C142 128, 198 112, 244 132 C288 152, 292 216, 250 246 C208 276, 146 254, 142 208 C138 184, 152 174, 156 162 Z"
                fill={palette.nucleusEnd}
                fillOpacity="0.84"
                stroke={palette.nucleusBorder}
                strokeWidth="2.6"
                strokeDasharray="20 5"
              />
              <circle cx="204" cy="182" r="16" fill={palette.nucleusBorder} fillOpacity="0.3" />
              <circle cx="238" cy="206" r="11" fill={palette.nucleusBorder} fillOpacity="0.26" />
            </>
          )}
        </svg>
      )}

      {/* Clean Cell Name Badge with Double-Click Inline Rename */}
      {showNames && (
        <div
          className={`cell-label studio-cell-badge shape-${shape}`}
          style={{ background: palette.badgeBg, color: palette.badgeText, borderColor: palette.border }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setDraftLabel(data.label)
            setEditingLabel(true)
          }}
          title="더블클릭하여 세포 이름 변경"
        >
          <span className="cell-dot" style={{ background: palette.headFill }} />
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
            <span>{data.label}</span>
          )}
        </div>
      )}
    </div>
  )
}
