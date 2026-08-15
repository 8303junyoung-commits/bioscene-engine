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
            <label htmlFor="moa-input">Mechanism description</label>
            <textarea id="moa-input" value={input} onChange={(event) => { setInput(event.target.value); setParsed(undefined) }} />
            <button className="primary-button parse-button" onClick={() => setParsed(parseMechanism(input))}><Sparkles size={15} /> Parse mechanism</button>
            <p>Local deterministic multi-pathway parser · cytokine, checkpoint, receptor agonist, growth-factor, and TCR signaling vocabulary · inferred entities stay visibly marked</p>
          </div>
          <div className="mechanism-preview">
            {!parsed && <div className="preview-empty"><Braces size={30} /><strong>Semantic graph preview</strong><span>Parse the description to review entities and typed interactions before generation.</span></div>}
            {parsed && <>
              <div className="preview-heading"><div><span className="eyebrow">PREVIEW</span><h3>{parsed.title}</h3></div><span className="template-chip">{parsed.templateId.includes('comparison') ? '2 panels' : '1 panel'}</span></div>
              <div className="preview-section"><span>ENTITIES · {parsed.entities.length}</span><div className="entity-chips">{parsed.entities.map((entity) => <span key={entity.id} className={entity.source === 'inferred' ? 'inferred' : ''}>{entity.label}<small>{entity.kind} · {entity.source}</small></span>)}</div></div>
              <div className="preview-section"><span>INTERACTIONS · {parsed.interactions.length}</span><div className="interaction-list">{parsed.interactions.map((item) => <div key={item.id}><code>{item.source}</code><strong>{item.interaction}</strong><code>{item.target}</code><small>{item.panel}</small></div>)}</div></div>
              {parsed.warnings.length > 0 && <div className="parser-warnings">{parsed.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
              <button className="generate-button" disabled={!parsed.interactions.length} onClick={() => onGenerate(parsed)}>Generate editable scene <ArrowRight size={15} /></button>
            </>}
          </div>
        </div>
      </section>
    </div>
  )
}
