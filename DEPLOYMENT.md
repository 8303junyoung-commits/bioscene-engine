# BioScene Engine cloud deployment

## Architecture

- **GitHub** stores the source, lockfile, Render Blueprint, and Supabase migration/function source.
- **Render Static Site** builds the Vite application and applies SPA routing plus security headers from `render.yaml`.
- **Supabase Auth** issues passwordless email sessions. Only the publishable browser key is included in the Vite build.
- **Supabase Edge Function** validates every JWT and is the only application path to room storage.
- **Postgres** stores versioned scenes, room membership, and immutable room audit events.

## Render variables

Set these during the initial Blueprint creation:

```text
VITE_SUPABASE_URL=https://qluukprxqvesmvnekhsy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
VITE_BIOSCENE_API_BASE=https://qluukprxqvesmvnekhsy.supabase.co/functions/v1/bioscene-api
```

The publishable key is intended for browser use. Never add a Supabase secret key or service-role key to Render or any `VITE_` variable.

## Supabase Auth URLs

After Render creates the site, add its exact HTTPS origin as the Supabase **Site URL** and as an allowed redirect URL. Local development uses `http://localhost:5173`.

## Security model

- Edge Function gateway JWT verification is enabled.
- The function revalidates the user and performs owner/member authorization for every room request.
- Existing-room writes require `If-Match`; stale writes return `412`.
- Browser roles have no direct table grants. RLS remains enabled as defense in depth.
- Service-role credentials exist only in the managed Edge Function environment.
- CORS accepts only configured origins.
- Scene payloads are limited to 5 MB and must declare `bioscene.scene.v0.10`.
- Literature URL input is never fetched arbitrarily; DOI and PMID use bounded Crossref and PubMed endpoints.

## Verification

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

After deployment, verify the home page, the Collaboration panel, passwordless sign-in, first room push, pull, revision conflict handling, and response security headers.
