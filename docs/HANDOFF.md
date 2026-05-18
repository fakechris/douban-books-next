# WeRead Next Handoff

Last updated: 2026-05-17

## Current Working Directory

New project:

```text
/Users/chris/legacy/crawler/douban-books-next
```

Remote:

```text
https://github.com/fakechris/douban-books-next.git
```

Legacy reference project:

```text
/Users/chris/legacy/crawler/douban
```

The legacy `douban` project is the historical reference and migration source. New product work should happen in `douban-books-next`. Do not continue feature development in the old `douban` application unless the task is explicitly about legacy archaeology or data recovery.

## Why This Project Exists

The old implementation was built when the local database could not comfortably support search, relationship-heavy collections, and mixed operational metadata. It split responsibilities across MySQL, MongoDB, and Elasticsearch.

The new direction is to consolidate the product around PostgreSQL:

- PostgreSQL is the system of record for migrated WeRead, Douban, JD Read, Zhangyue, and legacy metadata.
- Raw sync payloads are preserved in `source_records` before projection.
- Product-facing state such as manual tags, marks, saved views, and local collections lives in PostgreSQL.
- The frontend is rebuilt as a shelf-first workspace rather than preserving the old UI.

## Current Implementation State

The app is no longer only a static prototype. It now has a local Node/Express backend and a browser UI served from the same process.

Run from the new project root:

```bash
cd /Users/chris/legacy/crawler/douban-books-next
npm install
npm run db:migrate
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The app expects the local PostgreSQL database:

```text
weread_douban_migration
```

You can override the connection with `PG_DSN` if needed.

## Important Files

Backend:

- `apps/api/server.js`
  - Express API.
  - Serves `/api/*`.
  - Serves the frontend from `apps/web`.
  - Reads shelf/search/collections/quality/sync data from PostgreSQL.
  - Writes manual tags, marks, and saved views back to PostgreSQL.

Database migrations:

- `apps/api/sql/001_shelf_read_models.sql`
  - Creates read model views:
    - `weread_next_current_shelf_items`
    - `weread_next_shelf_stats`
    - `weread_next_shelf_categories`

- `apps/api/sql/002_product_workspace_tables.sql`
  - Creates product workspace tables:
    - `tag_metadata`
    - `item_tags`
    - `item_marks`
    - `saved_views`
    - `manual_collections`
    - `manual_collection_items`
  - Seeds default saved views and desktop-directory placeholders.

- `scripts/migrate-local-db.sh`
  - Finds local `psql`.
  - Executes all SQL files in `apps/api/sql/*.sql` in order.
  - Safe to rerun.

Frontend:

- `apps/web/index.html`
  - Browser-loaded React/Babel app.
  - Loads `app/api-client.js` before JSX modules.

- `apps/web/app/api-client.js`
  - Thin browser API client.
  - Normalizes backend book rows into the existing prototype shape.

- `apps/web/app/app.jsx`
  - Fetches real shelf data from `/api/shelf`.
  - Shows API status chip: `PostgreSQL live`, `loading DB`, or fallback.

- `apps/web/app/shelf.jsx`
  - Main shelf table/grid.
  - Batch operations now write to the local database:
    - add tag `待整理`
    - add mark `purchase_watch`
    - save current view into `saved_views`

- `apps/web/app/screens.jsx`
  - Collections, platforms, notes, data quality, and sync runs now use `/api/*` where available.

Product/architecture docs:

- `docs/product-ux-requirements.md`
- `docs/architecture.md`
- `docs/data-mapping.md`
- `docs/sync-design.md`
- `docs/implementation-plan.md`
- `docs/legacy-migration/*`

## Current API Surface

Implemented endpoints:

- `GET /api/health`
- `GET /api/shelf`
- `GET /api/shelf/stats`
- `GET /api/shelf/:wereadBookId`
- `GET /api/tags`
- `POST /api/tags`
- `PATCH /api/items/tags`
- `PATCH /api/items/marks`
- `GET /api/collections`
- `GET /api/collections/:id/items`
- `POST /api/saved-views`
- `GET /api/notes`
- `GET /api/quality`
- `GET /api/sync-runs`

Main shelf query parameters:

- `q`
- `sort`
- `direction`
- `limit`
- `offset`
- `paid`
- `medium`
- `priceMin`
- `priceMax`
- `tag`
- `mark`
- `match`
- `platform`
- `quality`

## Current Data State

The local PostgreSQL migration currently has the shelf-scale dataset available. Recent smoke tests confirmed:

- `/api/health` connects to `weread_douban_migration`.
- `/api/shelf?limit=1` returns live shelf rows.
- Total current shelf count is around `90231`.
- `/api/collections` returns legacy booklists plus seeded manual/saved collections.
- `/api/quality` returns data quality candidates.
- `/api/sync-runs` reads grouped import/sync history from `source_records`.

Raw sync records already observed include:

- `weread_mobile / shelf/syncbook`
- `weread_mobile / shelf/sync-onlyBookid`
- `weread_mobile / shelf/sync`
- `weread_mobile / booklists`
- `weread_web / shelf`
- `weread_web / notebook`
- legacy MySQL and Mongo imports

## Core Product Direction

Primary use case:

The user has a very large WeRead shelf and needs a much stronger way to search, filter, organize, price-check, and compare books than the native WeRead app provides.

Primary product surface:

- Shelf-first table/grid.
- Strong search over metadata, tags, booklists, notes, ISBN, platform IDs, and match data.
- Price and purchase-state filtering.
- Manual tags and special marks.
- Saved views.
- Booklist and desktop-directory grouping.
- Douban match visibility and jump targets.
- JD Read and Zhangyue availability/offer display.
- Data quality queue for missing metadata, missing Douban matches, weak matches, and cover/translator discrepancies.
- LLM-assisted comparison and metadata cleanup later.

## Old Project Role

Use `/Users/chris/legacy/crawler/douban` for:

- Understanding old API calls and sync behavior.
- Inspecting historical scripts, old sync assumptions, and crawler logic.
- Comparing old MySQL/Mongo/ES models against the new PostgreSQL model.
- Recovering data mapping decisions.

Do not use it for:

- New frontend implementation.
- New backend product APIs.
- New database tables.
- New product documentation, except when explicitly documenting legacy behavior.

## Sync Principles

Any future sync implementation should follow this rule:

1. Save raw upstream payload into `source_records`.
2. Redact or avoid storing sensitive request credentials.
3. Project raw payloads into product tables only after raw storage succeeds.
4. Make projection idempotent.
5. Keep sync history visible in `/api/sync-runs`.

The old sync investigation found that large shelves may fail through some web/skill paths. The mobile API path still matters:

- `/mobileSync`
- `/shelf/sync?album=1&localBookCount=...&onlyBookid=1&synckey=...`
- `/shelf/syncbook`
- `/booklists`

Credentials such as `vid`, `skey`, cookies, and request headers must not be committed.

## Known Gaps

This is a working local implementation, but not yet a polished production app.

Known gaps:

- Frontend is still browser-loaded React/Babel, not a proper bundled app.
- Advanced filter UI is partly local/prototype logic and should be wired fully into `/api/shelf`.
- Tags page and price page still need deeper API-backed implementations.
- Collection item preview currently uses old local mock filtering in parts; collection listing itself is API-backed.
- Notes endpoint returns no rows if local migrated notes are absent.
- LLM/chat actions are still product placeholders.
- No automated browser screenshot verification is available in the current local environment because headless Chromium failed to launch reliably.
- No auth layer is implemented; this is a local-only app.

## Suggested Next Steps

1. Replace browser-loaded React/Babel with a real frontend build setup.
   - Vite or another lightweight React setup is enough.
   - Preserve current UI/UE structure during the migration.

2. Make filtering fully server-driven.
   - Saved view tabs should translate into `/api/shelf` query params.
   - Filter chips should update API filters, not just local result filtering.
   - Add pagination backed by `limit` and `offset`.

3. Complete write operations.
   - Real tag editor instead of always adding `待整理`.
   - Real mark picker for `purchase_watch`, `price_watch`, `priority_reading`, `metadata_incomplete`, etc.
   - Add/remove from manual collections.
   - Saved view editor with visible saved views from PostgreSQL.

4. Improve detail drawer.
   - Fetch `/api/shelf/:wereadBookId` on open.
   - Show raw source record ID and sync provenance.
   - Show Douban match evidence, external IDs, offers, notes, and quality flags.

5. Add sync runner later.
   - Do not start with crawler complexity.
   - First expose a safe local endpoint/CLI that imports a saved raw payload into `source_records`.
   - Then add mobile API sync once credential handling is designed.

6. Add tests.
   - Backend API smoke tests.
   - SQL migration idempotency test.
   - Basic frontend rendering test once the build setup is modernized.

## Operational Notes

Use this repo for future work:

```bash
cd /Users/chris/legacy/crawler/douban-books-next
git status
npm run db:migrate
npm run dev
```

Avoid writing important project artifacts to `/tmp` or `/private/tmp`; machine restarts can lose that state. Keep durable project files under `douban-books-next`.

Before pushing public changes, scan source files for credential-related terms:

```bash
rg -n -i "(skey|cookie|authorization|bearer|accessToken|wr_skey|openid)" apps docs scripts README.md package.json
```

Expected result for committed source files should be no real credentials. If the scan only finds this handoff guidance or other documentation examples, inspect those lines manually before pushing.

## Last Verified

Verified locally before this handoff:

- `npm run db:migrate` succeeds and is idempotent.
- `node --check apps/api/server.js` succeeds.
- `node --check apps/web/app/api-client.js` succeeds.
- `GET http://127.0.0.1:5173/api/health` returns `ok: true`.
- `GET http://127.0.0.1:5173/api/shelf?limit=1` returns a live PostgreSQL shelf item.
- Secret scan over committed source paths returned no matches for known WeRead/GitHub/OpenAI credential patterns.
