import { Activity, Dna, Minus, MousePointer2, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import type { BioKind, DrawingTool } from '../types'

interface Props { tool: DrawingTool; onTool: (tool: DrawingTool) => void; onAdd: (kind: Exclude<BioKind, 'cell' | 'membrane' | 'annotation'>) => void; onCallout: () => void; onWorkspace: () => void }

export function BlankQuickStart({ tool, onTool, onAdd, onCallout, onWorkspace }: Props) {
  return <section className="blank-quick-start">
    <header><strong>Start building</strong><button data-help="최종 그림의 가로·세로 크기, 배경과 가이드를 다시 설정합니다." onClick={onWorkspace}>Resize workspace</button></header>
    <div>
      <button className={tool === 'freehand_membrane' ? 'active' : ''} data-help="선택한 뒤 Workspace에서 마우스를 누른 채 원하는 곡선을 그리세요. 입력 경로를 단순화하고 부드러운 생물학적 막으로 생성합니다." onClick={() => onTool(tool === 'freehand_membrane' ? 'select' : 'freehand_membrane')}><Sparkles size={14}/> Freehand membrane</button>
      <button className={tool === 'straight_membrane' ? 'active' : ''} data-help="Workspace에서 시작점부터 끝점까지 드래그하면 직선 이중막을 만듭니다. 수용체 신호 그림의 단면에 적합합니다." onClick={() => onTool(tool === 'straight_membrane' ? 'select' : 'straight_membrane')}><Minus size={14}/> Straight membrane</button>
      <button data-help="막 수용체를 추가합니다. 만든 뒤 막 근처로 드래그하면 자동으로 중심선에 스냅되고 막 이동을 따라갑니다." onClick={() => onAdd('receptor')}><MousePointer2 size={14}/> Add receptor</button>
      <button data-help="세포외 단백질 또는 리간드 객체를 추가합니다. Inspector에서 이름·상태·구획을 바꿀 수 있습니다." onClick={() => onAdd('ligand')}><Activity size={14}/> Add protein</button>
      <button data-help="항체 객체를 추가합니다. Inspector와 Molecule Builder에서 표적·도메인·구조를 설정할 수 있습니다." onClick={() => onAdd('antibody')}><ShieldCheck size={14}/> Add antibody</button>
      <button data-help="핵 전사 인자 또는 전사 프로그램 객체를 추가합니다. Inspector에서 상태와 구획을 지정합니다." onClick={() => onAdd('transcription')}><Dna size={14}/> Add nuclear factor</button>
      <button data-help="제목과 본문을 입력할 수 있는 과학적 설명 상자를 추가합니다. PNG·SVG·PPTX에도 함께 반영됩니다." onClick={onCallout}><MessageSquareText size={14}/> Add text</button>
    </div>
  </section>
}
