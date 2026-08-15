import { Download, FileDown, History, Image, Palette, RotateCcw, Save, X } from 'lucide-react'
import type { ExportPreset, SceneRevision, StylePreset } from '../types'

const styles: { id: StylePreset; label: string; hint: string }[] = [
  { id: 'scientific-clean', label: 'Scientific Clean', hint: 'Neutral green, editorial clarity' },
  { id: 'journal-light', label: 'Journal Light', hint: 'High contrast, print-friendly' },
  { id: 'presentation-dark', label: 'Presentation Dark', hint: 'Dark canvas for decks' },
]

const exports: { id: ExportPreset; label: string; size: string }[] = [
  { id: 'slide-wide', label: 'PowerPoint 16:9', size: '1920 × 1080' },
  { id: 'slide-standard', label: 'PowerPoint 4:3', size: '1600 × 1200' },
  { id: 'journal-square', label: 'Journal square', size: '1800 × 1800' },
  { id: 'transparent', label: 'Transparent figure', size: '2400 px long edge' },
]

export function ProductionPanel(props: {
  stylePreset: StylePreset
  exportPreset: ExportPreset
  revisions: SceneRevision[]
  onStyle: (value: StylePreset) => void
  onExportPreset: (value: ExportPreset) => void
  onSnapshot: () => void
  onRestore: (revision: SceneRevision) => void
  onExport: (format: 'png' | 'svg' | 'pptx') => void
  onClose: () => void
}) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Production tools">
    <section className="production-panel">
      <header><div><span className="eyebrow">PHASE 6 · PRODUCTION POLISH</span><h2>Publication and deck output</h2><p>Apply a consistent visual system, create recoverable versions, and export to the final medium.</p></div><button className="icon-button" onClick={props.onClose} aria-label="Close"><X size={18} /></button></header>
      <div className="production-columns">
        <section data-help="선택 즉시 편집 화면과 이후 내보내기의 캔버스·노드 색상이 바뀝니다. Scientific Clean은 편집/보고서, Journal Light는 인쇄, Presentation Dark는 어두운 발표 슬라이드에 적합합니다."><h3><Palette size={17} /> Style preset</h3><div className="preset-list">{styles.map((item) => <button key={item.id} className={props.stylePreset === item.id ? 'selected' : ''} onClick={() => props.onStyle(item.id)}><span className={`style-swatch swatch-${item.id}`} /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</div></section>
        <section data-help="최종 사용처의 화면 비율과 픽셀 크기를 선택합니다. 선택값은 PNG·SVG·PPTX 모두에 적용되고 Transparent는 배경을 투명하게 만듭니다."><h3><FileDown size={17} /> Export preset</h3><div className="preset-list">{exports.map((item) => <button key={item.id} className={props.exportPreset === item.id ? 'selected' : ''} onClick={() => props.onExportPreset(item.id)}><span><strong>{item.label}</strong><small>{item.size}</small></span></button>)}</div><div className="export-actions"><button onClick={() => props.onExport('png')}><Image size={15} /> PNG</button><button onClick={() => props.onExport('svg')}><Download size={15} /> SVG</button><button className="pptx-button" onClick={() => props.onExport('pptx')}><FileDown size={15} /> PowerPoint</button></div></section>
        <section className="revision-section" data-help="Create snapshot은 현재 장면 전체를 수동 복구 지점으로 저장합니다. Restore를 누르면 개체·문헌·검토·협업 정보까지 해당 시점으로 되돌아갑니다. 최근 5개가 유지됩니다."><h3><History size={17} /> Version history</h3><button className="snapshot-button" onClick={props.onSnapshot}><Save size={15} /> Create snapshot</button><div className="revision-list">{props.revisions.length ? props.revisions.map((revision) => <div key={revision.id}><span><strong>{revision.label}</strong><small>{new Date(revision.createdAt).toLocaleString()}</small></span><button onClick={() => props.onRestore(revision)}><RotateCcw size={14} /> Restore</button></div>) : <p>No manual snapshots yet. Autosave remains active.</p>}</div></section>
      </div>
    </section>
  </div>
}
