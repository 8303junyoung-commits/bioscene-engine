import type { BioNodeData, MoleculeDefinition } from '../types'
import { AssetImage } from './AssetImage'
import { StructureGlyph } from './StructureGlyph'
import { useCanvasDisplay } from './CanvasDisplayContext'
import { compatibleStructuralModel, scenePlacementForMolecule } from '../molecules'

function moleculeData(definition: MoleculeDefinition): BioNodeData {
  const placement = scenePlacementForMolecule(definition)
  const structuralModel = compatibleStructuralModel(definition)
  return {
    kind: placement.kind,
    label: definition.name,
    compartment: placement.compartment,
    domains: structuralModel.domains,
    sites: [],
    ports: [],
    anchors: [],
    states: [],
    allowedCompartments: [placement.compartment],
    moleculeId: definition.id,
    structuralModel,
  }
}

export function MoleculeRenderer({
  data,
  definition,
  editorPreview = false,
}: {
  data?: BioNodeData
  definition?: MoleculeDefinition
  editorPreview?: boolean
}) {
  const display = useCanvasDisplay()
  const resolved = definition
    ? {
        ...(data ?? moleculeData(definition)),
        ...moleculeData(definition),
        ...(data
          ? {
              kind: data.kind,
              label: data.label,
              compartment: data.compartment,
              state: data.state,
              membraneAnchor: data.membraneAnchor,
              customColor: data.customColor,
              phosphorylated: data.phosphorylated,
              hasPayload: data.hasPayload,
              smallMolecule: data.smallMolecule,
              asset: data.asset,
            }
          : {}),
      }
    : data
  if (!resolved) return null
  const rendered =
    data && !editorPreview && resolved.structuralModel && !display.overlays.domains
      ? { ...resolved, structuralModel: { ...resolved.structuralModel, displayLevel: 'simplified' as const } }
      : resolved
  const glyph = <StructureGlyph data={rendered} />
  return (
    <div className={`molecule-renderer molecule-renderer-${resolved.kind}`} role="img" aria-label={`${resolved.label} molecule illustration`}>
      {resolved.asset ? <AssetImage file={resolved.asset.file} alt={resolved.label} fallback={glyph} /> : glyph}
    </div>
  )
}
