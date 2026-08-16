# BioScene Engine open-source component audit

Audit date: 2026-08-16  
Scope: BioScene Engine v0.16 / scene schema v0.14  
Decision vocabulary: **ADOPT** (use as a dependency), **ADAPT** (integrate behind a BioScene adapter), **REFERENCE** (learn from patterns only), **REJECT** (do not use), **DEFER** (revisit after a prerequisite).

## 1. Current architecture

BioScene is a React 19 + TypeScript + Vite single-page editor. `@xyflow/react` is the canvas and interaction kernel. Biological state is held in the BioScene scene schema rather than in React Flow internals. ELK computes layout positions; it is not the scene model. Supabase Edge Functions proxy private-safe UniProt lookup and room persistence. SVG assets are bound to biological nodes through a manifest and per-asset provenance rather than being treated as the node itself.

The architecture already has several good boundaries:

- `BioNodeFields`, `MoleculeDefinition`, and `StructuralModel` are the canonical scientific data.
- React Flow nodes/edges are the editable view representation.
- `src/uniprot.ts` validates and normalizes remote UniProt data before it enters a molecule.
- `src/utils.ts` maps BioScene nodes to/from ELK layout input.
- `src/assetManifest.ts` and the review-package attribution output separate asset identity, file path, author, and license.

The new `src/integrations/*` boundary should be the only place where an external viewer/provider API is translated into BioScene data.

## 2. Generic code currently implemented locally

| Area | Current implementation | Duplication assessment | Decision |
|---|---|---|---|
| Canvas selection, pan/zoom, drag, connection, deletion | React Flow plus BioScene guards | Already delegated correctly | Keep ADOPTED React Flow |
| Copy/paste, context menu, alignment, hide/lock, history | App-level handlers and stacks | Generic editor behavior, but intertwined with protected cells, evidence, panels, and semantic ports | ADAPT official React Flow patterns incrementally; do not replace wholesale |
| Undo/redo | Custom scene snapshots | Overlaps React Flow Pro example concept, but current history must include non-Flow scientific metadata | Keep BioScene canonical history; REFERENCE interaction semantics only |
| Auto layout | Local ELK adapter | Correct separation; biologically aware constraints remain BioScene-owned | Keep ADOPTED ELK |
| Protein feature normalization | `src/uniprot.ts` | Provider-specific transport and BioScene mapping were coupled | ADAPT through `src/integrations/uniprot` |
| Protein annotation display | Manual domain rows only | Missing a mature reference visualization | ADOPT ProtVista as a read-only/reference viewer behind an adapter |
| Protein/antibody schematic | BioScene SVG glyphs | Scientific product core: editable topology, functional ports, provenance | Keep custom; use other tools as REFERENCE only |
| Membrane freehand/path smoothing | Custom sampling and SVG path generation | Generic stroke fitting is duplicated; membrane bilayer semantics are unique | ADAPT Perfect Freehand in a later isolated spike |
| SVG/PNG/PPTX export | Local export pipeline | Generic rendering exists elsewhere, but BioScene needs exact scientific metadata and attribution packaging | Keep custom; consider focused utility adoption only |
| Asset search and attribution | Local manifest over Bioicons-derived assets | Correct product-specific normalization and compliance layer | Keep; expand sources only with per-item license metadata |

## 3. Candidate assessment

### Protein annotation and sequence tooling

| Candidate | Upstream / state | License | Decision | Rationale and integration point |
|---|---|---|---|---|
| ProtVista / `protvista-uniprot` | [EBI Web Components repository](https://github.com/ebi-webcomponents/protvista), maintained v4 line; Web Components | MIT | **ADOPT + ADAPT** | Embed only in Protein & Construct Setup. Lazy-load, omit structure track initially, listen to Nightingale `change` events, and convert an explicit user selection to `DomainDefinition`. Never store component internals. |
| UniProt REST data | Existing BioScene Supabase proxy | UniProt terms/data provenance | **ADAPT** | Preserve the proxy and validation. The new provider interface separates search/import/normalization from UI. Private constructs remain blocked from public lookup. |
| InterProScan 6 | [ebi-pf-team/interproscan6](https://github.com/ebi-pf-team/interproscan6), Nextflow/container workflow | Apache-2.0; individual member databases can add terms | **DEFER** | Not a browser dependency. Add later as an authenticated asynchronous backend job returning normalized features. |
| lollipops | [joiningdata/lollipops](https://github.com/joiningdata/lollipops), Go CLI/library | GPL | **REFERENCE** | Useful residue-to-coordinate and mutation-lollipop ideas. GPL code is not copied into the browser app. |

### Canvas and layout

| Candidate | License | Decision | Rationale |
|---|---|---|---|
| React Flow 12 / xyflow | MIT | **ADOPTED** | Correct base for node-based editing. Use public MIT examples for Context Menu, Save/Restore, NodeResizer, validation, touch, and drag/drop. Copy/Paste, Undo/Redo, helper lines and grouping shown as Pro content are not assumed to be MIT example source; current BioScene implementations remain independent. See the [official examples classification](https://reactflow.dev/examples). |
| Mermaid React Flow editors | Varies by repository | **REFERENCE** | Useful import/conversion ideas, but flowchart semantics are not biological semantics and repository quality/license must be checked per project before code reuse. |
| ELK.js | EPL-2.0 | **ADOPTED** | Appropriate deterministic layered layout with ports. Keep the existing isolated adapter and distribute the required license/source notice. [Upstream](https://github.com/kieler/elkjs). |
| Cytoscape.js | MIT | **DEFER** | Strong compound-graph analysis, but replacing React Flow would duplicate the editor kernel and risk interaction regressions. Consider only for a future analysis-only view. [Upstream](https://github.com/cytoscape/cytoscape.js). |

### Drawing engines

| Candidate | License | Decision | Rationale |
|---|---|---|---|
| Perfect Freehand | MIT | **ADAPT, later spike** | Small pure geometry function that can improve pressure/smoothing while BioScene retains membrane bilayer generation and semantic sides. [Upstream](https://github.com/steveruizok/perfect-freehand). |
| Paper.js | MIT | **REJECT for editor core** | Capable vector scene graph, but would create a second scene graph beside React Flow. Useful only for isolated geometry experiments. [License](https://paperjs.org/license/). |
| Fabric.js | MIT | **REJECT for editor core** | Object model and SVG import overlap current canvas responsibilities and would complicate export/state synchronization. |
| Konva | MIT | **REJECT for editor core** | Canvas renderer would require reimplementing React Flow interaction and accessibility. |

### Biological assets and pathway references

| Source | License model | Decision | Rationale |
|---|---|---|---|
| Bioicons | Platform code MIT; each icon has its own license | **ADOPTED with compliance adapter** | Existing local bank is valuable, but every asset must preserve its author/license. Bioicons explicitly requires citing individual icons. [Upstream](https://github.com/duerrsimon/bioicons). |
| NIAID NIH BioArt Source | Per-entry Public Domain or attribution license | **ADAPT** | High-quality full-body/cell/organelle art. Import only through a manifest with entry URL, creator, license, and citation. [Official FAQ](https://bioart.niaid.nih.gov/faqs). |
| SciDraw illustration repository | CC BY 4.0 for uploaded drawings | **ADAPT** | Suitable selected assets, with title/creator/source/license captured. Do not confuse it with similarly named commercial or Wolfram projects. [Official licensing](https://scidraw.io/licensing). |
| SwissBioPics | Images CC BY 4.0 | **ADAPT** | Strong cell and subcellular-location references. Attribution is mandatory. [Official help/license](https://www.swissbiopics.org/help). |
| Reactome | Illustrations/icons CC BY 4.0; data CC0; most code Apache-2.0 with exceptions | **DEFER / ADAPT API** | Prefer Content Service or diagram export for a pathway-reference panel, not editable-object import until semantic mapping is designed. [License](https://reactome.org/license). |
| Servier Medical Art | CC BY terms per current source | **ADAPT through existing Bioicons records** | Keep original creator/source/license and modifications in export attribution. Do not flatten to a single platform license. |

### 3D and antibody tooling

| Candidate | License | Decision | Rationale |
|---|---|---|---|
| 3Dmol.js | BSD-3-Clause plus bundled notices | **DEFER, preferred 3D spike** | Best first option for a lazy-loaded, optional PDB/mmCIF viewer. It must remain a reference viewer, not the 2D scene renderer. [Upstream](https://github.com/3dmol/3Dmol.js). |
| iCn3D | Main NCBI code public domain; integrated features have additional terms, including DelPhi restrictions | **DEFER** | Powerful but heavier dependency/runtime and more complex license surface. If evaluated, disable licensed features and isolate in its own adapter. [Upstream](https://github.com/ncbi/icn3d). |
| ABodyBuilder3 | Apache-2.0 | **DEFER** | Python prediction backend with model weights; not a schematic renderer. Possible future private job service only. [Upstream](https://github.com/Exscientia/ABodyBuilder3). |
| abYdraw / AbML | GPL-3.0 | **REFERENCE** | AbML is a valuable format concept for multispecific antibody topology; do not copy GPL renderer code into BioScene. [Paper and software link](https://pmc.ncbi.nlm.nih.gov/articles/PMC9291709/). |

## 4. ProtVista spike findings

`protvista-uniprot@4.9.1` is pinned rather than loaded from a CDN. It is lazy-loaded only after the user opens the viewer. The production build isolates it in a 3.73 MB minified / 1.10 MB gzip chunk, so it does not increase the initial JavaScript chunk but remains a material on-demand cost. The component runs in light DOM and directly calls EBI endpoints. Production CSP therefore allowlists only the required `www.ebi.ac.uk` and `alphafold.ebi.ac.uk` origins in addition to Supabase; it does not open a generic HTTPS wildcard. The structure track is disabled in the first integration to limit scope.

The meta-component documents `protvista-event` for data availability. Its Nightingale child tracks also emit bubbling `change` events with `eventType: "click"` and a feature payload. BioScene listens defensively to that event, but also presents the already validated UniProt feature list as a deterministic fallback because the exact payload varies by track. Only the explicit **Add as BioScene domain** action mutates the molecule.

The persisted result is a normal `DomainDefinition` with residue range, source `UniProt`, and confidence `high`. ProtVista zoom, open-category, tooltip, filter, and internal track state are deliberately not saved.

## 5. Compliance rules

1. Pin direct dependencies and record upstream repository, version, and SPDX license.
2. Keep required license texts/notices in distributed artifacts where the license requires them.
3. Treat asset licenses per item; platform-level MIT does not override CC BY obligations.
4. Do not copy GPL implementation code into the distributed BioScene frontend. Pattern-level research is documented as REFERENCE.
5. Any external provider output must be normalized and validated before persistence.
6. Private/proprietary sequence or construct data must never be sent to public services without a future explicit consent flow.
7. Review package attribution remains the authoritative machine-generated record for all assets used in a scene.

