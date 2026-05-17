# Implementation Plan

## Phase 1: Read Model And Shelf UI

- Apply `apps/api/sql/001_shelf_read_models.sql`.
- Implement `GET /api/shelf` over `weread_next_current_shelf_items`.
- Implement `GET /api/shelf/stats` over `weread_next_shelf_stats`.
- Build the frontend shelf table with search, filters, and sorting.
- Add a detail drawer backed by `weread_items` and linked raw source records.

## Phase 2: Sync Runs

- Add `sync_runs` and `sync_run_events`.
- Move the current `books/tools/sync_weread_mobile_skey.py` flow behind a backend job command.
- Save raw payloads before projection.
- Show latest sync status and gaps in the UI.

## Phase 3: Booklists And Archives

- Project current mobile `booklists` payloads into new booklist read models.
- Project current mobile archive membership into archive read models.
- Add booklist/archive filters to the shelf table.

## Phase 4: Matching And Evidence

- Show current WeRead/Douban matches.
- Add model-assisted match candidates.
- Keep model output as evidence until explicitly accepted.

