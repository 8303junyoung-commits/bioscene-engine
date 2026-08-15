# BioScene Phase 10 backend contract

The Phase 11 reference implementation is deployed as the Supabase Edge Function in `supabase/functions/bioscene-api`. Its database definition lives in `supabase/migrations` and keeps browser clients away from service-role credentials.

The editor remains a static client. A production deployment supplies an authenticated JSON service through `VITE_BIOSCENE_API_BASE` or the Collaboration panel.

## Authentication

- Bearer mode sends `Authorization: Bearer <session token>`.
- API-key mode sends the configured header, defaulting to `X-API-Key`.
- Credentials are kept in browser session storage only and are excluded from Scene JSON, autosave, review ZIPs, and request bodies.

## Versioned rooms

### `GET /rooms/:roomId`

Return either a BioScene Scene object or `{ "scene": <Scene>, "revision": "opaque-revision" }`. An `ETag` header is preferred and takes precedence over the JSON revision.

### `PUT /rooms/:roomId`

The client sends `{ "scene": <Scene>, "revision": "opaque-revision" }`. When a revision is known it also sends `If-Match`. Return the new `ETag` or JSON revision. Respond with `409` or `412` for conflicts; the editor will require a pull before another push.

## Literature enrichment

### `POST /literature/enrich`

Request: `{ "sourceType": "pubmed|doi|url|internal", "identifier": "...", "url": "..." }`.

Response fields are optional: `title`, `authors`, `year`, `abstract`, and an HTTP(S) `url`. The client bounds and validates the response before merging it into the evidence library.

## Operational requirements

- Require HTTPS outside localhost.
- Enforce authorization server-side for every room and enrichment request.
- Set CORS to the exact editor origin; never use credentialed wildcard CORS.
- Limit request size and reject schemas newer than the backend supports.
- Keep room revisions immutable or audit logged.
- Apply rate limits and upstream timeouts to literature providers.
