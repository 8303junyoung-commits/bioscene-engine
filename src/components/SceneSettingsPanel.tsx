import { BookmarkPlus, CheckCircle2, Eye, Pin, Trash2, X } from 'lucide-react'
import { sceneTypeLabels } from '../sceneViews'
import type { AbstractionLevel, LayoutMode, SceneType, SceneView, VisualizationProfile } from '../types'

interface Props {
  profile: VisualizationProfile
  views: SceneView[]
  warnings: string[]
  onChange: (profile: VisualizationProfile) => void
  onSaveView: () => void
  onApplyView: (view: SceneView) => void
  onDeleteView: (id: string) => void
  onClose: () => void
}

export function SceneSettingsPanel({ profile, views, warnings, onChange, onSaveView, onApplyView, onDeleteView, onClose }: Props) {
  const set = <K extends keyof VisualizationProfile>(key: K, value: VisualizationProfile[K]) => onChange({ ...profile, [key]: value })
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Figure settings">
    <section className="scene-settings-panel">
      <header><div><span className="eyebrow">VISUALIZATION PROFILE</span><h2>Figure settings</h2><p>생물학 그래프는 유지한 채 보이는 범위와 표현 수준만 바꿉니다.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="scene-settings-grid">
        <section className="scene-setting-form">
          <label data-help="장면 유형을 바꾸면 개체를 삭제하지 않고 범위 밖 개체를 hidden_by_scope로 숨깁니다. Full signaling으로 돌아오면 다시 복원됩니다.">Scene type<select value={profile.sceneType} onChange={(event) => set('sceneType', event.target.value as SceneType)}>{Object.entries(sceneTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label data-help="1은 핵심 결론만, 2는 ligand·receptor 관계, 3은 downstream signaling, 4는 모든 상세 개체를 표시합니다.">Detail level <strong>{profile.detailLevel}</strong><input type="range" min="1" max="4" step="1" value={profile.detailLevel} onChange={(event) => set('detailLevel', Number(event.target.value) as 1|2|3|4)}/><small>Executive · Mechanism · Signaling · Detailed</small></label>
          <label data-help="같은 생물학적 개체를 아이콘, 카툰, 도메인 도식, 구조 수준 중 어떤 형태로 표현할지 저장합니다.">Abstraction<select value={profile.abstractionLevel} onChange={(event) => set('abstractionLevel', event.target.value as AbstractionLevel)}><option value="icon">Icon</option><option value="cartoon">Cartoon</option><option value="domain">Domain schematic</option><option value="structure">Molecular structure</option></select></label>
          <label data-help="Single, 비교, 다중 패널, overview와 inset의 화면 구성을 선택합니다. 현재 개체의 생물학적 정체성에는 영향을 주지 않습니다.">Layout mode<select value={profile.layoutMode} onChange={(event) => set('layoutMode', event.target.value as LayoutMode)}><option value="single">Single</option><option value="comparison">Comparison</option><option value="multi_panel">Multi-panel</option><option value="overview_inset">Overview + Inset</option></select></label>
          <div className="setting-toggles"><label><input type="checkbox" checked={profile.evidenceDisplay} onChange={(event) => set('evidenceDisplay', event.target.checked)}/> Evidence display</label><label><input type="checkbox" checked={profile.compartmentLabels} onChange={(event) => set('compartmentLabels', event.target.checked)}/> Compartment labels</label><label><input type="checkbox" checked={profile.organelleDisplay} onChange={(event) => set('organelleDisplay', event.target.checked)}/> Organelles</label></div>
        </section>
        <section className="saved-view-section"><div className="saved-view-heading"><div><h3><Eye size={16}/> Saved views</h3><small>각 뷰는 독립 좌표와 표시 범위를 갖습니다.</small></div><button onClick={onSaveView}><BookmarkPlus size={15}/> Save current view</button></div>{views.length === 0 ? <div className="empty-card">아직 저장된 뷰가 없습니다.</div> : <div className="saved-view-list">{views.map((view) => <article key={view.id}><div><strong>{view.name}</strong><small>{sceneTypeLabels[view.profile.sceneType]} · Detail {view.profile.detailLevel}</small></div><button onClick={() => onApplyView(view)}><Eye size={14}/> Open</button><button className="icon-button" aria-label="Delete view" onClick={() => onDeleteView(view.id)}><Trash2 size={14}/></button></article>)}</div>}</section>
        <section className={`scientific-validation ${warnings.length ? 'has-warnings' : ''}`}><h3><CheckCircle2 size={17}/> Scientific validation</h3>{warnings.length ? <><strong>{warnings.length} warning{warnings.length > 1 ? 's' : ''}</strong><ul>{warnings.slice(0,4).map((warning) => <li key={warning}>{warning}</li>)}</ul></> : <><strong>All biological constraints passed</strong><p>현재 보이는 개체와 상호작용이 구획·포트·상태 규칙을 통과했습니다.</p></>}<small><Pin size={12}/> Manual/pinned positions are preserved by Auto layout.</small></section>
      </div>
    </section>
  </div>
}
