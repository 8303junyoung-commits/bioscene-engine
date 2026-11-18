# Simple MoA UX refactor plan

Date: 2026-09-09. Scope: simplify access to existing biological capabilities; retain the shared SceneFile / BioNode / BioEdge / MoleculeDefinition model.

## Current entry

Fresh launch loads the IL-18 comparison demo with toolbars, asset bank, layers, inspector, scene scope, production, evidence and collaboration. New Figure asks Scene / Detail / Layout before choosing Empty / Description / Load. No Cell Builder or visual copy selector exists.

## Target entry

Welcome → Build a MoA (primary), Generate from Description, Open Existing, Advanced / Blank Canvas. Existing autosaves remain recoverable from Continue saved figure; never silently replace them. Simple is the default UI on each launch.

Build → searchable cell selection → proteins and visual counts on the same side panel → Generate → inline Drug/Ligand form → one-click suggested target relations or palette/source/target → Export Blueprint. After generation show only summary / context controls.

## Components

Retain EditorToolbar, Sidebar, Inspector, LayersPanel, SceneSettingsPanel, MoleculeSetupPanel, ProductionPanel, LiteraturePanel, CollaborationPanel, ReviewPanel, SmartAssetBrowser and NewFigureDialog behind Advanced. Add SimpleMoaPanel and SimpleInspector as thin views over the same semantic graph. Reuse molecule factories, architecture, placement, UniProt provider, markers, serialization, history and rendering.

Cell Builder stores representation count/density as optional node metadata (not biological copy number), materializes actual node instances, and uses existing membrane anchoring. Common schematic proteins are explicitly labelled presets; unknown natural proteins use Name / Species / Lookup / Accept; private/custom constructs stay manual.

## Interactions

Bind → BIND; Signal → ACTIVATE. Indirect is a dashed presentation modifier of an existing relation, NOT a new InteractionType. Block → BLOCK, with a visible inhibitory end mark in clean exports. Palette supports source/target clicks; known antibody targets offer explicit one-click Bind/Block suggestions, never automatic forced connections. Blocking an edge references the blocked edge in metadata.

## Benchmarks

Earlier review's “20+” was an estimate, not a measured trace. Record a reproducible legacy task or disclose noncompletion. After: PD1 ≤10, NK ≤12, bridging ≤15 primary actions. Count every actual click/input/selection/drag separately as raw actions; also record task-level primary actions with explicit grouping (form completion, export). Do not hide missing steps in reported numbers.

## Risks and verification

Preserve autosave, imported scenes, definitions, edges, evidence, private data and geometry across mode switches. Keep display preferences separate from biology. Avoid Detail slider hiding receptors. Recheck cell-child coordinate anchors, dragging, count changes and edge cleanup; duplicate/comparison must remap IDs and anchors. Save/Load must retain optional representation metadata. SVG/PNG export must suppress handles, metadata, cards and selection chrome while retaining labels and block glyphs. Add Playwright tests for welcome, exact counts/anchors, blockade, exports, mode roundtrip and all three benchmarks. Run existing regressions and record real outcomes/screenshots. Add the requested first-time researcher mission to the existing Gemini QA without inventing an execution result.
