import { Activity, Boxes, CircleDot, Dna, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import type { BioKind } from '../types'
import type { PanelId } from '../types'

const items: { kind: Exclude<BioKind, 'cell' | 'annotation'>; label: string; hint: string; icon: typeof Activity }[] = [
  { kind: 'receptor', label: 'Receptor', hint: 'Membrane anchored', icon: CircleDot },
  { kind: 'ligand', label: 'Ligand', hint: 'Extracellular', icon: Sparkles },
  { kind: 'antibody', label: 'Antibody', hint: 'Fab binding port', icon: ShieldCheck },
  { kind: 'signal', label: 'Signal node', hint: 'Cytoplasmic', icon: Activity },
  { kind: 'transcription', label: 'Transcription', hint: 'Nuclear', icon: Dna },
]

export function Sidebar({ onAdd, targetPanel, onBrowseAssets, onAddCallout, onOpenModules }: { onAdd: (kind: Exclude<BioKind, 'cell' | 'annotation'>) => void; targetPanel: PanelId; onBrowseAssets: () => void; onAddCallout: () => void; onOpenModules: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-heading">
        <span className="eyebrow">ASSET BANK</span>
        <h2>Biological objects</h2>
        <p>Add a semantic object, not just a picture.</p>
        <span className="target-panel">Target panel · {targetPanel}</span>
      </div>
      <div className="asset-list">
        {items.map(({ kind, label, hint, icon: Icon }) => (
          <button key={kind} className="asset-button" onClick={() => onAdd(kind)}>
            <span className={`asset-icon asset-${kind}`}><Icon size={18} /></span>
            <span><strong>{label}</strong><small>{hint}</small></span>
            <span className="plus">+</span>
          </button>
        ))}
      </div>
      <button className="callout-add-button" onClick={onAddCallout}><MessageSquareText size={16} /><span><strong>Add scientific callout</strong><small>Finding, note, or warning</small></span><span className="plus">+</span></button>
      <button className="callout-add-button" onClick={onOpenModules}><Boxes size={16} /><span><strong>Tissue modules</strong><small>Save and reuse cell networks</small></span><span className="plus">→</span></button>
      <button className="smart-library-button" onClick={onBrowseAssets}>Search smart asset bank <span>SVG</span></button>
      <a className="library-link" href="/asset-catalog.html" target="_blank" rel="noreferrer">
        Browse licensed SVG catalog <span>→</span>
      </a>
      <div className="sidebar-note">
        <span>Rule priority</span>
        <strong>Correctness → readability → aesthetics</strong>
      </div>
    </aside>
  )
}
