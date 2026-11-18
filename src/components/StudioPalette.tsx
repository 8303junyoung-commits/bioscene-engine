import { useEffect, useMemo, useState } from 'react'
import { Ban, CircleDot, Copy, Dna, FlaskConical, Image, Layers, Link2, Plus, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { bindManifestAsset, normalized, safeAssetFile, searchText, type ManifestAsset } from '../assetRegistry'
import { createMolecule } from '../molecules'
import { normalizeName } from '../simpleMoa'
import {
  buildStudioTherapeutic,
  CELL_THEMES,
  STUDIO_BLUEPRINTS,
  STUDIO_CATALOG,
  STUDIO_CELL_PRESETS,
  type CatalogItem,
  type ProteinCategory,
  type StudioBlueprint,
  type StudioTherapeuticKind,
} from '../studioPresets'
import type { AssetReference, BioNode, CellColorTheme, CellShapeStyle, InteractionType, MoleculeDefinition } from '../types'
import { importUniProtEntry, lookupUniProt, uniProtSpeciesOptions, type UniProtCandidate, type UniProtSpecies } from '../uniprot'
import { MoleculeRenderer } from './MoleculeRenderer'

export type PaletteTab = 'presets' | 'cells' | 'proteins' | 'drugs' | 'assets'

interface Manifest {
  assets: ManifestAsset[]
  countsByCategory: Record<string, number>
}

interface Props {
  activeTab: PaletteTab
  onTabChange: (tab: PaletteTab) => void
  nodes: BioNode[]
  library: MoleculeDefinition[]
  selectedNode?: BioNode
  onLoadBlueprint: (blueprint: StudioBlueprint) => void
  onStartEmpty: () => void
  onAddCell: (opts: { name: string; theme: CellColorTheme; shape: CellShapeStyle }) => void
  onCloneTreatedComparison: () => void
  onAddCatalogProtein: (item: CatalogItem, count: number) => void
  onAddUniProtMolecule: (molecule: MoleculeDefinition, count: number) => void
  onAddTherapeutic: (opts: {
    molecule: MoleculeDefinition
    nodeOverrides: Partial<BioNode['data']>
    connectTargetIds?: string[]
    interaction?: InteractionType
  }) => void
  onInsertSvgAsset: (asset: AssetReference, applyToSelected: boolean) => void
  onOpenAdvancedMoleculeSetup: () => void
  onOpenMechanismComposer: () => void
}

export function StudioPalette({
  activeTab,
  onTabChange,
  nodes,
  library,
  selectedNode,
  onLoadBlueprint,
  onStartEmpty,
  onAddCell,
  onCloneTreatedComparison,
  onAddCatalogProtein,
  onAddUniProtMolecule,
  onAddTherapeutic,
  onInsertSvgAsset,
  onOpenAdvancedMoleculeSetup,
  onOpenMechanismComposer,
}: Props) {
  // Cell tab state
  const [cellShape, setCellShape] = useState<CellShapeStyle>('membrane_zoom')
  const [customCellName, setCustomCellName] = useState('')
  const [customCellTheme, setCustomCellTheme] = useState<CellColorTheme>('emerald')

  // Protein tab state
  const [proteinCategory, setProteinCategory] = useState<'all' | ProteinCategory>('all')
  const [proteinQuery, setProteinQuery] = useState('')
  const [proteinCount, setProteinCount] = useState(1)
  const [uniSpecies, setUniSpecies] = useState<UniProtSpecies>('9606')
  const [uniBusy, setUniBusy] = useState(false)
  const [uniMsg, setUniMsg] = useState('')
  const [uniCandidates, setUniCandidates] = useState<UniProtCandidate[]>([])
  const [uniResolved, setUniResolved] = useState<MoleculeDefinition>()

  // Drug tab state
  const [modality, setModality] = useState<StudioTherapeuticKind>('igg')
  const [drugName, setDrugName] = useState('')
  const [drugTargetA, setDrugTargetA] = useState('')
  const [drugTargetB, setDrugTargetB] = useState('')
  const [valency, setValency] = useState<'1+1' | '2+1' | '1+2' | '2+2'>('1+1')
  const [drugColor, setDrugColor] = useState<string>('#7348b8')
  const [autoConnectMode, setAutoConnectMode] = useState<'BLOCK' | 'BIND' | 'NONE'>('BLOCK')

  // Bioicons SVG library state
  const [manifest, setManifest] = useState<Manifest>()
  const [assetQuery, setAssetQuery] = useState('')
  const [assetCategory, setAssetCategory] = useState('all')

  useEffect(() => {
    if (activeTab !== 'assets' || manifest) return
    fetch('/assets/bioicons-library/manifest.json')
      .then((res) => (res.ok ? res.json() : undefined))
      .then((val) => {
        if (val && Array.isArray(val.assets)) setManifest(val as Manifest)
      })
      .catch(() => {})
  }, [activeTab, manifest])

  const selectedCell = useMemo(() => {
    if (selectedNode?.data.kind === 'cell') return selectedNode
    if (selectedNode?.parentId) return nodes.find((n) => n.id === selectedNode.parentId && n.data.kind === 'cell')
    return nodes.find((n) => n.data.kind === 'cell')
  }, [nodes, selectedNode])

  const sceneTargetNodes = useMemo(
    () => nodes.filter((n) => !n.hidden && ['receptor', 'ligand', 'signal'].includes(n.data.kind)),
    [nodes],
  )
  const uniqueTargets = useMemo(() => {
    const map = new Map<string, BioNode>()
    for (const node of sceneTargetNodes.filter((n) => ['receptor', 'ligand'].includes(n.data.kind))) {
      const key = normalizeName(node.data.label)
      if (!map.has(key)) map.set(key, node)
    }
    return Array.from(map.values())
  }, [sceneTargetNodes])

  const filteredCatalog = useMemo(() => {
    const q = normalizeName(proteinQuery)
    const customSaved: CatalogItem[] = library
      .filter((m) => m.saveStatus === 'saved' && m.entityClass !== 'antibody' && m.entityClass !== 'adc' && !STUDIO_CATALOG.some((c) => normalizeName(c.name) === normalizeName(m.name)))
      .map((m) => ({
        id: m.id,
        name: m.name,
        koreanHint: m.uniprotAccession ? `UniProt ${m.uniprotAccession}` : '사용자 정의 분자',
        geneName: m.geneName ?? m.name,
        category: m.topology === 'nuclear' ? 'transcription' : m.topology === 'intracellular' ? 'signaling' : m.topology === 'secreted' ? 'cytokine' : 'receptor',
        topology: m.topology,
        molecule: m,
      }))
    return [...customSaved, ...STUDIO_CATALOG].filter((item) => {
      if (proteinCategory !== 'all' && item.category !== proteinCategory) return false
      if (!q) return true
      return normalizeName(`${item.name} ${item.geneName} ${item.koreanHint}`).includes(q)
    })
  }, [library, proteinCategory, proteinQuery])

  const filteredAssets = useMemo(() => {
    if (!manifest) return []
    return manifest.assets
      .filter((asset) => {
        if (assetCategory !== 'all' && asset.category !== assetCategory) return false
        if (!assetQuery.trim()) return true
        return normalized(assetQuery)
          .split(/\s+/)
          .every((term) => searchText(asset).includes(term))
      })
      .slice(0, 60)
  }, [assetCategory, assetQuery, manifest])

  const runUniProtSearch = async (accession?: string) => {
    if (!proteinQuery.trim()) return
    setUniBusy(true)
    setUniMsg('UniProt 데이터베이스 조회 중…')
    setUniResolved(undefined)
    try {
      const draft = { ...createMolecule(proteinQuery.trim(), 'public'), origin: 'natural' as const }
      const res = accession ? { molecule: await importUniProtEntry(draft, accession), candidates: [] } : await lookupUniProt(draft, uniSpecies)
      setUniResolved(res.molecule)
      setUniCandidates(res.candidates)
      if (res.molecule) {
        setUniMsg(`확인됨: ${res.molecule.uniprotAccession ?? res.molecule.name} (${res.molecule.suggestedTopology?.replaceAll('_', ' ') ?? 'protein'})`)
      } else if (res.candidates.length) {
        setUniMsg('아래 후보 중 정확한 유전자를 선택하세요.')
      } else {
        setUniMsg('일치하는 항목이 없습니다. 영문 유전자명(예: EGFR, TIGIT)으로 검색해 보세요.')
      }
    } catch (err) {
      setUniMsg(err instanceof Error ? err.message : 'UniProt 조회 실패')
    } finally {
      setUniBusy(false)
    }
  }

  return (
    <aside className="studio-palette" aria-label="BioScene 구성 팔레트">
      <nav className="palette-tabs" role="tablist">
        {([
          ['presets', Sparkles, '프리셋'],
          ['cells', CircleDot, '세포'],
          ['proteins', Dna, '단백질'],
          ['drugs', ShieldCheck, '항체·약물'],
          ['assets', Image, 'SVG 뱅크'],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            className={`palette-tab ${activeTab === key ? 'is-active' : ''}`}
            onClick={() => onTabChange(key)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="palette-body">
        {/* TAB 1: Curated MoA Blueprints */}
        {activeTab === 'presets' && (
          <div className="palette-section">
            <div className="section-head">
              <h3>바로 쓰는 MoA 표준 도식</h3>
              <p>클릭하면 완성된 그림이 열리며 모든 요소를 자유롭게 수정할 수 있습니다.</p>
            </div>

            <div className="quick-start-pair">
              <button className="studio-secondary-btn" data-testid="start-empty" onClick={onStartEmpty}>
                <Plus size={14} /> 빈 캔버스로 시작
              </button>
              <button className="studio-secondary-btn" onClick={onOpenMechanismComposer}>
                <Sparkles size={14} /> 문장으로 자동 생성
              </button>
            </div>

            <div className="blueprint-card-list">
              {STUDIO_BLUEPRINTS.map((bp) => (
                <button key={bp.id} className="blueprint-card" onClick={() => onLoadBlueprint(bp)}>
                  <span className="blueprint-badge" style={{ color: bp.accent, borderColor: `${bp.accent}38`, background: `${bp.accent}12` }}>
                    {bp.badge}
                  </span>
                  <strong>{bp.title}</strong>
                  <small>{bp.summary}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Cells & Compartments */}
        {activeTab === 'cells' && (
          <div className="palette-section">
            <div className="section-head">
              <h3>세포 및 구획 추가</h3>
              <p>표현 형태를 고른 뒤 세포 카드를 클릭하면 캔버스에 배치됩니다.</p>
            </div>

            <div className="segmented-control" role="group" aria-label="세포 표현 형태">
              {([
                ['membrane_zoom', '막 단면 확대'],
                ['round_cell', '원형 세포'],
                ['tumor_cell', '종양 세포'],
              ] as const).map(([val, label]) => (
                <button key={val} className={cellShape === val ? 'is-active' : ''} onClick={() => setCellShape(val)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="cell-preset-grid">
              {STUDIO_CELL_PRESETS.map((preset) => {
                const pal = CELL_THEMES[preset.theme]
                return (
                  <button
                    key={preset.name}
                    className="cell-preset-card"
                    onClick={() =>
                      onAddCell({
                        name: preset.name,
                        theme: preset.theme,
                        shape: preset.name === 'Tumor cell' && cellShape === 'round_cell' ? 'tumor_cell' : cellShape,
                      })
                    }
                  >
                    <span className="cell-mini-avatar" style={{ background: pal.cytoplasmEnd, borderColor: pal.headFill }} />
                    <div>
                      <strong>{preset.name}</strong>
                      <small>{preset.koreanDesc}</small>
                    </div>
                  </button>
                )
              })}
            </div>

            <form
              className="custom-inline-box"
              onSubmit={(e) => {
                e.preventDefault()
                if (!customCellName.trim()) return
                onAddCell({ name: customCellName.trim(), theme: customCellTheme, shape: cellShape })
                setCustomCellName('')
              }}
            >
              <label>직접 이름 입력해 세포 추가</label>
              <div className="inline-row">
                <input
                  placeholder="예: CAF, Epithelial cell…"
                  value={customCellName}
                  onChange={(e) => setCustomCellName(e.target.value)}
                />
                <button type="submit" className="studio-primary-btn" disabled={!customCellName.trim()}>
                  추가
                </button>
              </div>
              <div className="mini-swatch-group">
                {(Object.keys(CELL_THEMES) as CellColorTheme[]).map((theme) => (
                  <button
                    type="button"
                    key={theme}
                    className={`swatch-dot ${customCellTheme === theme ? 'is-active' : ''}`}
                    style={{ background: CELL_THEMES[theme].headFill }}
                    onClick={() => setCustomCellTheme(theme)}
                  />
                ))}
              </div>
            </form>

            <div className="divider-block">
              <button className="studio-secondary-btn full-width" disabled={!nodes.length} onClick={onCloneTreatedComparison}>
                <Copy size={14} /> 현재 장면을 우측 ‘처치군(Treated)’ 패널로 복제
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Receptors, Cytokines, Signaling, Transcription */}
        {activeTab === 'proteins' && (
          <div className="palette-section">
            <div className="section-head">
              <h3>수용체 · 사이토카인 · 신호전달</h3>
              <p>
                배치 대상 세포: <strong>{selectedCell ? selectedCell.data.label : '자동 생성'}</strong>
              </p>
            </div>

            <div className="search-input-wrap">
              <Search size={14} />
              <input
                placeholder="분자 검색 (예: PD-1, IL-18, MyD88, STAT3)…"
                value={proteinQuery}
                onChange={(e) => {
                  setProteinQuery(e.target.value)
                  setUniCandidates([])
                  setUniResolved(undefined)
                  setUniMsg('')
                }}
              />
            </div>

            <div className="category-pills">
              {([
                ['all', '전체'],
                ['receptor', '막 수용체'],
                ['cytokine', '사이토카인'],
                ['signaling', '세포내 신호'],
                ['transcription', '핵·전사'],
              ] as const).map(([cat, label]) => (
                <button key={cat} className={proteinCategory === cat ? 'is-active' : ''} onClick={() => setProteinCategory(cat)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="count-bar">
              <span>한 번에 배치할 개수</span>
              <div className="count-chips">
                {[1, 2, 3, 5].map((n) => (
                  <button key={n} className={proteinCount === n ? 'is-active' : ''} onClick={() => setProteinCount(n)}>
                    {n}개
                  </button>
                ))}
              </div>
            </div>

            <div className="molecule-card-grid">
              {filteredCatalog.map((item) => (
                <button key={item.id} className="molecule-visual-card" onClick={() => onAddCatalogProtein(item, proteinCount)}>
                  <div className="mini-glyph-stage">
                    <MoleculeRenderer definition={item.molecule} data={{ ...item.molecule.structuralModel, kind: item.category === 'signaling' ? 'signal' : item.category === 'transcription' ? 'transcription' : item.category === 'cytokine' ? 'ligand' : 'receptor', label: item.name, compartment: 'membrane', domains: [], sites: [], ports: [], anchors: [], states: [], allowedCompartments: ['membrane'], membraneAnchor: item.category === 'receptor' ? { membraneId: 'preview', pathPosition: 0.5, orientation: 'normal', angle: 0 } : undefined, customColor: item.customColor }} />
                  </div>
                  <strong>{item.name}</strong>
                  <small>{item.koreanHint}</small>
                </button>
              ))}
            </div>

            {/* Live UniProt Lookup when searching unfamiliar proteins */}
            {proteinQuery.trim().length >= 2 && (
              <div className="uniprot-inline-card">
                <strong>‘{proteinQuery.trim()}’ UniProt 실시간 등록</strong>
                <small>카탈로그에 없는 단백질도 UniProt에서 막관통/분비 구조를 자동 판별해 추가합니다.</small>
                <div className="inline-row">
                  <select aria-label="Species" value={uniSpecies} onChange={(e) => setUniSpecies(e.target.value as UniProtSpecies)}>
                    {uniProtSpeciesOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button className="studio-secondary-btn" disabled={uniBusy} onClick={() => void runUniProtSearch()}>
                    {uniBusy ? '조회 중…' : 'UniProt 조회'}
                  </button>
                </div>
                {uniMsg && <p className="uni-status">{uniMsg}</p>}
                {uniCandidates.length > 0 && (
                  <div className="uni-candidate-list">
                    {uniCandidates.slice(0, 5).map((cand) => (
                      <button key={cand.accession} onClick={() => void runUniProtSearch(cand.accession)}>
                        {cand.geneName} · {cand.accession}
                      </button>
                    ))}
                  </div>
                )}
                {uniResolved && uniResolved.suggestedTopology && uniResolved.suggestedTopology !== 'unknown' && (
                  <button
                    className="studio-primary-btn full-width"
                    onClick={() => {
                      const saved: MoleculeDefinition = {
                        ...uniResolved,
                        entityClass: uniResolved.suggestedEntityClass ?? 'natural_protein',
                        topology: uniResolved.suggestedTopology!,
                        topologyConfirmed: true,
                        saveStatus: 'saved',
                      }
                      onAddUniProtMolecule(saved, proteinCount)
                      setProteinQuery('')
                      setUniResolved(undefined)
                      setUniMsg('')
                    }}
                  >
                    + {uniResolved.name} 장면에 바로 배치
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Antibodies & Therapeutics */}
        {activeTab === 'drugs' && (
          <div className="palette-section">
            <div className="section-head">
              <h3>항체 및 치료제 배치</h3>
              <p>현재 캔버스의 수용체·사이토카인을 자동 인식하여 타겟 방향으로 배치하고 연결합니다.</p>
            </div>

            {uniqueTargets.length > 0 && (
              <div className="smart-blocker-box">
                <span className="mini-eyebrow">⚡ 원클릭 표적 차단 항체 생성</span>
                <div className="smart-blocker-list">
                  {uniqueTargets.slice(0, 6).map((targetNode) => (
                    <button
                      key={targetNode.id}
                      className="smart-blocker-btn"
                      onClick={() => {
                        const built = buildStudioTherapeutic({
                          name: `anti-${targetNode.data.label}`,
                          modality: 'igg',
                          targets: [targetNode.data.label],
                          customColor: '#7348b8',
                        })
                        onAddTherapeutic({
                          ...built,
                          connectTargetIds: [targetNode.id],
                          interaction: 'BLOCK',
                        })
                      }}
                    >
                      <Ban size={13} />
                      <span>
                        <strong>anti-{targetNode.data.label}</strong> 추가 + 즉시 차단(⊣)
                      </span>
                    </button>
                  ))}
                  {uniqueTargets.length >= 2 && (
                    <button
                      className="smart-blocker-btn bispecific"
                      onClick={() => {
                        const [a, b] = uniqueTargets
                        const built = buildStudioTherapeutic({
                          name: `${a.data.label} × ${b.data.label} BsAb`,
                          modality: 'bispecific',
                          targets: [a.data.label, b.data.label],
                          valency: '1+1',
                        })
                        onAddTherapeutic({
                          ...built,
                          connectTargetIds: [a.id, b.id],
                          interaction: 'BIND',
                        })
                      }}
                    >
                      <Link2 size={13} />
                      <span>
                        <strong>
                          {uniqueTargets[0].data.label} × {uniqueTargets[1].data.label}
                        </strong>{' '}
                        이중항체 브릿지
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="custom-drug-builder">
              <span className="mini-eyebrow">맞춤 치료제 모달리티 생성</span>
              <div className="modality-grid">
                {([
                  ['igg', '단클론 IgG'],
                  ['bispecific', '이중특이항체'],
                  ['adc', 'ADC 약물접합'],
                  ['receptor_trap', '수용체 트랩'],
                  ['fab', 'Fab 절편'],
                  ['scfv', 'scFv 절편'],
                  ['small_molecule', '저분자 저해제'],
                ] as const).map(([m, label]) => (
                  <button key={m} className={modality === m ? 'is-active' : ''} onClick={() => setModality(m)}>
                    {label}
                  </button>
                ))}
              </div>

              <label>
                약물 / 후보물질 이름
                <input
                  placeholder="예: SLC-7020, Pembrolizumab, Drug-A…"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                />
              </label>

              <label>
                표적 분자 {modality === 'bispecific' ? 'A' : ''}
                <select value={drugTargetA} onChange={(e) => setDrugTargetA(e.target.value)}>
                  <option value="">(선택 안 함 — 자유 배치)</option>
                  {sceneTargetNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.data.label} ({n.data.compartment})
                    </option>
                  ))}
                </select>
              </label>

              {modality === 'bispecific' && (
                <>
                  <label>
                    표적 분자 B
                    <select value={drugTargetB} onChange={(e) => setDrugTargetB(e.target.value)}>
                      <option value="">(선택 안 함)</option>
                      {sceneTargetNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.data.label} ({n.data.compartment})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    결합가 (Valency)
                    <div className="count-chips">
                      {(['1+1', '2+1', '1+2', '2+2'] as const).map((v) => (
                        <button type="button" key={v} className={valency === v ? 'is-active' : ''} onClick={() => setValency(v)}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </label>
                </>
              )}

              <label>
                배치 시 자동 연결 방식
                <div className="segmented-control">
                  {([
                    ['BLOCK', '차단 (⊣)'],
                    ['BIND', '결합'],
                    ['NONE', '연결 안 함'],
                  ] as const).map(([mode, text]) => (
                    <button type="button" key={mode} className={autoConnectMode === mode ? 'is-active' : ''} onClick={() => setAutoConnectMode(mode)}>
                      {text}
                    </button>
                  ))}
                </div>
              </label>

              <div className="inline-swatch-row">
                <span>항체 포인트 색상</span>
                <div className="mini-swatch-group">
                  {['#7348b8', '#e06348', '#1f8ea3', '#2563eb', '#db2777', '#16a34a'].map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`swatch-dot ${drugColor === c ? 'is-active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setDrugColor(c)}
                    />
                  ))}
                </div>
              </div>

              <button
                className="studio-primary-btn full-width"
                onClick={() => {
                  const targetNodeA = sceneTargetNodes.find((n) => n.id === drugTargetA)
                  const targetNodeB = sceneTargetNodes.find((n) => n.id === drugTargetB)
                  const targetLabels = [targetNodeA?.data.label, targetNodeB?.data.label].filter((x): x is string => Boolean(x))
                  const finalName =
                    drugName.trim() ||
                    (modality === 'bispecific' && targetLabels.length === 2
                      ? `${targetLabels[0]} × ${targetLabels[1]} BsAb`
                      : targetLabels[0]
                        ? `anti-${targetLabels[0]}`
                        : modality === 'small_molecule'
                          ? 'Inhibitor'
                          : 'Therapeutic mAb')
                  const built = buildStudioTherapeutic({
                    name: finalName,
                    modality,
                    targets: targetLabels,
                    valency,
                    customColor: drugColor,
                  })
                  const connectIds = [targetNodeA?.id, modality === 'bispecific' ? targetNodeB?.id : undefined].filter((x): x is string => Boolean(x))
                  onAddTherapeutic({
                    ...built,
                    connectTargetIds: autoConnectMode === 'NONE' ? [] : connectIds,
                    interaction: autoConnectMode === 'NONE' ? undefined : autoConnectMode,
                  })
                  setDrugName('')
                }}
              >
                + 치료제 캔버스에 배치
              </button>

              <button className="studio-ghost-link" onClick={onOpenAdvancedMoleculeSetup}>
                <FlaskConical size={13} /> 고급 도메인·서열·다중특이 설계 열기
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: 1,526 Bioicons SVG Asset Bank */}
        {activeTab === 'assets' && (
          <div className="palette-section">
            <div className="section-head">
              <h3>검증된 과학 SVG 라이브러리</h3>
              <p>
                {manifest ? `${manifest.assets.length.toLocaleString()}개 라이선스 검증 에셋` : '에셋 목록 불러오는 중…'} · 클릭하면{' '}
                {selectedNode && selectedNode.data.kind !== 'cell' ? `'${selectedNode.data.label}' 모양에 적용합니다.` : '새 개체로 추가합니다.'}
              </p>
            </div>

            <div className="search-input-wrap">
              <Search size={14} />
              <input placeholder="영문 키워드 검색 (receptor, virus, t-cell, antibody)…" value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} />
            </div>

            <select className="full-select" value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)}>
              <option value="all">전체 카테고리</option>
              {Object.keys(manifest?.countsByCategory ?? {}).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replaceAll('_', ' ')} ({manifest?.countsByCategory[cat]})
                </option>
              ))}
            </select>

            <div className="svg-bank-grid">
              {filteredAssets.map((asset) => {
                const applyToSelected = Boolean(selectedNode && !['cell', 'membrane', 'annotation'].includes(selectedNode.data.kind))
                return (
                  <button
                    key={asset.id}
                    className="svg-bank-card"
                    title={`${asset.name} (${asset.license.spdx}) — ${applyToSelected ? '선택한 분자에 적용' : '캔버스에 새로 추가'}`}
                    onClick={() => {
                      const bound = bindManifestAsset(
                        asset,
                        applyToSelected ? selectedNode!.data.label : asset.name.replaceAll('_', ' '),
                        applyToSelected ? selectedNode!.data.kind : 'receptor',
                      )
                      onInsertSvgAsset(bound, applyToSelected)
                    }}
                  >
                    <img
                      loading="lazy"
                      src={`/assets/bioicons-library/${safeAssetFile(asset.file) ?? ''}`}
                      alt={asset.name}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <span>{asset.name.replaceAll('_', ' ')}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <footer className="palette-footer">
        <Layers size={13} />
        <span>더블클릭: 이름 수정 · Shift+클릭: 다중 선택</span>
      </footer>
    </aside>
  )
}
