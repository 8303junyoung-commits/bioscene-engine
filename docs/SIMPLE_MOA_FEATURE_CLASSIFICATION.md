# Simple MoA feature classification

2026-09-09 · Based on the actual source components, not proposed new biology.

| Classification | Feature | Actual implementation / access |
|---|---|---|
| CORE | Welcome, New MoA, Open Existing, description generation | `App.tsx`, existing `MechanismComposer.tsx` / `mechanism.ts` |
| CORE | Cell + inline protein selection, visual count/density | `SimpleMoaPanel.tsx`, `simpleMoa.ts`; creates existing BioNodes and MoleculeDefinitions |
| CORE | Minimal natural-protein Lookup / Accept | Existing `uniprot.ts` behind Quick Setup; no new provider or public lookup for antibody shortcuts |
| CORE | Drug/ligand, IgG/Fab/scFv/bi/tri/custom antibody | Simple wrapper around `molecules.ts` architecture and placement factories |
| CORE | Bind / Signal / Block / Indirect | Existing BIND / ACTIVATE / BLOCK; Indirect is dashed presentation metadata, not a new interaction enum |
| CORE | Auto Layout, direct drag, labels, context inspector | `layoutSimpleCells`, existing React Flow selection, `SimpleInspector` |
| CORE | Autosave, Undo, Redo, Save, Load | Existing SceneFile serialization/history in `App.tsx` / `utils.ts` |
| CORE | SVG, PNG, AI blueprint ZIP | Existing export libraries; ZIP contains scene.svg, scene.json, scene_prompt.md; no AI call |
| CORE / secondary | Comparison and Examples | Explicit buttons in Your MoA panel; existing IL18 template is never auto-loaded |
| ADVANCED | Full molecule identity, topology, UniProt annotations | Existing `MoleculeSetupPanel.tsx`, provider integration |
| ADVANCED | Domains, ports, anchors, antibody components/architecture | Existing molecular components, `molecules.ts`, `StructureGlyph.tsx` |
| ADVANCED | Blank canvas, drawing, workspace configuration | `NewFigureDialog`, `WorkspaceSetupPanel`, `EditorToolbar`, `BlankQuickStart` |
| ADVANCED | Full scene scope/detail/abstraction/layout, saved views | `SceneSettingsPanel.tsx`, `sceneViews.ts` |
| ADVANCED | Layers, alignment, overlays, technical Inspector | `LayersPanel`, `Inspector`, `CanvasDisplayContext`, alignment toolbar |
| ADVANCED | Asset Bank and registry | `Sidebar`, `SmartAssetBrowser`, `assetRegistry.ts` |
| DEFER | Evidence scoring, literature enrichment | `LiteraturePanel.tsx`, `evidence.ts`, `backend.ts`; retained, no new work or primary exposure |
| DEFER | Review and review package | `ReviewPanel.tsx`, existing review ZIP export; retained in Advanced |
| DEFER | Collaboration / room sync / login | `CollaborationPanel.tsx`, `backend.ts`, `supabaseClient.ts`; retained, no server/auth changes |
| DEFER | Production styles, revisions, PPTX | `ProductionPanel.tsx`; existing Advanced workflow retained |
| DEFER | Tissue modules | `TissueModulePanel.tsx`, existing module serialization; retained in Advanced |
| DEFER | Additional 3D/ontology/AI capabilities | No new subsystem or capability implemented |
| REMOVE_FROM_PRIMARY_UI | Debug, IDs, state/domain/function badges, visible ports/anchors | Hidden by Simple display context; not removed from biological data |
| REMOVE_FROM_PRIMARY_UI | Automatic IL18 comparison startup | Replaced by welcome; original example remains in gallery and Advanced template picker |

Simple and Advanced share `SceneFile`, `BioNode`, `BioEdge`, `MoleculeDefinition`, history, saved files and library. `CellDraft` is transient form input only. Representation count is optional metadata on the generated real scene nodes, not a second scene format. `simpleCell` marks automatically arranged existing cell nodes; their membrane uses the existing MembraneDefinition / MembraneAnchor fields.

DEFER means retained but not developed in this round; it does not mean deleted or broken. No database, RLS, auth, dependency, deployment or production-domain changes were made.
