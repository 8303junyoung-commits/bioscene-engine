# BioScene Engine open-source integration plan

Updated: 2026-08-16

## Principles

- BioScene scientific data is canonical; third-party component state is disposable.
- Every integration sits behind `src/integrations/<provider-or-viewer>`.
- Viewers may suggest or preview. Only an explicit BioScene command changes the scene or molecule.
- Network providers return normalized, provenance-bearing values and cannot receive private construct data.
- Add one dependency only when it removes a mature generic problem without creating a second editor/state model.

## Data flow

```text
Supabase UniProt proxy
        │ validated response
        ▼
src/uniprot.ts ── BioScene mapping/cache/privacy policy
        │
        ▼
src/integrations/uniprot/UniProtProvider.ts
        │ normalized ProteinDefinition / MoleculeDefinition
        ├──────────────► Protein & Construct Setup fields
        │
        └──────────────► ProtVista reference panel
                              │ feature click or validated fallback selection
                              ▼
                       explicit Add as BioScene domain
                              │
                              ▼
                       DomainDefinition (persisted)
```

## Milestone 1 — UniProt + ProtVista spike (implemented)

Deliverables:

- [x] Add a provider interface and normalized `ProteinDefinition`/`ProteinFeature` model.
- [x] Wrap the existing secure UniProt lookup in `UniProtProvider` without replacing its cache, validation, or privacy logic.
- [x] Pin `protvista-uniprot@4.9.1` and lazy-load it.
- [x] Embed a reference viewer in the natural-protein Structure section.
- [x] Disable the structure track for the first spike.
- [x] Receive bubbling Nightingale click events defensively.
- [x] Provide a deterministic normalized feature selector when a track payload cannot be mapped.
- [x] Add an explicit **Add as BioScene domain** bridge.
- [x] Allow a format-validated public UniProt accession to open the reference viewer without waiting for an authenticated import; accession changes clear stale imported annotation.
- [x] Persist only `DomainDefinition`, never ProtVista internal state.
- [ ] After production observation, decide whether the full ProtVista bundle cost is justified or whether individual Nightingale tracks should replace the meta-component.

Acceptance checks:

- A UniProt-enriched public protein can open the viewer.
- A public protein with a valid manual accession can open the viewer, while invalid accession text cannot instantiate ProtVista.
- A private construct cannot initiate UniProt lookup and therefore cannot open a remote accession viewer.
- Adding a feature marks the molecule draft dirty and stores range/source/confidence.
- Closing/reopening the editor reconstructs the viewer from accession and normalized molecule state.
- A failed viewer import or EBI request does not destroy the existing molecule data.

## Milestone 2 — React Flow pattern consolidation

1. Inventory current handlers against public MIT examples: Context Menu, Save/Restore, validation, touch, drag/drop, NodeResizer.
2. Extract BioScene commands (`deleteSelection`, `duplicateSelection`, `groupSelection`, `alignSelection`) from `App.tsx` so keyboard, toolbar, and context menu call the same guard path.
3. Keep history at the BioScene scene level because literature, evidence, panels, workspace, and comments are outside plain React Flow state.
4. Do not copy Pro example source unless separately licensed/obtained; retain current independent implementations.

## Milestone 3 — Layout hardening

1. Keep ELK behind the current adapter.
2. Add fixtures for parent/child compartments, ports, locked nodes, and panel-relative coordinates.
3. Add deterministic layout snapshots and abort/cancel handling for very large scenes.
4. Record EPL-2.0 source/notice information in third-party distribution metadata.

## Milestone 4 — Asset bank expansion

1. Define a source adapter contract: stable source ID, title, creator, original URL, download URL, license SPDX/URL, attribution text, modification note, checksum.
2. Ingest only assets whose item-level license is machine-readable.
3. Start with NIAID BioArt Public Domain entries and selected SwissBioPics/SciDraw CC BY 4.0 assets.
4. Continue generating `ATTRIBUTIONS.txt` in review packages and add visible export credit only when requested by the preset/journal workflow.
5. Reject assets with unclear author, license, or downstream redistribution terms.

## Milestone 5 — Membrane path spike

1. Place Perfect Freehand under `spikes/membrane-path` and feed it the same sampled pointer points.
2. Compare latency, point count, SVG size, editing stability, and straight/curved bilayer offset quality.
3. If adopted, store canonical centerline points and options—not the library's transient polygon—and regenerate BioScene membrane geometry.
4. Keep biological side labels, membrane type, thickness, anchoring, and bilayer rendering in BioScene.

## Milestone 6 — InterProScan backend

Prerequisites: authenticated job API, per-user quotas, cancellation, storage retention policy, private-sequence consent, database-license review.

1. Run InterProScan 6 as a containerized asynchronous worker, never in the browser.
2. Persist job status separately from scene state.
3. Normalize completed matches into `ProteinFeature[]` with provider version and analysis database provenance.
4. Present results for review; require explicit acceptance before creating BioScene domains.

## Milestone 7 — Optional 3D reference viewer

1. Spike 3Dmol.js first using lazy loading and a strict size budget.
2. Map PDB/mmCIF/AlphaFold identifiers to a disposable viewer session.
3. Keep camera, selection, and representation state out of the 2D scene schema unless a future saved-view object is explicitly designed.
4. Do not enable iCn3D features with additional restrictions without a separate legal/product review.

## Dependency gate

Every adoption PR must include:

- upstream repository and immutable version/commit;
- license and bundled third-party notices;
- maintenance/activity evidence;
- bundle-size delta and lazy-loading strategy;
- network endpoints and CSP impact;
- privacy classification of sent data;
- normalized persisted fields and migration impact;
- fallback behavior when the dependency or service fails;
- build, type, lint, unit, and browser smoke-test results.

