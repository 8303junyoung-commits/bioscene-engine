import { createClient, type Session } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '')

export const supabaseConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) && publishableKey.startsWith('sb_publishable_')
export const supabaseApiEndpoint = supabaseConfigured ? `${supabaseUrl}/functions/v1/bioscene-api` : ''

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : undefined

export function watchSupabaseSession(onSession: (session: Session | null) => void) {
  if (!supabase) return () => undefined
  let active = true
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) throw error
    if (active) onSession(data.session)
  }).catch(() => { if (active) onSession(null) })
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onSession(session))
  return () => { active = false; data.subscription.unsubscribe() }
}

export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address')
  const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { emailRedirectTo: window.location.origin } })
  if (error) throw error
}

export async function signOutSupabase() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
