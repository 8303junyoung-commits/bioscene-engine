import { Cloud, KeyRound, LogIn, LogOut, MessageSquare, RefreshCw, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CollaborationState, RoomConfig } from '../types'
import { uid } from '../identity'

interface Props {
  value: CollaborationState
  room: RoomConfig
  token: string
  busy: boolean
  supabaseConfigured: boolean
  signedInEmail?: string
  authBusy: boolean
  onSignIn: (email: string) => void
  onSignOut: () => void
  onChange: (next: CollaborationState) => void
  onRoomChange: (next: RoomConfig) => void
  onTokenChange: (value: string) => void
  onPush: () => void
  onPull: () => void
  onClose: () => void
}

export function CollaborationPanel({ value, room, token, busy, supabaseConfigured, signedInEmail, authBusy, onSignIn, onSignOut, onChange, onRoomChange, onTokenChange, onPush, onPull, onClose }: Props) {
  const [author, setAuthor] = useState(value.participants[0] ?? '')
  const [body, setBody] = useState('')
  const [email, setEmail] = useState('')
  const [participantsDraft, setParticipantsDraft] = useState(value.participants.join(', '))
  useEffect(() => setParticipantsDraft(value.participants.join(', ')), [value.participants])
  const commitParticipants = () => onChange({ ...value, participants: participantsDraft.split(',').map((item) => item.trim()).filter(Boolean) })
  const addComment = () => {
    if (!body.trim()) return
    const who = author.trim() || signedInEmail || 'Anonymous'
    const now = new Date().toISOString()
    onChange({
      ...value,
      comments: [{ id: uid('comment'), author: who, body: body.trim(), createdAt: now, resolved: false }, ...value.comments],
      activity: [{ id: uid('activity'), actor: who, action: 'Added a review comment', createdAt: now }, ...value.activity].slice(0, 50),
    })
    setBody('')
  }
  const authReady = room.authMode === 'none' || !!token
  const ready = !!room.endpoint && !!room.roomId && authReady

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Collaboration hub">
    <section className="phase9-panel">
      <header><div><span className="eyebrow">PHASE 11 · CLOUD COLLABORATION</span><h2><Cloud size={21}/> Authenticated review room</h2><p>Sign in with Supabase and synchronize versioned scenes without exposing server credentials.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="phase9-body collaboration-grid">
        <div>
          <label>Participants<input aria-label="Participants" value={participantsDraft} onChange={(event) => setParticipantsDraft(event.target.value)} onBlur={commitParticipants} placeholder="Scientist, reviewer, designer"/></label>
          <div className="comment-compose"><input aria-label="Comment author" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder={signedInEmail || 'Author'}/><textarea aria-label="Comment body" rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a scientific review comment"/><button onClick={addComment}><MessageSquare size={14}/> Add comment</button></div>
          <div className="comment-list">{value.comments.map((item) => <article key={item.id} className={item.resolved ? 'resolved' : ''}><div><strong>{item.author}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><p>{item.body}</p><button onClick={() => onChange({ ...value, comments: value.comments.map((comment) => comment.id === item.id ? { ...comment, resolved: !comment.resolved } : comment) })}>{item.resolved ? 'Reopen' : 'Resolve'}</button></article>)}</div>
        </div>
        <div className="sync-card">
          {supabaseConfigured && <section className="cloud-auth-card"><h3>Supabase account</h3>{signedInEmail ? <><p className="auth-identity">Signed in as <strong>{signedInEmail}</strong></p><button disabled={authBusy} onClick={onSignOut}><LogOut size={14}/> Sign out</button></> : <><p>Receive a secure magic link. The resulting access token is refreshed automatically and never exported.</p><label>Email<input aria-label="Supabase sign-in email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="scientist@example.com"/></label><button disabled={authBusy || !email.trim()} onClick={() => onSignIn(email)}><LogIn size={14}/> Send sign-in link</button></>}</section>}
          <h3>Production backend</h3>
          <p>Uses version-aware <code>GET/PUT /rooms/:roomId</code>. Tokens remain browser-session credentials and are never exported.</p>
          <label>Endpoint<input aria-label="Sync endpoint" type="url" value={room.endpoint} onChange={(event) => onRoomChange({ ...room, endpoint: event.target.value, revision: undefined })} placeholder="https://project.supabase.co/functions/v1/bioscene-api"/></label>
          <label>Room ID<input aria-label="Room ID" value={room.roomId} onChange={(event) => onRoomChange({ ...room, roomId: event.target.value, revision: undefined })} placeholder="study-001"/></label>
          <label>Authentication<select aria-label="Authentication mode" value={room.authMode} onChange={(event) => onRoomChange({ ...room, authMode: event.target.value as RoomConfig['authMode'] })}><option value="none">None (local development)</option><option value="bearer">Bearer token</option><option value="api-key">API key</option></select></label>
          {room.authMode === 'api-key' && <label>API key header<input aria-label="API key header" value={room.apiKeyHeader} onChange={(event) => onRoomChange({ ...room, apiKeyHeader: event.target.value })} placeholder="X-API-Key"/></label>}
          {room.authMode !== 'none' && !signedInEmail && <label><span><KeyRound size={13}/> Session credential</span><input aria-label="Session credential" type="password" autoComplete="off" value={token} onChange={(event) => onTokenChange(event.target.value)} placeholder={room.authMode === 'bearer' ? 'Bearer token' : 'API key'}/><small>Stored only for this browser session; excluded from autosave, Scene JSON, ZIP, and room payloads.</small></label>}
          <div className="sync-actions"><button disabled={busy || !ready} onClick={onPush}><Send size={14}/> Push revision</button><button disabled={busy || !ready} onClick={onPull}><RefreshCw size={14}/> Pull latest</button></div>
          {room.revision && <small className="revision-chip">Server revision {room.revision}</small>}{room.lastSyncedAt && <small>Last synced {new Date(room.lastSyncedAt).toLocaleString()}</small>}
          <h3>Activity</h3><ul>{value.activity.slice(0, 8).map((item) => <li key={item.id}><strong>{item.actor}</strong> {item.action}<small>{new Date(item.createdAt).toLocaleString()}</small></li>)}</ul>
        </div>
      </div>
    </section>
  </div>
}
