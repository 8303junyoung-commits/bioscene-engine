import { Ban, Circle, Component, Copy, Hand, HelpCircle, MousePointer2, Pin, Pill, ShieldCheck, Sparkles, Type } from 'lucide-react'
import type { DrawingTool } from '../types'

type Props = {
  tool: DrawingTool
  continuous: boolean
  onTool: (tool: DrawingTool) => void
  onContinuous: () => void
  onShortcuts: () => void
}

const help: Record<DrawingTool, string> = {
  select: '선택 도구(V). 개체는 직접 드래그해 옮기고, 빈 캔버스는 드래그해 그림 전체 화면을 중앙으로 이동합니다. Shift+드래그는 영역 선택, Shift+클릭은 다중 선택입니다.',
  pan: '이동 도구(H). 캔버스를 드래그해 화면을 이동합니다. 오브젝트 위치는 바뀌지 않습니다.',
  freehand_membrane: '막 도구(M). 캔버스를 드래그해 자유 곡선 막을 만듭니다. 한 번 그리면 Select로 돌아가며 핀을 켜면 계속 그립니다.',
  straight_membrane: '직선 막. 시작점에서 끝점까지 드래그하면 직선 막이 만들어집니다.',
  place_cell: '세포 배치(C). 캔버스를 클릭하면 빈 세포 컨테이너가 생성됩니다.',
  place_receptor: '단백질 배치(P). 캔버스를 클릭하면 수용체가 생성됩니다. 막 가까이 드래그하면 자동으로 고정됩니다.',
  place_antibody: '항체 배치(A). 캔버스를 클릭하면 항체 개체가 생성되고 Inspector에서 구조와 기능을 편집할 수 있습니다.',
  place_ligand: '리간드 배치(L). 캔버스를 클릭하면 리간드가 생성됩니다.',
  place_annotation: '텍스트 도구(T). 캔버스를 클릭하면 과학 설명 상자가 생성됩니다.',
}

const Tool = ({ value, active, label, shortcut, icon, onTool }: { value: DrawingTool; active: boolean; label: string; shortcut: string; icon: React.ReactNode; onTool: (tool: DrawingTool) => void }) => (
  <button className={active ? 'editor-tool active' : 'editor-tool'} data-testid={`tool-${value}`} onClick={() => onTool(value)} title={`${label} (${shortcut})`} data-help={help[value]}>
    {icon}<span>{label}</span><kbd>{shortcut}</kbd>
  </button>
)

export function EditorToolbar({ tool, continuous, onTool, onContinuous, onShortcuts }: Props) {
  return <nav className="editor-toolbar" aria-label="BioScene editing tools" data-export-exclude="true">
    <div className="editor-tool-group"><small>Navigation</small><div>
      <Tool value="select" active={tool === 'select'} label="Select" shortcut="V" icon={<MousePointer2 size={15}/>} onTool={onTool}/>
      <Tool value="pan" active={tool === 'pan'} label="Pan" shortcut="H" icon={<Hand size={15}/>} onTool={onTool}/>
    </div></div>
    <div className="editor-tool-separator"/>
    <div className="editor-tool-group"><small>Structure</small><div>
      <Tool value="freehand_membrane" active={tool === 'freehand_membrane'} label="Membrane" shortcut="M" icon={<Copy size={15}/>} onTool={onTool}/>
      <Tool value="straight_membrane" active={tool === 'straight_membrane'} label="Straight" shortcut="—" icon={<Ban size={15}/>} onTool={onTool}/>
      <Tool value="place_cell" active={tool === 'place_cell'} label="Cell" shortcut="C" icon={<Circle size={15}/>} onTool={onTool}/>
    </div></div>
    <div className="editor-tool-separator"/>
    <div className="editor-tool-group"><small>Molecules</small><div>
      <Tool value="place_receptor" active={tool === 'place_receptor'} label="Protein" shortcut="P" icon={<Component size={15}/>} onTool={onTool}/>
      <Tool value="place_antibody" active={tool === 'place_antibody'} label="Antibody" shortcut="A" icon={<ShieldCheck size={15}/>} onTool={onTool}/>
      <Tool value="place_ligand" active={tool === 'place_ligand'} label="Ligand" shortcut="L" icon={<Pill size={15}/>} onTool={onTool}/>
    </div></div>
    <div className="editor-tool-separator"/>
    <div className="editor-tool-group"><small>Annotation</small><div>
      <Tool value="place_annotation" active={tool === 'place_annotation'} label="Text" shortcut="T" icon={<Type size={15}/>} onTool={onTool}/>
    </div></div>
    <div className="editor-toolbar-spacer"/>
    <button className={continuous ? 'editor-pin active' : 'editor-pin'} data-testid="continuous-tool" onClick={onContinuous} aria-pressed={continuous} data-help="켜면 현재 생성 도구를 여러 번 연속 사용합니다. 끄면 개체 하나를 만든 뒤 Select 모드로 돌아갑니다."><Pin size={14}/><span>{continuous ? 'Continuous' : 'Single use'}</span></button>
    <button className="editor-help-button" onClick={onShortcuts} data-help="선택·이동·복제·삭제·Undo 등 데스크톱 편집기 단축키를 한눈에 표시합니다."><HelpCircle size={16}/><Sparkles size={10}/></button>
  </nav>
}
