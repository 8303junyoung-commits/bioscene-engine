import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ELK is already loaded only when Auto layout is requested. Its bundled worker
  // is intentionally self-contained, so use a limit that still catches growth in
  // ordinary application chunks without warning for this isolated dependency.
  build: { chunkSizeWarningLimit: 1500 },
  server: { headers: securityHeaders() },
  preview: { headers: securityHeaders() },
})

function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://www.ebi.ac.uk https://alphafold.ebi.ac.uk http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }
}

