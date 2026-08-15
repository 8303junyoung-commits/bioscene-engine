import { ArrowDownToLine, ArrowUpToLine, Copy, EyeOff, Lock, Pencil, Scissors, Trash2 } from 'lucide-react'

export type ContextTarget = { id: string; kind: 'node' | 'edge'; x: number; y: number }
type Props = { target: ContextTarget; isMembrane: boolean; locked: boolean; onAction: (action: string) => void }

export function ObjectContextMenu({ target, isMembrane, locked, onAction }: Props) {
  const Item = ({ action, label, icon }: { action: string; label: string; icon: React.ReactNode }) => <button onClick={() => onAction(action)}>{icon}<span>{label}</span></button>
  return <div className="object-context-menu" style={{ left: target.x, top: target.y }} role="menu" data-export-exclude="true">
    <Item action="edit" label={isMembrane ? 'Edit path' : 'Edit'} icon={<Pencil size={14}/>}/>
    <Item action="duplicate" label="Duplicate" icon={<Copy size={14}/>}/>
    {target.kind === 'node' && <><Item action="lock" label={locked ? 'Unlock position' : 'Lock position'} icon={<Lock size={14}/>}/><Item action="hide" label="Hide" icon={<EyeOff size={14}/>}/><Item action="front" label="Bring to front" icon={<ArrowUpToLine size={14}/>}/><Item action="back" label="Send to back" icon={<ArrowDownToLine size={14}/>} /></>}
    {isMembrane && <><div className="context-separator"/><Item action="straighten" label="Straighten path" icon={<Scissors size={14}/>}/><Item action="split" label="Split at middle" icon={<Scissors size={14}/>}/><Item action="flip" label="Flip inside/outside" icon={<ArrowDownToLine size={14}/>} /></>}
    <div className="context-separator"/><Item action="delete" label="Delete" icon={<Trash2 size={14}/>}/>
  </div>
}
