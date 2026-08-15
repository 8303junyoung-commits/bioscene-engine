import { allCompartments } from '../biology'
import type { BioNode, BioNodePatch, Compartment, ConstraintMode, InteractionData, InteractionType } from '../types'
import { safeAssetFile } from '../assetRegistry'

const interactions: InteractionType[] = ['BIND', 'BLOCK', 'AGONIZE', 'CLUSTER', 'PHOSPHORYLATE', 'ACTIVATE', 'INHIBIT', 'SIGNAL_ABSENT', 'TRANSLOCATE', 'SECRETE', 'EXPRESS', 'INTERNALIZE', 'DEGRADE', 'CLEAVE', 'RECRUIT', 'DIMERIZE', 'COMPETE']

interface InspectorProps {
  selectedNode?: BioNode
  selectedEdgeId?: string
  selectedInteraction?: InteractionType
  selectedEdgeData?: InteractionData
  onNodeChange: (patch: BioNodePatch) => void
  onEdgeChange: (interaction: InteractionType) => void
  onEdgeDataChange: (patch: Partial<InteractionData>) => void
  onDelete: () => void
  onBrowseAssets: () => void
  onDetachAsset: () => void
  constraintMode: ConstraintMode
}

export function Inspector(props: InspectorProps) {
  const { selectedNode, selectedEdgeId } = props
  const compartmentOptions = selectedNode && props.constraintMode === 'biological'
    ? selectedNode.data.allowedCompartments
    : allCompartments

  return (
    <aside className="inspector">
      <span className="eyebrow">INSPECTOR</span>
      {!selectedNode && !selectedEdgeId && (
        <div className="empty-inspector">
          <div className="empty-ring">◎</div>
          <h3>Select an object</h3>
          <p>Edit its biological identity, compartment, state, or interaction.</p>
        </div>
      )}

      {selectedNode && (
        <div className="inspector-form">
          <div className="identity-row">
            <span className={`asset-icon asset-${selectedNode.data.kind}`} />
            <div><strong>{selectedNode.data.kind}</strong><small>{selectedNode.id}</small></div>
          </div>
          <label>Label<input value={selectedNode.data.label} onChange={(e) => props.onNodeChange({ label: e.target.value })} /></label>
          <label>Description<input value={selectedNode.data.subtitle ?? ''} onChange={(e) => props.onNodeChange({ subtitle: e.target.value })} /></label>
          {selectedNode.data.kind === 'annotation' && <div className="annotation-editor"><label>Callout title<input value={selectedNode.data.annotation?.title ?? ''} onChange={(e) => props.onNodeChange({ annotation: { ...(selectedNode.data.annotation ?? { body: '', tone: 'info' }), title: e.target.value } })} /></label><label>Body<textarea rows={5} value={selectedNode.data.annotation?.body ?? ''} onChange={(e) => props.onNodeChange({ annotation: { ...(selectedNode.data.annotation ?? { title: '', tone: 'info' }), body: e.target.value } })} /></label><label>Tone<select value={selectedNode.data.annotation?.tone ?? 'info'} onChange={(e) => props.onNodeChange({ annotation: { ...(selectedNode.data.annotation ?? { title: '', body: '' }), tone: e.target.value as 'info' | 'finding' | 'warning' } })}><option value="info">Information</option><option value="finding">Key finding</option><option value="warning">Warning</option></select></label></div>}
          {selectedNode.data.kind !== 'annotation' && <div className="semantic-card asset-binding"><span>BOUND ASSET</span>{selectedNode.data.asset && safeAssetFile(selectedNode.data.asset.file) ? <><img src={`/assets/bioicons-library/${safeAssetFile(selectedNode.data.asset.file)}`} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /><strong>{selectedNode.data.asset.name}</strong><small>{selectedNode.data.asset.author} · {selectedNode.data.asset.licenseSpdx}</small><div>{selectedNode.data.asset.identifiers.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.database}:{item.id}</a>)}</div><button onClick={props.onDetachAsset}>Detach</button></> : <><small>No visual asset bound</small><button onClick={props.onBrowseAssets}>Choose asset</button></>}</div>}
          {selectedNode.data.kind !== 'cell' && selectedNode.data.kind !== 'annotation' && (
            <label>Compartment
              <select value={selectedNode.data.compartment} onChange={(e) => props.onNodeChange({ compartment: e.target.value as Compartment })}>
                {compartmentOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          )}
          {selectedNode.data.kind !== 'annotation' && <label>State
            <select value={selectedNode.data.state ?? ''} onChange={(e) => props.onNodeChange({ state: e.target.value })}>
              {selectedNode.data.states.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
            </select>
          </label>}
          {selectedNode.data.kind !== 'annotation' && <><div className="semantic-card"><span>DOMAINS</span>{selectedNode.data.domains.length ? selectedNode.data.domains.map((domain) => <code key={domain.id}>{domain.label}</code>) : <small>Container object</small>}</div>
          <div className="semantic-card"><span>SITES</span>{selectedNode.data.sites.length ? selectedNode.data.sites.map((site) => <code key={site.id}>{site.label}</code>) : <small>No explicit sites</small>}</div>
          <div className="semantic-card"><span>PORTS</span>{selectedNode.data.ports.length ? selectedNode.data.ports.map((port) => <code key={port.id}>{port.id} · {port.allowedInteractions.join('/')}</code>) : <small>Container object</small>}</div>
          <div className="semantic-card"><span>ANCHOR</span>{selectedNode.data.anchors.map((anchor) => <code key={anchor.id}>{anchor.type} · {anchor.compartment}</code>)}</div></>}
          {selectedNode.data.kind !== 'cell' && <button className="danger-button" onClick={props.onDelete}>Delete object</button>}
        </div>
      )}

      {selectedEdgeId && (
        <div className="inspector-form">
          <div className="identity-row"><div><strong>Interaction</strong><small>{selectedEdgeId}</small></div></div>
          <label>Semantic type
            <select value={props.selectedInteraction} onChange={(e) => props.onEdgeChange(e.target.value as InteractionType)}>
              {interactions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Edge note<textarea rows={3} value={props.selectedEdgeData?.note ?? ''} onChange={(e) => props.onEdgeDataChange({ note: e.target.value })} /></label>
          <div className="evidence-editor"><span>EVIDENCE</span><label>Status<select value={props.selectedEdgeData?.evidence?.status ?? 'needs-review'} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { citation: '' }), status: e.target.value as 'supported' | 'hypothesis' | 'needs-review' } })}><option value="supported">Supported</option><option value="hypothesis">Hypothesis</option><option value="needs-review">Needs review</option></select></label><label>Citation<input value={props.selectedEdgeData?.evidence?.citation ?? ''} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { status: 'needs-review' }), citation: e.target.value } })} placeholder="PMID, DOI, paper title, or internal source" /></label><label>Source URL<input type="url" value={props.selectedEdgeData?.evidence?.url ?? ''} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { status: 'needs-review', citation: '' }), url: e.target.value } })} placeholder="https://…" /></label><label>Evidence note<textarea rows={3} value={props.selectedEdgeData?.evidence?.note ?? ''} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { status: 'needs-review', citation: '' }), note: e.target.value } })} /></label></div>
          <div className="semantic-card"><span>VISUAL GRAMMAR</span><small>Each interaction type carries its own line style and validation semantics.</small></div>
          <button className="danger-button" onClick={props.onDelete}>Delete interaction</button>
        </div>
      )}
    </aside>
  )
}
