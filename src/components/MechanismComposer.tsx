import { useState } from 'react'
import { ArrowRight, Braces, Sparkles, X } from 'lucide-react'
import { parseMechanism } from '../mechanism'
import type { ParsedMechanism } from '../types'

const example = 'IL-18이 NK cell의 IL-18Rα/β에 결합하고 downstream inflammatory signaling을 활성화한다. SLC-7020이 IL-18Rβ에 결합해 receptor complex formation을 차단하는 untreated vs treated 2-panel figure를 생성.'

export function MechanismComposer({ onClose, onGenerate }: { onClose: () => void; onGenerate: (mechanism: ParsedMechanism) => void }) {
  const [input, setInput] = useState(example)
  const [parsed, setParsed] = useState<ParsedMechanism>()

  return (
    <div className="mechanism-overlay" role="presentation">
      <section className="mechanism-composer" role="dialog" aria-modal="true" aria-labelledby="mechanism-title">
        <header>
          <div><span className="eyebrow">NATURAL LANGUAGE → SEMANTIC GRAPH</span><h2 id="mechanism-title">Generate a mechanism scene</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close mechanism generator"><X size={17} /></button>
        </header>
        <div className="mechanism-grid">
          <div className="mechanism-input">
            <label htmlFor="moa-input" data-help="세포·리간드·수용체·약물과 작용 관계를 한두 문장으로 적으세요. 예: ‘IL-2 activates STAT5 in T cells’ 또는 ‘anti-PD-1 blocks PD-1 signaling, untreated vs treated’. untreated/treated를 쓰면 비교 패널로 해석합니다.">Mechanism description</label>
            <textarea id="moa-input" value={input} onChange={(event) => { setInput(event.target.value); setParsed(undefined) }} />
            <button className="primary-button parse-button" data-help="입력 문장에서 개체와 상호작용을 추출해 오른쪽에 미리보기만 만듭니다. 아직 캔버스는 바뀌지 않으며, inferred 표시는 문장에 없지만 경로 완성을 위해 추론된 개체입니다." onClick={() => setParsed(parseMechanism(input))}><Sparkles size={15} /> Parse mechanism</button>
            <p>Local deterministic multi-pathway parser · cytokine, checkpoint, receptor agonist, growth-factor, and TCR signaling vocabulary · inferred entities stay visibly marked</p>
          </div>
          <div className="mechanism-preview">
            {!parsed && <div className="preview-empty"><Braces size={30} /><strong>Semantic graph preview</strong><span>Parse the description to review entities and typed interactions before generation.</span></div>}
            {parsed && <>
              <div className="preview-heading"><div><span className="eyebrow">PREVIEW</span><h3>{parsed.title}</h3></div><span className="template-chip">{parsed.templateId.includes('comparison') ? '2 panels' : '1 panel'}</span></div>
              <div className="preview-section"><span>ENTITIES · {parsed.entities.length}</span><div className="entity-chips">{parsed.entities.map((entity) => <span key={entity.id} className={entity.source === 'inferred' ? 'inferred' : ''}>{entity.label}<small>{entity.kind} · {entity.source}</small></span>)}</div></div>
              <div className="preview-section"><span>INTERACTIONS · {parsed.interactions.length}</span><div className="interaction-list">{parsed.interactions.map((item) => <div key={item.id}><code>{item.source}</code><strong>{item.interaction}</strong><code>{item.target}</code><small>{item.panel}</small></div>)}</div></div>
              {parsed.warnings.length > 0 && <div className="parser-warnings">{parsed.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
              <button className="generate-button" data-help="미리보기의 개체·상호작용을 실제 편집 가능한 캔버스 노드와 선으로 변환합니다. inferred 개체는 점선 테두리와 표식이 유지되며 현재 장면 교체 전 확인창이 표시됩니다." disabled={!parsed.interactions.length} onClick={() => onGenerate(parsed)}>Generate editable scene <ArrowRight size={15} /></button>
            </>}
          </div>
        </div>
      </section>
    </div>
  )
}
