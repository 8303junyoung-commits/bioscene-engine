# BioScene Engine MVP

Biology-aware mechanism-of-action figure editor based on the supplied master concept document.

## Implemented

- Nested cell scene with extracellular, plasma membrane, cytoplasm, and nucleus regions
- Semantic objects for receptors, ligands, antibodies, signaling nodes, and transcription nodes
- Explicit binding and signal ports
- Formal domain, site, anchor, state, and allowed-compartment metadata on every semantic object
- Per-port interaction allowlists and source/target compatibility validation
- Typed BIND, BLOCK, ACTIVATE, INHIBIT, and TRANSLOCATE interactions
- Biological Constraint and Free Edit modes
- Membrane snapping and compartment-aware object placement
- ELK-based auto layout within each biological compartment
- Non-destructive Scene scopes for Empty, ECM/Membrane, Full Signaling, Intracellular, Cell-Cell, Environment, Organ/System, Molecular/Complex, and Process/Timeline figures
- Four detail levels, abstraction profiles, layout modes, and reusable named views over one semantic graph
- `hidden_by_scope` restoration plus manual and pinned position preservation during Auto layout
- Edge-aware ELK ordering that uses the real interaction graph before snapping nodes into biological zones
- Reusable single-panel and untreated-versus-treated mechanism templates
- Matched two-panel IL-18 signaling versus SLC-7020 blockade scene
- Panel-aware object insertion: select a panel/cell to add new semantic objects to that container
- Natural-language MoA composer with parse-before-generate review
- Deterministic Korean/English multi-pathway entity recognition for cytokines, checkpoints, receptor agonists, growth factors, TCR signaling, common intracellular nodes, anti-target antibodies, and SLC-series therapeutics
- Explicit-versus-inferred entity labeling and typed semantic graph preview
- Semantic graph to editable single- or two-panel Scene generation
- Parent/child movement: moving the NK cell carries its internal objects
- Inspector for labels, descriptions, compartments, and molecular state
- Persistent grouped editor toolbar with explicit Select, Pan, membrane, cell, molecule, and annotation modes
- Single-use or pinned continuous creation, ESC cancellation, active-mode cursor/status, and autosave status
- Marquee/Shift multi-selection, resize handles, object mini toolbars, right-click actions, and synchronized Layers/Inspector selection
- Delete, duplicate, internal copy/paste, visibility, position locking, z-order controls, and global Undo/Redo keyboard workflows
- Re-editable membrane paths with draggable/addable/removable control points, endpoint extension/trim, straightening, splitting, inside/outside flip, and anchored-receptor following
- Add/delete objects and interactions
- Protein & Construct Setup with a server-side UniProt proxy, human-reviewed candidate selection, accession lookup, progress/error/retry states, offline cache, sequence + feature provenance, topology classification, editable structural previews, generated ports, and public/private separation
- Lazy-loaded ProtVista annotation reference viewer with a UniProt provider adapter, manual public-accession fallback, click/feature selection bridge, and explicit conversion into provenance-bearing BioScene domains
- Structural SVG rendering for soluble proteins, single-pass receptors, IgG and bispecific antibody constructs
- Scene save/load in `bioscene.scene.v0.14` JSON, including explicit molecule identity, origin, topology, construct architecture and save state, plus figure workspace geometry, biological membrane paths and anchors, molecule libraries, functional vocabularies, visualization profiles, saved views, assets, callouts, literature, review metadata, interaction evidence, collaboration state, and automatic migration of `v0.1` through `v0.13` scenes
- Debounced browser-local autosave and automatic restore
- Strict scene-import validation and biological warning counting
- State-aware compartment transitions in Biological Constraint mode
- Explicit warning display when Free Edit violates state, anchor, compartment, or port rules
- Collision-aware placement for newly added objects
- PNG and SVG export
- IL-18 / SLC-7020 receptor-blockade starter scene
- In-editor smart asset bank over all 1,526 local, security-screened SVGs
- Search by asset name, author, category, biological synonym, and license filter
- Selected-object-aware synonym suggestions and local SVG previews
- Semantic-object-to-asset binding with author, SPDX license, source URL, and whole-SVG mapping metadata
- Curated IL-18 / IL-18R identifier links to UniProt and the Reactome IL-18 pathway
- Asset detach without loss of semantic ports, states, or interactions
- Shift-click multi-selection with left/center/right/top/middle/bottom alignment
- Horizontal and vertical equal distribution for three or more selected objects
- Scientific Clean, Journal Light, and Presentation Dark style presets
- Manual revision snapshots with local history, restore, and a 5-version retention limit
- Export presets for 16:9, 4:3, journal-square, and transparent-background figures
- Real one-slide `.pptx` export with the fitted high-resolution mechanism figure
- Full 16-type interaction grammar: BIND, BLOCK, AGONIZE, CLUSTER, PHOSPHORYLATE, ACTIVATE, INHIBIT, TRANSLOCATE, SECRETE, EXPRESS, INTERNALIZE, DEGRADE, CLEAVE, RECRUIT, DIMERIZE, and COMPETE
- Interaction-aware port validation and distinct arrow, inhibition, competition, and transport rendering
- Scene-native scientific callouts with information, key-finding, and warning tones
- Callout title/body/tone editing through the Inspector
- CD8 T-cell antigen-response starter scene with pMHC–TCR–ZAP70–NFAT signaling
- Hepatocyte IL-6-response starter scene with IL-6R/gp130–STAT3 acute-phase signaling
- Scene-level Draft, In review, and Approved status with reviewer list and scientific notes
- Endosome and mitochondria compartments with placement, anchor, and state validation
- Receptor INTERNALIZE transition from plasma membrane into the endosomal compartment
- Multi-cell tumor–CD8 tissue scene with cross-container PD-L1–PD-1 interaction edges
- EGFR membrane-to-endosome trafficking starter scene
- Per-interaction Supported, Hypothesis, and Needs review evidence status
- Citation, source URL, and evidence-note editing for every interaction
- Evidence-status dots rendered directly on interaction labels
- Shareable review ZIP containing `figure.png`, editable `scene.json`, `REVIEW.md`, `evidence.csv`, `PROVENANCE.csv`, and `ATTRIBUTIONS.txt` when licensed assets are used
- Structured PMID, DOI, URL, and internal-citation ingestion with canonical source links
- Transparent 100-point evidence appraisal using visible, editable criteria and weights
- Literature-to-interaction attachment persisted through Scene JSON and review packages
- Reusable tissue modules that capture a selected cell, its children, and internal interactions
- Browser-local tissue module library with safe ID remapping when a module is inserted
- Collaboration hub with participants, review comments, resolve/reopen state, and activity history
- Authenticated, revision-aware production room sync through `GET`/`PUT /rooms/:roomId` with Bearer or API-key mode, ETag/If-Match conflict protection, and session-only credentials
- Server-side PMID/DOI/URL metadata enrichment through `POST /literature/enrich`
- Expanded review ZIP with `literature.json` and `collaboration.json`

The active editor visuals remain original CSS/SVG glyphs. The project now includes 1,526 security-screened, license-indexed biological SVGs from Bioicons across human physiology, tissues, cell types, blood/immunology, receptors, membranes, intracellular components, oncology, genetics, and related categories. Open `asset-catalog.html` through the app server or use the **Browse 1,526 licensed SVGs** link in the editor. See `THIRD_PARTY_ASSETS.md` for provenance rules.

Open-source adoption decisions, verified upstream links, license boundaries, bundle costs, and the staged integration roadmap are documented in [`docs/OPEN_SOURCE_COMPONENT_AUDIT.md`](docs/OPEN_SOURCE_COMPONENT_AUDIT.md) and [`docs/OPEN_SOURCE_INTEGRATION_PLAN.md`](docs/OPEN_SOURCE_INTEGRATION_PLAN.md).

## Run

```powershell
pnpm install
pnpm dev
```

Open the local URL printed by Vite.

## Production build

```powershell
pnpm build
```

The static build is emitted to `dist/`.

## Development status

Phase 1 (Interactive MVP) is the stable baseline: canvas interaction, custom semantic nodes, ports and typed edges, drag/zoom, JSON save/load, local autosave, and PNG/SVG export are operational and browser-verified.

Phase 2 (Biology-aware object model) is complete for the current MVP vocabulary: domain/site/port/anchor/state metadata, allowed compartments, state transitions, connection validation, interaction grammar, parent-child containment, Biological Constraint enforcement, and Free Edit warnings are operational.

Phase 3 (Auto Layout and mechanism templates) is complete for the receptor-blockade use case: extracellular/membrane/cytoplasm/nucleus zoning, interaction-edge-aware ELK ordering, reusable template switching, matched untreated/treated panels, and panel-aware editing are operational.

Phase 4 (Natural Language) began with the IL-18 / SLC-7020 vocabulary. Phase 10 expands it into a deterministic multi-pathway parser covering cytokine/JAK-STAT, checkpoint, receptor agonist, growth-factor/MAPK, TCR, trafficking, and the full typed-interaction vocabulary. Inferred receptors and pathway nodes remain visibly marked and exported with provenance.

Phase 5 (Smart Asset Bank) is complete for the local Bioicons library: searchable/filterable previews, biological synonym expansion, selected-object binding, source/license provenance, IL-18-family UniProt and Reactome links, whole-SVG mapping metadata, and Scene v0.5 persistence are operational. Domain metadata is intentionally marked as `whole-asset`; no nonexistent internal SVG selectors are fabricated.

Phase 6 (Production Polish) is complete for the master-plan scope: alignment/distribution tools, local revision history, production style presets, export presets, fitted high-resolution output, and PowerPoint-ready `.pptx` generation are operational. Generated PowerPoint output is browser-tested and re-rendered for visual QA.

Phase 7 (Scientific Review) is complete: the full planned interaction vocabulary, scene-native annotations, CD8 T-cell and hepatocyte starter scenes, collaboration-ready review metadata, and Scene v0.7 persistence are operational and browser-verified with zero biological warnings.

Phase 8 (Tissue Evidence) is complete: multi-cell tissue composition, endosome/mitochondria compartments, evidence-linked interactions, membrane-to-endosome trafficking, and complete review-package ZIP export are operational and browser-verified with zero biological warnings.

Phase 9 (Evidence Rooms) is complete: structured literature ingestion, transparent evidence scoring, interaction-linked citations, reusable tissue modules, local collaboration history, and optional REST room synchronization are operational and browser-verified. Scene v0.9 automatically migrated all earlier Scene versions.

Phase 9.1 (Independent Audit Hardening) incorporates the external source review: full nested validation and tolerant sanitization for literature/collaboration payloads, common v0.1–v0.8 node normalization, preservation of valid legacy evidence, unknown-template fallback, annotation-safe and direction-aware layout, bounded browser storage, comma-safe participant/reviewer entry, room configuration separation from Scene files, endpoint credential stripping, REST timeout and pull snapshot protection, CSV formula hardening, literature-aware evidence ledgers and tissue modules, secure-context-independent IDs, style-aware export backgrounds, awaited viewport fitting, working ESLint flat configuration, dynamic asset counts, asset-path checks, and restored React Flow attribution.

Two delivery archives are produced for review: the small source-only archive omits the 119 MB licensed SVG payload, while the standalone full-review archive includes `public/assets/` and can exercise the Smart Asset Bank without a separate download.

Phase 10 (Production Rooms) is complete: the generalized mechanism parser, production backend adapter, Bearer/API-key authenticated rooms, ETag/If-Match conflict detection, server-side literature metadata enrichment, session-only secret handling, v0.1–v0.9 migration into Scene v0.10, deployment security headers, environment-based API configuration, and a documented backend contract are implemented. See `BACKEND_CONTRACT.md` and `.env.example`.

Phase 11 (Cloud Deployment) is complete in the codebase: Supabase passwordless Auth, an authenticated Edge Function, owner/member room authorization, optimistic revision locking, persistent audit records, RLS-protected Postgres tables, Render Blueprint configuration, and production environment templates are included. See `DEPLOYMENT.md`, `render.yaml`, and `supabase/`.

