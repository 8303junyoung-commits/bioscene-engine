import { Crop, Maximize2, X } from 'lucide-react'
import { useState } from 'react'
import type { FigureWorkspace, WorkspacePreset } from '../types'

const presetSizes: Record<WorkspacePreset, { width: number; height: number }> = {
  presentation_16_9: { width: 1600, height: 900 }, presentation_4_3: { width: 1200, height: 900 },
  square: { width: 1000, height: 1000 }, landscape: { width: 1400, height: 900 }, portrait: { width: 900, height: 1400 },
  a4_landscape: { width: 1123, height: 794 }, a4_portrait: { width: 794, height: 1123 }, custom: { width: 1200, height: 800 },
}

interface Props { value: FigureWorkspace; hasContent: boolean; onSave: (value: FigureWorkspace) => void; onFitContent: () => void; onClose: () => void }

export function WorkspaceSetupPanel({ value, hasContent, onSave, onFitContent, onClose }: Props) {
  const [draft, setDraft] = useState(value)
  const set = <K extends keyof FigureWorkspace>(key: K, next: FigureWorkspace[K]) => setDraft((current) => ({ ...current, [key]: next }))
  const preset = (next: WorkspacePreset) => setDraft((current) => ({ ...current, preset: next, ...presetSizes[next] }))
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Figure Workspace Setup">
    <section className="workspace-setup-panel">
      <header><div><span className="eyebrow">BLANK CANVAS</span><h2>Create Figure Workspace</h2><p>최종 SVG/PNG에 포함될 실제 그림 경계와 작업 가이드를 설정합니다.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18}/></button></header>
      <div className="workspace-setup-body">
        <label data-help="최종 사용처의 비율을 선택하면 Width와 Height가 자동 입력됩니다. Custom에서는 원하는 수치를 직접 입력할 수 있습니다.">Preset<select value={draft.preset} onChange={(event) => preset(event.target.value as WorkspacePreset)}>{Object.keys(presetSizes).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
        <div className="workspace-size-row">
          <label data-help="최종 그림 영역의 가로 길이입니다. 크기를 바꿔도 기존 객체 좌표는 유지됩니다.">Width<input type="number" min="200" max="10000" value={draft.width} onChange={(event) => set('width', Number(event.target.value))}/></label>
          <label data-help="최종 그림 영역의 세로 길이입니다. 크기를 바꿔도 기존 객체 좌표는 유지됩니다.">Height<input type="number" min="200" max="10000" value={draft.height} onChange={(event) => set('height', Number(event.target.value))}/></label>
          <label data-help="입력값을 Scene JSON에 기록할 단위입니다. 화면 편집 좌표와 내보내기 크기는 Workspace 수치를 기준으로 합니다.">Unit<select value={draft.unit} onChange={(event) => set('unit', event.target.value as FigureWorkspace['unit'])}><option value="px">px</option><option value="pt">pt</option><option value="mm">mm</option></select></label>
        </div>
        <label data-help="White/Light gray는 배경색을 포함하고 Transparent는 PNG·SVG 내보내기에서 투명 배경을 유지합니다.">Background<select value={draft.background} onChange={(event) => set('background', event.target.value as FigureWorkspace['background'])}><option value="white">White</option><option value="transparent">Transparent</option><option value="light_gray">Light gray</option><option value="custom">Custom</option></select></label>
        {draft.background === 'custom' && <label data-help="색상 선택값이 Workspace와 내보낸 그림의 배경에 바로 반영됩니다.">Custom color<input type="color" value={draft.customBackground ?? '#ffffff'} onChange={(event) => set('customBackground', event.target.value)}/></label>}
        <label data-help="제목이나 중요 구조가 잘리지 않도록 가장자리에서 안쪽으로 표시할 안전 여백입니다. 가이드는 내보내지 않습니다.">Safe margin<input type="number" min="0" max="400" value={draft.safeMargin} onChange={(event) => set('safeMargin', Number(event.target.value))}/></label>
        <div className="workspace-guide-options">
          <label data-help="안전 여백의 점선을 편집 화면에 표시합니다. 내보내기에는 포함되지 않습니다."><input type="checkbox" checked={draft.showSafeMargin} onChange={(event) => set('showSafeMargin', event.target.checked)}/> Safe margin</label>
          <label data-help="일정 간격의 배치 격자를 표시합니다. 내보내기에는 포함되지 않습니다."><input type="checkbox" checked={draft.showGrid} onChange={(event) => set('showGrid', event.target.checked)}/> Grid</label>
          <label data-help="Workspace의 가로·세로 중심선을 표시합니다. 내보내기에는 포함되지 않습니다."><input type="checkbox" checked={draft.showCenterGuide} onChange={(event) => set('showCenterGuide', event.target.checked)}/> Center guide</label>
          <label data-help="객체를 드래그할 때 Grid 간격에 맞춰 좌표를 정렬합니다."><input type="checkbox" checked={draft.snapToGrid} onChange={(event) => set('snapToGrid', event.target.checked)}/> Snap to grid</label>
        </div>
        <div className="workspace-actions">{hasContent && <button className="ghost-button" data-help="보이는 객체가 모두 들어오도록 Workspace 경계를 맞춥니다." onClick={onFitContent}><Crop size={15}/> Fit to content</button>}<button className="primary-button" data-help="설정한 크기와 배경을 적용합니다. 기존 객체의 위치는 유지됩니다." onClick={() => onSave(draft)}><Maximize2 size={15}/> Create / Resize Workspace</button></div>
      </div>
    </section>
  </div>
}
