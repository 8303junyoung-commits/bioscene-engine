import { allCompartments } from '../biology'
import type { BioNode, BioNodePatch, Compartment, ConstraintMode, InteractionData, InteractionType, MembraneDefinition } from '../types'
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
  onEditStructure: () => void
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

      {selectedNode?.data.kind === 'membrane' && selectedNode.data.membrane && (() => {
        const membrane = selectedNode.data.membrane
        const changeMembrane = (patch: Partial<MembraneDefinition>) => props.onNodeChange({ membrane: { ...membrane, ...patch } })
        return <div className="inspector-form membrane-inspector">
          <div className="identity-row"><span className="asset-icon asset-membrane"/><div><strong>Membrane</strong><small>{selectedNode.id}</small></div></div>
          <label data-help="캔버스와 검토 자료에 표시할 막 이름을 입력합니다.">Name<input value={membrane.name} onChange={(event) => { const name=event.target.value; props.onNodeChange({ label:name, membrane:{...membrane,name} }) }}/></label>
          <label data-help="Plasma membrane은 세포막, Basement membrane은 기저막, Epithelial/Endothelial barrier는 조직 경계로 의미가 저장됩니다.">Boundary type<select value={membrane.boundaryType} onChange={(event)=>changeMembrane({boundaryType:event.target.value as MembraneDefinition['boundaryType']})}><option value="plasma_membrane">Plasma membrane</option><option value="basement_membrane">Basement membrane</option><option value="epithelial_barrier">Epithelial barrier</option><option value="endothelial_barrier">Endothelial barrier</option><option value="custom">Custom biological boundary</option></select></label>
          <label data-help="그린 경로의 A면 구획입니다. 기본값은 extracellular이며 B면과 반대 구획으로 유지됩니다.">Side A<select value={membrane.sideA} onChange={(event)=>{const sideA=event.target.value as MembraneDefinition['sideA'];changeMembrane({sideA,sideB:sideA==='extracellular'?'cytoplasm':'extracellular'})}}><option value="extracellular">Extracellular</option><option value="cytoplasm">Cytoplasm</option></select></label>
          <label data-help="그린 경로의 B면 구획입니다. A면을 바꾸면 자동으로 반대 구획이 됩니다.">Side B<select value={membrane.sideB} onChange={(event)=>{const sideB=event.target.value as MembraneDefinition['sideB'];changeMembrane({sideB,sideA:sideB==='extracellular'?'cytoplasm':'extracellular'})}}><option value="extracellular">Extracellular</option><option value="cytoplasm">Cytoplasm</option></select></label>
          <button className="structure-edit-button" data-help="Extracellular과 Cytoplasm 방향을 한 번에 뒤집습니다. 막에 고정된 수용체의 위치 비율은 유지됩니다." onClick={()=>changeMembrane({sideA:membrane.sideB,sideB:membrane.sideA})}>Flip inside / outside</button>
          <label data-help="Simple은 굵은 띠, Standard는 이중선, Detailed는 지질 패턴을 표시합니다. 생물학적 앵커 데이터는 동일하게 유지됩니다.">Visual style<select value={membrane.style} onChange={(event)=>changeMembrane({style:event.target.value as MembraneDefinition['style']})}><option value="simple">Simple</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label>
          <label data-help="막 중심선을 기준으로 시각적 두께만 조절합니다. 고정된 단백질은 중심선을 따라 유지됩니다.">Thickness <b>{membrane.thickness}px</b><input type="range" min="4" max="28" value={membrane.thickness} onChange={(event)=>changeMembrane({thickness:Number(event.target.value)})}/></label>
          <label data-help="값이 높을수록 경로 점을 더 부드럽게 다시 계산합니다. Smooth 버튼을 누르면 현재 경로에 실제 반영됩니다.">Curvature smoothing <b>{membrane.smoothing}%</b><input type="range" min="0" max="100" value={membrane.smoothing} onChange={(event)=>changeMembrane({smoothing:Number(event.target.value)})}/></label>
          <button className="structure-edit-button" data-help="현재 경로를 단순화하고 곡선을 매끄럽게 다시 계산합니다. 고정된 수용체는 같은 pathPosition에서 재배치됩니다." onClick={()=>changeMembrane({path:membrane.path.length>2?membrane.path.map((point,index,points)=>index===0||index===points.length-1?point:{x:(points[index-1].x+point.x*2+points[index+1].x)/4,y:(points[index-1].y+point.y*2+points[index+1].y)/4}):membrane.path})}>Smooth path</button>
          <div className="semantic-card"><span>ANCHORED OBJECTS</span>{membrane.anchors.length?membrane.anchors.map((anchor)=><code key={anchor.objectId}>{anchor.objectId} · {Math.round(anchor.pathPosition*100)}%</code>):<small>No anchored receptors</small>}</div>
          <button className="danger-button" onClick={props.onDelete}>Delete membrane</button>
        </div>
      })()}

      {selectedNode && selectedNode.data.kind !== 'membrane' && (
        <div className="inspector-form">
          <div className="identity-row">
            <span className={`asset-icon asset-${selectedNode.data.kind}`} />
            <div><strong>{selectedNode.data.kind}</strong><small>{selectedNode.id}</small></div>
          </div>
          <label>Label<input value={selectedNode.data.label} onChange={(e) => props.onNodeChange({ label: e.target.value })} /></label>
          <label>Description<input value={selectedNode.data.subtitle ?? ''} onChange={(e) => props.onNodeChange({ subtitle: e.target.value })} /></label>
          <label data-help="Auto는 자동 배치 대상입니다. Manual은 드래그한 좌표를, Pinned는 고정 좌표를 Auto layout 이후에도 유지합니다.">Position mode<select value={selectedNode.data.positionMode ?? 'auto'} onChange={(e) => props.onNodeChange({ positionMode: e.target.value as 'auto'|'manual'|'pinned' })}><option value="auto">Auto</option><option value="manual">Manual</option><option value="pinned">Pinned</option></select></label>
          <label data-help="Visible은 표시, Manually hidden은 Scene을 바꿔도 숨김을 유지합니다. Scope에 의한 숨김은 Figure settings가 자동 관리합니다.">Visibility<select value={selectedNode.data.visibility === 'hidden_by_scope' ? 'visible' : selectedNode.data.visibility ?? 'visible'} onChange={(e) => props.onNodeChange({ visibility: e.target.value as 'visible'|'manually_hidden' })}><option value="visible">Visible</option><option value="manually_hidden">Manually hidden</option></select></label>
          {selectedNode.data.kind === 'annotation' && <div className="annotation-editor"><label data-help="짧은 결론이나 메시지 제목을 입력하면 캔버스 설명 상자의 굵은 제목으로 즉시 반영됩니다.">Callout title<input value={selectedNode.data.annotation?.title ?? ''} onChange={(e) => props.onNodeChange({ annotation: { ...(selectedNode.data.annotation ?? { body: '', tone: 'info' }), title: e.target.value } })} /></label><label data-help="근거·해석·주의사항을 문장으로 입력하면 제목 아래 본문으로 표시되고 PNG·SVG·PPTX에도 포함됩니다.">Body<textarea rows={5} value={selectedNode.data.annotation?.body ?? ''} onChange={(e) => props.onNodeChange({ annotation: { ...(selectedNode.data.annotation ?? { title: '', tone: 'info' }), body: e.target.value } })} /></label><label data-help="Information은 일반 설명, Key finding은 핵심 결과, Warning은 한계·위험을 뜻합니다. 선택에 따라 설명 상자의 강조 색상이 바뀝니다.">Tone<select value={selectedNode.data.annotation?.tone ?? 'info'} onChange={(e) => props.onNodeChange({ annotation: { ...(selectedNode.data.annotation ?? { title: '', body: '' }), tone: e.target.value as 'info' | 'finding' | 'warning' } })}><option value="info">Information</option><option value="finding">Key finding</option><option value="warning">Warning</option></select></label></div>}
          {selectedNode.data.kind !== 'annotation' && <div className="semantic-card asset-binding" data-help="연결된 SVG는 이 개체의 아이콘만 바꿉니다. 생물학적 종류·상태·포트는 유지되며 저자·라이선스·원본 URL은 Scene과 attribution 파일에 저장됩니다."><span>BOUND ASSET</span>{selectedNode.data.asset && safeAssetFile(selectedNode.data.asset.file) ? <><img src={`/assets/bioicons-library/${safeAssetFile(selectedNode.data.asset.file)}`} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /><strong>{selectedNode.data.asset.name}</strong><small>{selectedNode.data.asset.author} · {selectedNode.data.asset.licenseSpdx}</small><div>{selectedNode.data.asset.identifiers.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.database}:{item.id}</a>)}</div><button onClick={props.onDetachAsset}>Detach</button></> : <><small>No visual asset bound</small><button onClick={props.onBrowseAssets}>Choose asset</button></>}</div>}
          {selectedNode.data.kind !== 'cell' && selectedNode.data.kind !== 'annotation' && (
            <label data-help="개체가 존재하는 생물학적 구획을 고르면 해당 영역으로 이동하고 배치 허용 범위가 바뀝니다. Biological Constraint에서는 개체 종류에 허용된 구획만 선택할 수 있습니다.">Compartment
              <select value={selectedNode.data.compartment} onChange={(e) => props.onNodeChange({ compartment: e.target.value as Compartment })}>
                {compartmentOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          )}
          {selectedNode.data.kind !== 'annotation' && <label data-help="활성·비활성·결합·차단·핵 이동 같은 현재 상태를 선택합니다. 상태 배지가 바뀌고, 차단/비활성 노드가 활성 신호를 내보내면 과학 경고가 생성됩니다.">State
            <select value={selectedNode.data.state ?? ''} onChange={(e) => props.onNodeChange({ state: e.target.value })}>
              {selectedNode.data.states.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
            </select>
          </label>}
          {selectedNode.data.kind !== 'annotation' && <><div className="semantic-card" data-help="DOMAIN은 수용체·항체 등에서 기능적으로 구분되는 구조 영역입니다. 현재 개체 유형에 맞춰 자동 지정되며 연결 의미를 해석하는 참고 정보입니다."><span>DOMAINS</span>{selectedNode.data.domains.length ? selectedNode.data.domains.map((domain) => <code key={domain.id}>{domain.label}</code>) : <small>Container object</small>}</div>
          <div className="semantic-card" data-help="SITE는 결합·인산화처럼 특정 반응이 일어나는 명시적 위치입니다. 정의된 site가 없으면 개체 전체를 대상으로 관계를 표현합니다."><span>SITES</span>{selectedNode.data.sites.length ? selectedNode.data.sites.map((site) => <code key={site.id}>{site.label}</code>) : <small>No explicit sites</small>}</div>
          <div className="semantic-card" data-help="PORT는 선을 연결할 수 있는 입력·출력 지점입니다. 포트 ID 뒤의 목록은 해당 포트에서 허용되는 상호작용 종류이며, 맞지 않는 연결은 Biological Constraint가 차단합니다."><span>PORTS</span>{selectedNode.data.ports.length ? selectedNode.data.ports.map((port) => <code key={port.id}>{port.id} · {port.allowedInteractions.join('/')}</code>) : <small>Container object</small>}</div>
          <div className="semantic-card" data-help="ANCHOR는 이 개체가 세포막·세포질·핵 등 어디에 고정되어야 하는지 나타냅니다. 자동 배치와 생물학적 위치 검증에 사용됩니다."><span>ANCHOR</span>{selectedNode.data.anchors.map((anchor) => <code key={anchor.id}>{anchor.type} · {anchor.compartment}</code>)}</div></>}
          {['receptor','ligand','antibody'].includes(selectedNode.data.kind) && <button className="structure-edit-button" data-help="Molecule Builder를 열어 visual template, topology, domain function, target, highlight와 자동 port를 편집합니다. 캔버스 개체를 더블클릭해도 열립니다." onClick={props.onEditStructure}>Edit protein structure</button>}
          {selectedNode.data.kind !== 'cell' && <button className="danger-button" onClick={props.onDelete}>Delete object</button>}
        </div>
      )}

      {selectedEdgeId && (
        <div className="inspector-form">
          <div className="identity-row"><div><strong>Interaction</strong><small>{selectedEdgeId}</small></div></div>
          <label data-help="두 개체 사이 관계의 의미를 선택합니다. 종류에 따라 선 색·화살촉·차단 막대·점선 표현이 바뀌며 포트 문법과 과학 검증에도 사용됩니다.">Semantic type
            <select value={props.selectedInteraction} onChange={(e) => props.onEdgeChange(e.target.value as InteractionType)}>
              {interactions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label data-help="이 상호작용을 해석하는 짧은 설명을 입력합니다. 캔버스 선의 의미 데이터와 리뷰 ZIP의 evidence.csv에 함께 저장됩니다.">Edge note<textarea rows={3} value={props.selectedEdgeData?.note ?? ''} onChange={(e) => props.onEdgeDataChange({ note: e.target.value })} /></label>
          <div className="evidence-editor"><span>EVIDENCE</span><label data-help="Supported는 근거 확인 완료, Hypothesis는 가설, Needs review는 미검토 상태입니다. 캔버스 선의 근거 점 색상과 검토 산출물에 반영됩니다.">Status<select value={props.selectedEdgeData?.evidence?.status ?? 'needs-review'} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { citation: '' }), status: e.target.value as 'supported' | 'hypothesis' | 'needs-review' } })}><option value="supported">Supported</option><option value="hypothesis">Hypothesis</option><option value="needs-review">Needs review</option></select></label><label data-help="PMID, DOI, 논문 제목 또는 내부 문서 번호를 입력합니다. 이 문자열은 해당 선의 직접 근거로 Scene과 evidence.csv에 기록됩니다.">Citation<input value={props.selectedEdgeData?.evidence?.citation ?? ''} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { status: 'needs-review' }), citation: e.target.value } })} placeholder="PMID, DOI, paper title, or internal source" /></label><label data-help="근거를 확인할 수 있는 http(s) 주소를 입력합니다. 안전한 URL만 저장되며 Inspector와 검토 자료에서 원문 링크로 사용됩니다.">Source URL<input type="url" value={props.selectedEdgeData?.evidence?.url ?? ''} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { status: 'needs-review', citation: '' }), url: e.target.value } })} placeholder="https://…" /></label><label data-help="근거의 적용 범위, 실험 조건, 한계 또는 해석을 입력합니다. 리뷰 ZIP의 상호작용 근거 원장에 포함됩니다.">Evidence note<textarea rows={3} value={props.selectedEdgeData?.evidence?.note ?? ''} onChange={(e) => props.onEdgeDataChange({ evidence: { ...(props.selectedEdgeData?.evidence ?? { status: 'needs-review', citation: '' }), note: e.target.value } })} /></label></div>
          <div className="semantic-card"><span>VISUAL GRAMMAR</span><small>Each interaction type carries its own line style and validation semantics.</small></div>
          <button className="danger-button" onClick={props.onDelete}>Delete interaction</button>
        </div>
      )}
    </aside>
  )
}
