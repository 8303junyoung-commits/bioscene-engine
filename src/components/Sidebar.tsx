import { Activity, Boxes, CircleDot, Dna, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import type { BioKind } from '../types'
import type { PanelId } from '../types'

const items: { kind: Exclude<BioKind, 'cell' | 'annotation' | 'membrane'>; label: string; hint: string; help: string; icon: typeof Activity }[] = [
  { kind: 'receptor', label: 'Receptor', hint: 'Membrane anchored', help: '현재 Target panel의 세포막에 수용체를 추가합니다. Inspector에서 이름·상태·구획을 바꾸고 포트끼리 드래그해 리간드나 하위 신호와 연결합니다.', icon: CircleDot },
  { kind: 'ligand', label: 'Ligand', hint: 'Extracellular', help: '현재 Target panel의 세포외 영역에 리간드를 추가합니다. 수용체의 binding 포트와 연결하면 BIND 같은 허용 상호작용이 자동 추론됩니다.', icon: Sparkles },
  { kind: 'antibody', label: 'Antibody', hint: 'Fab binding port', help: '현재 Target panel의 세포외 영역에 항체를 추가합니다. Fab 포트를 표적 수용체에 연결한 뒤 BLOCK·AGONIZE 등 의미 유형을 Inspector에서 지정할 수 있습니다.', icon: ShieldCheck },
  { kind: 'signal', label: 'Signal node', hint: 'Cytoplasmic', help: '세포질 신호 단백질 노드를 추가합니다. 수용체·다른 신호 노드와 연결하면 ACTIVATE·INHIBIT·PHOSPHORYLATE 등의 경로를 표현할 수 있습니다.', icon: Activity },
  { kind: 'transcription', label: 'Transcription', hint: 'Nuclear', help: '핵 전사 프로그램 노드를 추가합니다. TRANSLOCATE 또는 EXPRESS 연결로 상위 신호가 핵 반응으로 이어지는 과정을 표시합니다.', icon: Dna },
]

export function Sidebar({ onAdd, targetPanel, onBrowseAssets, onAddCallout, onOpenModules }: { onAdd: (kind: Exclude<BioKind, 'cell' | 'annotation' | 'membrane'>) => void; targetPanel: PanelId; onBrowseAssets: () => void; onAddCallout: () => void; onOpenModules: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-heading">
        <span className="eyebrow">ASSET BANK</span>
        <h2>Biological objects</h2>
        <p>Add a semantic object, not just a picture.</p>
        <span className="target-panel">Target panel · {targetPanel}</span>
      </div>
      <div className="asset-list">
        {items.map(({ kind, label, hint, help, icon: Icon }) => (
          <button key={kind} className="asset-button" data-help={help} onClick={() => onAdd(kind)}>
            <span className={`asset-icon asset-${kind}`}><Icon size={18} /></span>
            <span><strong>{label}</strong><small>{hint}</small></span>
            <span className="plus">+</span>
          </button>
        ))}
      </div>
      <button className="callout-add-button" data-help="클릭하면 현재 Target panel에 설명 상자가 추가됩니다. 추가된 상자를 선택한 뒤 오른쪽 Inspector에서 제목·본문을 입력하고, Information/Key finding/Warning 중 강조 색상을 고르면 캔버스와 모든 내보내기에 그대로 반영됩니다." onClick={onAddCallout}><MessageSquareText size={16} /><span><strong>Add scientific callout</strong><small>Finding, note, or warning</small></span><span className="plus">+</span></button>
      <button className="callout-add-button" data-help="선택한 세포와 그 안의 개체·상호작용을 재사용 모듈로 저장합니다. 저장한 모듈은 다른 장면에 복제 삽입되며 원본과 별개로 편집할 수 있습니다." onClick={onOpenModules}><Boxes size={16} /><span><strong>Tissue modules</strong><small>Save and reuse cell networks</small></span><span className="plus">→</span></button>
      <button className="smart-library-button" data-help="캔버스에서 개체를 먼저 선택한 뒤 1,526개 로컬 SVG를 검색해 시각 에셋으로 연결합니다. 생물학적 의미·포트는 유지되고 그림만 교체되며 출처와 라이선스가 내보내기에 기록됩니다." onClick={onBrowseAssets}>Search smart asset bank <span>SVG</span></button>
      <a className="library-link" href="/asset-catalog.html" target="_blank" rel="noreferrer">
        Browse licensed SVG catalog <span>→</span>
      </a>
      <div className="sidebar-note">
        <span>Rule priority</span>
        <strong>Correctness → readability → aesthetics</strong>
      </div>
    </aside>
  )
}
