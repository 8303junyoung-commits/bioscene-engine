# B1 — BLOCK rendering root cause and narrow repair

## Confirmed before changing implementation

The new UI-driven regression reproduced the split exactly: PD1 and IL18RB receptor blockade passed; soluble IL18 blockade and blockade of IL18RA→MyD88 failed because their edge groups were absent. Evidence: `qa/reports/block-rendering-before/results.json`.

1. `App.connectSimple` calls `simpleConnection`, stores the returned nodes and BioEdge, and reports success.
2. `simpleConnection` reuses compatible source/target ports where available. Receptors already have suitable incoming binding ports. Soluble IL18 and MyD88 do not have the incoming binding port needed for these BLOCK cases. The function correctly adds `simple:binding:source` / `simple:binding:target` to the semantic node data.
3. `BioNode` renders the new Handle elements, but previously never called `useUpdateNodeInternals`. The node's dimensions do not change when an absolutely positioned, invisible Handle is added. React Flow therefore retained its old `internals.handleBounds`.
4. Installed React Flow `getEdgePosition` looks up the edge's named source/target handles in that cache. A missing handle returns null (error 008); EdgeWrapper returns null before invoking our `InteractionEdge`. The inhibition marker was not merely hidden or incorrectly colored: the relationship component did not mount.
5. Both SVG and PNG capture the rendered viewport. AI package `scene.svg` uses the same SVG capture. A missing live edge thus remained missing in every image, although Save and package JSON serialized it.

This is a dynamic handle cache invalidation defect, not a UniProt, Supabase, membrane-anchor, color, export-cloning or semantic serialization defect. React Flow explicitly requires updating node internals when handles are added/removed: [official useUpdateNodeInternals documentation](https://reactflow.dev/api-reference/hooks/use-update-node-internals).

## Repair

- `BioNode`: refresh node internals after the DOM commit when the stable port id/role/side signature changes. Do not refresh on every unrelated node-data change.
- `interactionGeometry`: use one path calculation for a relationship and the BLOCK targeting it. The old midpoint calculation omitted the targeted Signal's endpoint clearance. The new BLOCK endpoint uses the actual cubic's two-thirds point: a PNG inspection showed that the midpoint could put the inhibition bar behind the receptor label. This changes only the BLOCK junction, not labels, UI or the underlying Signal path. Advanced handle IDs and positions remain explicit. Referenced node movement triggers recalculation.
- `InteractionEdge`: retain the existing inhibition marker and visual style, and render using the resolved geometry. No visible ports, fake nodes or new user actions are introduced.
- Export: before image capture, verify expected visible BLOCK relationships have live paths and inhibition markers. If a relationship cannot be rendered, stop export with a clear error rather than produce a silently misleading blueprint.
- Existing AI package prompt: when `blockedEdgeId` is present, describe `Drug BLOCK [A ACTIVATE B]`, not the misleading shorthand `Drug BLOCK B`. No AI API or new AI functionality is added.

## Scope

No Simple UI/CSS/layout redesign, added interactions, asset changes, deployment, dependency upgrades or unrelated cleanup. The `outside membrane` I1 issue originates in the older compartment-region validator (`biologicalWarnings`); its coordinate validation is separate from handle caching. It is intentionally deferred rather than suppressing scientific warnings in this rendering repair.
