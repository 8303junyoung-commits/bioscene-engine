import { Activity, Dna } from 'lucide-react'
import type { BioNodeData, MoleculeDefinition } from '../types'
import { AssetImage } from './AssetImage'
import { StructureGlyph } from './StructureGlyph'
import { useCanvasDisplay } from './CanvasDisplayContext'

const kindFor = (molecule:MoleculeDefinition):BioNodeData['kind'] => molecule.entityClass === 'antibody' || molecule.entityClass === 'adc' ? 'antibody' : molecule.topology.includes('membrane') ? 'receptor' : 'ligand'

function moleculeData(definition:MoleculeDefinition):BioNodeData {
  return { kind:kindFor(definition), label:definition.name, compartment:definition.topology.includes('membrane')?'membrane':'extracellular', domains:definition.structuralModel.domains, sites:[], ports:[], anchors:[], states:[], allowedCompartments:['extracellular'], moleculeId:definition.id, structuralModel:definition.structuralModel }
}

export function MoleculeRenderer({ data, definition, editorPreview=false }:{ data?:BioNodeData; definition?:MoleculeDefinition; editorPreview?:boolean }) {
  const display = useCanvasDisplay()
  const resolved = definition ? { ...(data ?? moleculeData(definition)), ...moleculeData(definition), asset:data?.asset } : data
  if (!resolved) return null
  const rendered = data && !editorPreview && resolved.structuralModel && !display.overlays.domains ? { ...resolved, structuralModel:{ ...resolved.structuralModel, displayLevel:'simplified' as const } } : resolved
  const fallback = rendered.kind === 'signal' ? <Activity size={30}/> : rendered.kind === 'transcription' ? <Dna size={30}/> : <StructureGlyph data={rendered}/>
  return <div className={`molecule-renderer molecule-renderer-${resolved.kind}`} role="img" aria-label={`${resolved.label} molecule illustration`}>
    {resolved.asset ? <AssetImage file={resolved.asset.file} alt={resolved.label} fallback={fallback}/> : fallback}
  </div>
}
