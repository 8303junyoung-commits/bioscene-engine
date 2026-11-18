import { useState } from 'react'
import { Ban, Copy, Download, Eye, EyeOff, Link2, RotateCcw, Settings2, Sparkles, Trash2, Zap } from 'lucide-react'
import { CELL_THEMES, inferCellTheme } from '../studioPresets'
import type {
  BioEdge,
  BioNode,
  BioNodePatch,
  CellColorTheme,
  CellShapeStyle,
  Compartment,
  ExportPreset,
  InteractionData,
  InteractionType,
  StylePreset,
} from '../types'
import { MoleculeRenderer } from './MoleculeRenderer'

interface Props {
  nodes: BioNode[]
  edges: BioEdge[]
  selectedNode?: BioNode
  selectedEdge?: BioEdge
  stylePreset: StylePreset
  exportPreset: ExportPreset
  showCompartmentLabels: boolean
  showInteractionLabels: boolean
  onStylePreset: (preset: StylePreset) => void
  onExportPreset: (preset: ExportPreset) => void
  onToggleCompartmentLabels: () => void
  onToggleInteractionLabels: () => void
  onSelectObject: (id: string, kind?: 'node' | 'edge') => void
  onUpdateNode: (patch: BioNodePatch) => void
  onChangeCount: (count: number) => void
  onConnectNodes: (sourceId: string, targetId: string, interaction: InteractionType, blockedEdgeId?: string) => void
  onUpdateEdge: (interaction: InteractionType) => void
  onUpdateEdgeData: (patch: Partial<InteractionData>) => void
  onDuplicateSelected: () => void
  onDeleteSelected: () => void
  onDetachAsset: () => void
  onEditAdvancedStructure: () => void
  onExport: (format: 'svg' | 'png' | 'pptx' | 'package') => void
}

const ACCENT_SWATCHES = ['#7348b8', '#e06348', '#2a8c6f', '#2589bd', '#f59e0b', '#e11d48', '#3b82f6', '#0d9488']

export function StudioInspector({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  stylePreset,
  exportPreset,
  showCompartmentLabels,
  showInteractionLabels,
  onStylePreset,
  onExportPreset,
  onToggleCompartmentLabels,
  onToggleInteractionLabels,
  onSelectObject,
  onUpdateNode,
  onChangeCount,
  onConnectNodes,
  onUpdateEdge,
  onUpdateEdgeData,
  onDuplicateSelected,
  onDeleteSelected,
  onDetachAsset,
  onEditAdvancedStructure,
  onExport,
}: Props) {
  const [quickTargetId, setQuickTargetId] = useState('')
  const [quickInteraction, setQuickInteraction] = useState<InteractionType>('BLOCK')

  const cells = nodes.filter((n) => !n.hidden && n.data.kind === 'cell')
  const molecules = nodes.filter((n) => !n.hidden && !['cell', 'membrane', 'annotation'].includes(n.data.kind))

  // 1. Edge Selected Inspector
  if (selectedEdge) {
    const src = nodes.find((n) => n.id === selectedEdge.source)
    const dst = nodes.find((n) => n.id === selectedEdge.target)
    const curType = selectedEdge.data?.interaction ?? 'BIND'
    return (
      <aside className="studio-inspector" aria-label="상호작용 속성 편집">
        <div className="inspector-header">
          <span className="mini-eyebrow">상호작용 연결선</span>
          <h3>
            {src?.data.label ?? selectedEdge.source} → {dst?.data.label ?? selectedEdge.target}
          </h3>
        </div>

        <section className="inspector-card">
          <label className="card-title">상호작용 의미 · 화살표 모양</label>
          <div className="interaction-type-grid">
            {([
              ['BLOCK', '차단 (⊣)', '#d65c4a'],
              ['BIND', '결합 (—)', '#2f7f67'],
              ['ACTIVATE', '신호 활성 (→)', '#3a6ec4'],
              ['PHOSPHORYLATE', '인산화 (+P)', '#2c7da0'],
              ['INHIBIT', '하위 억제 (⊣)', '#b95043'],
              ['TRANSLOCATE', '핵·막 이동 (⇢)', '#7652b5'],
              ['SECRETE', '세포외 분비 (⇢)', '#4f86b8'],
              ['SIGNAL_ABSENT', '신호 억제됨 (Ø)', '#94a3b8'],
            ] as const).map(([val, label, color]) => (
              <button
                key={val}
                className={`interaction-choice ${curType === val ? 'is-active' : ''}`}
                style={curType === val ? { borderColor: color, background: `${color}14`, color } : undefined}
                onClick={() => onUpdateEdge(val)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="studio-checkbox">
            <input
              type="checkbox"
              checked={Boolean(selectedEdge.data?.indirect)}
              onChange={(e) => onUpdateEdgeData({ indirect: e.target.checked })}
            />
            <span>점선으로 표시 (간접/다단계 경로)</span>
          </label>
        </section>

        <section className="inspector-card">
          <label className="card-title">과학 메모 / 기전 설명</label>
          <input
            placeholder="예: Prevents IL-18Rβ heterodimerization…"
            value={selectedEdge.data?.note ?? ''}
            onChange={(e) => onUpdateEdgeData({ note: e.target.value })}
          />
        </section>

        <button className="studio-danger-btn full-width" onClick={onDeleteSelected}>
          <Trash2 size={14} /> 이 연결선 삭제
        </button>
      </aside>
    )
  }

  // 2. Annotation Selected Inspector
  if (selectedNode?.data.kind === 'annotation') {
    const ann = selectedNode.data.annotation ?? { title: selectedNode.data.label, body: '', tone: 'info' as const }
    return (
      <aside className="studio-inspector" aria-label="텍스트 설명 상자 편집">
        <div className="inspector-header">
          <span className="mini-eyebrow">설명 콜아웃 상자</span>
          <h3>{ann.title || '설명 텍스트'}</h3>
        </div>
        <section className="inspector-card">
          <label>
            제목
            <input
              value={ann.title}
              onChange={(e) => onUpdateNode({ label: e.target.value, annotation: { ...ann, title: e.target.value } })}
            />
          </label>
          <label>
            본문 설명
            <textarea
              rows={4}
              value={ann.body}
              onChange={(e) => onUpdateNode({ annotation: { ...ann, body: e.target.value } })}
            />
          </label>
          <label>
            강조 톤
            <div className="segmented-control">
              {([
                ['info', '기본 안내'],
                ['finding', '핵심 기전'],
                ['warning', '주의/차단'],
              ] as const).map(([tone, text]) => (
                <button
                  key={tone}
                  className={ann.tone === tone ? 'is-active' : ''}
                  onClick={() => onUpdateNode({ annotation: { ...ann, tone } })}
                >
                  {text}
                </button>
              ))}
            </div>
          </label>
        </section>
        <button className="studio-danger-btn full-width" onClick={onDeleteSelected}>
          <Trash2 size={14} /> 설명 상자 삭제
        </button>
      </aside>
    )
  }

  // 3. Cell Selected Inspector
  if (selectedNode?.data.kind === 'cell') {
    const shape: CellShapeStyle = selectedNode.data.cellShape ?? 'membrane_zoom'
    const theme: CellColorTheme = selectedNode.data.cellTheme ?? inferCellTheme(selectedNode.data.label)
    const childMolecules = nodes.filter((n) => n.parentId === selectedNode.id && !n.hidden)
    return (
      <aside className="studio-inspector" aria-label="세포 속성 편집">
        <div className="inspector-header">
          <span className="mini-eyebrow">세포 컨테이너</span>
          <h3>{selectedNode.data.label}</h3>
        </div>

        <section className="inspector-card">
          <label>
            세포 이름
            <input
              aria-label="Object name"
              value={selectedNode.data.label}
              onChange={(e) => onUpdateNode({ label: e.target.value })}
            />
          </label>
          <label className="studio-checkbox">
            <input
              type="checkbox"
              checked={selectedNode.data.showName !== false}
              onChange={(e) => onUpdateNode({ showName: e.target.checked })}
            />
            <span>세포 이름 배지 표시</span>
          </label>
        </section>

        <section className="inspector-card">
          <label className="card-title">세포 표현 모양</label>
          <div className="segmented-control">
            {([
              ['membrane_zoom', '막 단면 확대'],
              ['round_cell', '원형 세포'],
              ['tumor_cell', '종양형'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                className={shape === val ? 'is-active' : ''}
                onClick={() => onUpdateNode({ cellShape: val, simpleCell: val === 'membrane_zoom' })}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="card-title">세포 색상 팔레트</label>
          <div className="mini-swatch-group">
            {(Object.keys(CELL_THEMES) as CellColorTheme[]).map((t) => (
              <button
                key={t}
                className={`swatch-dot large ${theme === t ? 'is-active' : ''}`}
                style={{ background: CELL_THEMES[t].headFill }}
                onClick={() => onUpdateNode({ cellTheme: t })}
              />
            ))}
          </div>

          {shape === 'membrane_zoom' && (
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={Boolean(selectedNode.data.showOrganelles)}
                onChange={(e) => onUpdateNode({ showOrganelles: e.target.checked })}
              />
              <span>미토콘드리아 · 엔도좀 표시</span>
            </label>
          )}

          <label>
            패널 배지 구분
            <select
              value={selectedNode.data.panelId ?? 'single'}
              onChange={(e) => onUpdateNode({ panelId: e.target.value as BioNode['data']['panelId'] })}
            >
              <option value="single">단일 기본 (배지 없음)</option>
              <option value="untreated">비처리 (UNTREATED)</option>
              <option value="treated">약물 처치 (TREATED)</option>
            </select>
          </label>
        </section>

        <section className="inspector-card">
          <label className="card-title">이 세포에 속한 분자 ({childMolecules.length})</label>
          {childMolecules.length ? (
            <div className="object-chip-list">
              {childMolecules.map((m) => (
                <button key={m.id} onClick={() => onSelectObject(m.id, 'node')}>
                  {m.data.label}
                </button>
              ))}
            </div>
          ) : (
            <small className="muted-hint">좌측 ‘단백질’ 또는 ‘항체·약물’ 탭에서 분자를 클릭해 이 세포에 추가하세요.</small>
          )}
        </section>

        <div className="action-row-pair">
          <button className="studio-secondary-btn" onClick={onDuplicateSelected}>
            <Copy size={13} /> 세포 복제
          </button>
          <button className="studio-danger-btn" onClick={onDeleteSelected}>
            <Trash2 size={13} /> 세포 삭제
          </button>
        </div>
      </aside>
    )
  }

  // 4. Molecule / Drug / Membrane Selected Inspector
  if (selectedNode) {
    const otherMolecules = molecules.filter((m) => m.id !== selectedNode.id)
    const connectedEdges = edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
    const isInactive = Boolean(selectedNode.data.state && /inactive|cytoplasmic/.test(selectedNode.data.state))

    return (
      <aside className="studio-inspector" aria-label="분자 속성 편집">
        <div className="inspector-molecule-hero">
          <div className="hero-glyph-box">
            <MoleculeRenderer data={selectedNode.data} editorPreview />
          </div>
          <div>
            <span className="mini-eyebrow">{selectedNode.data.kind.toUpperCase()}</span>
            <h3>{selectedNode.data.label}</h3>
            <small>{selectedNode.data.compartment}</small>
          </div>
        </div>

        <section className="inspector-card">
          <label>
            표시 이름
            <input
              aria-label="Object name"
              value={selectedNode.data.label}
              onChange={(e) => onUpdateNode({ label: e.target.value })}
            />
          </label>
          <label>
            보조 설명 (선택)
            <input
              placeholder="예: blocking mAb, proximal kinase…"
              value={selectedNode.data.subtitle ?? ''}
              onChange={(e) => onUpdateNode({ subtitle: e.target.value })}
            />
          </label>
          <label className="studio-checkbox">
            <input
              type="checkbox"
              checked={selectedNode.data.showName !== false}
              onChange={(e) => onUpdateNode({ showName: e.target.checked })}
            />
            <span>캔버스에 이름 라벨 표시</span>
          </label>
        </section>

        {/* Direct 1-Click Connection Builder */}
        {otherMolecules.length > 0 && selectedNode.data.kind !== 'membrane' && (
          <section className="inspector-card highlight-card">
            <label className="card-title">⚡ 다른 분자와 바로 연결하기</label>
            <select value={quickTargetId} onChange={(e) => setQuickTargetId(e.target.value)}>
              <option value="">대상 분자 선택…</option>
              {otherMolecules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.data.label} ({m.data.kind})
                </option>
              ))}
            </select>
            <div className="quick-rel-buttons">
              <button
                disabled={!quickTargetId}
                className="rel-btn block"
                onClick={() => quickTargetId && onConnectNodes(selectedNode.id, quickTargetId, 'BLOCK')}
              >
                <Ban size={12} /> 차단 ⊣
              </button>
              <button
                disabled={!quickTargetId}
                className="rel-btn bind"
                onClick={() => quickTargetId && onConnectNodes(selectedNode.id, quickTargetId, 'BIND')}
              >
                <Link2 size={12} /> 결합
              </button>
              <button
                disabled={!quickTargetId}
                className="rel-btn activate"
                onClick={() => quickTargetId && onConnectNodes(selectedNode.id, quickTargetId, 'ACTIVATE')}
              >
                <Zap size={12} /> 활성 →
              </button>
            </div>
            <div className="inline-row">
              <select value={quickInteraction} onChange={(e) => setQuickInteraction(e.target.value as InteractionType)}>
                <option value="PHOSPHORYLATE">+P 인산화 (PHOSPHORYLATE)</option>
                <option value="TRANSLOCATE">핵/막 이동 (TRANSLOCATE)</option>
                <option value="SECRETE">분비 (SECRETE)</option>
                <option value="SIGNAL_ABSENT">신호 억제됨 (SIGNAL_ABSENT)</option>
                <option value="INHIBIT">억제 (INHIBIT)</option>
              </select>
              <button
                className="studio-secondary-btn"
                disabled={!quickTargetId}
                onClick={() => quickTargetId && onConnectNodes(selectedNode.id, quickTargetId, quickInteraction)}
              >
                연결
              </button>
            </div>
          </section>
        )}

        {/* Visual Appearance, Color, Rotation, Scale, State */}
        <section className="inspector-card">
          <label className="card-title">색상 · 회전 · 크기 · 상태</label>
          <div className="mini-swatch-group">
            {ACCENT_SWATCHES.map((c) => (
              <button
                key={c}
                className={`swatch-dot ${selectedNode.data.customColor === c ? 'is-active' : ''}`}
                style={{ background: c }}
                onClick={() => onUpdateNode({ customColor: c })}
              />
            ))}
            {selectedNode.data.customColor && (
              <button className="reset-chip" onClick={() => onUpdateNode({ customColor: undefined })}>
                기본색
              </button>
            )}
          </div>

          <label>
            회전 각도 ({selectedNode.data.visualRotation ?? 0}°)
            <div className="inline-row">
              <input
                type="range"
                min={-180}
                max={180}
                step={15}
                value={selectedNode.data.visualRotation ?? 0}
                onChange={(e) => onUpdateNode({ visualRotation: Number(e.target.value) })}
              />
              <button
                className="reset-chip"
                title="각도 초기화"
                onClick={() => onUpdateNode({ visualRotation: 0 })}
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </label>

          {selectedNode.data.kind === 'antibody' && (
            <>
              <label className="studio-checkbox">
                <input
                  type="checkbox"
                  checked={selectedNode.data.autoAimTarget !== false}
                  onChange={(e) => onUpdateNode({ autoAimTarget: e.target.checked })}
                />
                <span>연결된 표적 방향으로 Fab 자동 회전</span>
              </label>
              <label className="studio-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNode.data.hasPayload)}
                  onChange={(e) => onUpdateNode({ hasPayload: e.target.checked })}
                />
                <span>ADC 약물 접합체(Payload ★) 표시</span>
              </label>
            </>
          )}

          <label>
            크기 배율 ({Math.round((selectedNode.data.visualScale ?? 1) * 100)}%)
            <input
              type="range"
              min={0.65}
              max={1.65}
              step={0.05}
              value={selectedNode.data.visualScale ?? 1}
              onChange={(e) => onUpdateNode({ visualScale: Number(e.target.value) })}
            />
          </label>

          {['receptor', 'signal', 'transcription'].includes(selectedNode.data.kind) && (
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={Boolean(selectedNode.data.phosphorylated)}
                onChange={(e) => onUpdateNode({ phosphorylated: e.target.checked })}
              />
              <span>인산화 (+P) 활성 배지 표시</span>
            </label>
          )}

          {['signal', 'transcription'].includes(selectedNode.data.kind) && (
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={isInactive}
                onChange={(e) =>
                  onUpdateNode({
                    state: e.target.checked
                      ? selectedNode.data.kind === 'signal'
                        ? 'state:signal:inactive'
                        : 'state:transcription:cytoplasmic'
                      : selectedNode.data.kind === 'signal'
                        ? 'state:signal:active'
                        : 'state:transcription:nuclear',
                  })
                }
              />
              <span>신호 억제·비활성 상태 (회색 점선)</span>
            </label>
          )}

          <label>
            세포 내 위치 구획
            <select
              value={selectedNode.data.compartment}
              onChange={(e) => onUpdateNode({ compartment: e.target.value as Compartment })}
            >
              <option value="extracellular">세포외 공간 (Extracellular)</option>
              <option value="membrane">세포막 (Plasma Membrane)</option>
              <option value="cytoplasm">세포질 (Cytoplasm)</option>
              <option value="nucleus">세포핵 (Nucleus)</option>
              <option value="endosome">엔도좀 (Endosome)</option>
              <option value="mitochondria">미토콘드리아 (Mitochondria)</option>
            </select>
          </label>

          {selectedNode.data.kind === 'receptor' && selectedNode.parentId && (
            <div>
              <label className="card-title">막 발현 도식 개수 (시각 표현용)</label>
              <div className="count-chips">
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    className={(selectedNode.data.visualRepresentation?.count ?? 1) === n ? 'is-active' : ''}
                    onClick={() => onChangeCount(n)}
                  >
                    {n}개
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedNode.data.asset && (
            <button className="studio-secondary-btn full-width" onClick={onDetachAsset}>
              외부 SVG 에셋 해제 (기본 도식으로 복원)
            </button>
          )}
        </section>

        {connectedEdges.length > 0 && (
          <section className="inspector-card">
            <label className="card-title">연결된 상호작용 ({connectedEdges.length})</label>
            <div className="object-chip-list">
              {connectedEdges.map((edge) => {
                const otherId = edge.source === selectedNode.id ? edge.target : edge.source
                const other = nodes.find((n) => n.id === otherId)
                return (
                  <button key={edge.id} onClick={() => onSelectObject(edge.id, 'edge')}>
                    {edge.data?.interaction} · {other?.data.label ?? otherId}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {['receptor', 'ligand', 'antibody'].includes(selectedNode.data.kind) && (
          <button className="studio-secondary-btn full-width" onClick={onEditAdvancedStructure}>
            <Settings2 size={13} /> 고급 구조·도메인·항체 포맷 편집
          </button>
        )}

        <div className="action-row-pair">
          <button className="studio-secondary-btn" onClick={onDuplicateSelected}>
            <Copy size={13} /> 복제
          </button>
          <button className="studio-danger-btn" onClick={onDeleteSelected}>
            <Trash2 size={13} /> 삭제
          </button>
        </div>
      </aside>
    )
  }

  // 5. Default Scene Overview & Export Inspector (when nothing selected)
  return (
    <aside className="studio-inspector" aria-label="장면 설정 및 내보내기">
      <div className="inspector-header">
        <span className="mini-eyebrow">FIGURE OVERVIEW</span>
        <h3>장면 요약 및 스타일</h3>
      </div>

      <div className="scene-stat-pills">
        <div>
          <strong>{cells.length}</strong>
          <span>세포</span>
        </div>
        <div>
          <strong>{molecules.length}</strong>
          <span>분자·약물</span>
        </div>
        <div>
          <strong>{edges.length}</strong>
          <span>상호작용</span>
        </div>
      </div>

      <section className="inspector-card">
        <label className="card-title">그림 배경 테마</label>
        <div className="segmented-control">
          {([
            ['scientific-clean', '소프트 파스텔'],
            ['journal-light', '논문 화이트'],
            ['presentation-dark', '발표 다크'],
          ] as const).map(([preset, text]) => (
            <button key={preset} className={stylePreset === preset ? 'is-active' : ''} onClick={() => onStylePreset(preset)}>
              {text}
            </button>
          ))}
        </div>

        <label>
          출력 비율 프리셋
          <select value={exportPreset} onChange={(e) => onExportPreset(e.target.value as ExportPreset)}>
            <option value="slide-wide">16:9 와이드 슬라이드 (1920×1080)</option>
            <option value="slide-standard">4:3 발표 표준 (1600×1200)</option>
            <option value="journal-square">1:1 저널 Figure 정사각 (1800×1800)</option>
            <option value="transparent">고해상도 투명 배경 (2400×1350)</option>
          </select>
        </label>

        <label className="studio-checkbox">
          <input type="checkbox" checked={showCompartmentLabels} onChange={onToggleCompartmentLabels} />
          <span>세포 구획 영문 캡션 표시 (EXTRACELLULAR 등)</span>
        </label>
        <label className="studio-checkbox">
          <input type="checkbox" checked={showInteractionLabels} onChange={onToggleInteractionLabels} />
          <span>연결선 위에 관계 라벨 배지 항상 표시</span>
        </label>
      </section>

      <section className="inspector-card">
        <label className="card-title">고해상도 그림 내보내기</label>
        <div className="export-button-stack">
          <button className="studio-primary-btn full-width" disabled={!nodes.length} onClick={() => onExport('svg')}>
            <Download size={14} /> 벡터 SVG 다운로드 (Illustrator 호환)
          </button>
          <button className="studio-secondary-btn full-width" disabled={!nodes.length} onClick={() => onExport('png')}>
            <Download size={14} /> 고해상도 PNG 이미지 다운로드
          </button>
          <button className="studio-secondary-btn full-width" disabled={!nodes.length} onClick={() => onExport('pptx')}>
            <Download size={14} /> PowerPoint 슬라이드 (.pptx)
          </button>
          <button className="studio-secondary-btn full-width" disabled={!nodes.length} onClick={() => onExport('package')}>
            <Sparkles size={14} /> AI 일러스트 패키지 (.zip)
          </button>
        </div>
      </section>

      {cells.length > 0 && (
        <section className="inspector-card">
          <label className="card-title">장면 내 개체 빠른 선택</label>
          <div className="object-chip-list">
            {[...cells, ...molecules].slice(0, 18).map((item) => (
              <button key={item.id} onClick={() => onSelectObject(item.id, 'node')}>
                {item.data.hidden ? <EyeOff size={11} /> : <Eye size={11} />} {item.data.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
