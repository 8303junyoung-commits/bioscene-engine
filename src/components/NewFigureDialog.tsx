import { FileUp, MousePointer2, Sparkles, X } from 'lucide-react'
import { sceneTypeLabels } from '../sceneViews'
import type { LayoutMode, SceneType, VisualizationProfile } from '../types'

interface Props {
  profile: VisualizationProfile
  onProfile: (value: VisualizationProfile) => void
  onEmpty: () => void
  onMoA: () => void
  onLoad: () => void
  onClose: () => void
}

export function NewFigureDialog({ profile, onProfile, onEmpty, onMoA, onLoad, onClose }: Props) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New figure">
    <section className="new-figure-dialog">
      <header><div><span className="eyebrow">NEW FIGURE</span><h2>어떤 그림을 만들까요?</h2><p>그림 유형을 먼저 고르고, 생물학을 직접 배치하거나 MoA에서 생성하세요.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="new-figure-options">
        <label>Scene<select data-testid="new-figure-scene" value={profile.sceneType} onChange={(event) => onProfile({ ...profile, sceneType:event.target.value as SceneType })}>{Object.entries(sceneTypeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Detail <input type="range" min="1" max="4" value={profile.detailLevel} onChange={(event)=>onProfile({ ...profile, detailLevel:Number(event.target.value) as 1|2|3|4 })}/><strong>{profile.detailLevel}</strong></label>
        <label>Layout<select value={profile.layoutMode} onChange={(event)=>onProfile({ ...profile, layoutMode:event.target.value as LayoutMode })}><option value="single">Single</option><option value="comparison">Comparison</option><option value="multi_panel">Multi-panel</option><option value="overview_inset">Overview + Inset</option></select></label>
      </div>
      <div className="start-mode-grid">
        <button data-testid="start-empty-canvas" data-help="모든 개체가 없는 완전한 빈 캔버스를 엽니다. 이후 왼쪽 Biological objects에서 직접 추가할 수 있습니다." onClick={onEmpty}><MousePointer2/><strong>Empty canvas</strong><small>빈 화면에서 직접 구성</small></button>
        <button data-testid="start-generate-moa" data-help="자연어 MoA를 분석해 하나의 semantic graph를 만든 뒤, 위에서 선택한 Scene과 Detail 범위만 표시합니다." onClick={onMoA}><Sparkles/><strong>Generate from MoA</strong><small>기전 설명에서 시작</small></button>
        <button data-testid="start-load-existing" data-help="기존 BioScene JSON을 불러옵니다. 구버전 파일은 새 visualization profile과 saved views 구조로 안전하게 변환됩니다." onClick={onLoad}><FileUp/><strong>Load existing</strong><small>기존 JSON 계속 편집</small></button>
      </div>
    </section>
  </div>
}
