# WeRead Next

`weread-next` is a clean rebuild of the WeRead/Douban bookshelf product.
The legacy `books/` application remains available as a data source, migration
reference, and operational fallback, but new product work should happen here.

## Product Center

The rebuilt product is shelf-first:

- current WeRead shelf as the primary home view
- booklists, archives, albums, and reading progress as first-class filters
- fast search over title, author, translator, category, publisher, and notes
- price, purchase, membership, shelf status, rating, and reading-state sorting
- explicit sync runs with raw payload preservation before projection

## Directory Layout

```text
weread-next/
  apps/
    api/      Backend service boundary and API contract
    web/      Frontend product shell and interaction model
  docs/
    architecture.md
    data-mapping.md
    product-ux-requirements.md
    sync-design.md
    product-scope.md
  packages/
    shared/   Shared DTO and schema definitions
```

## Product Requirements

Start with [`docs/product-ux-requirements.md`](docs/product-ux-requirements.md)
for the user stories, use cases, information architecture, search requirements,
tagging model, collection model, operation toolbar, and first-milestone scope.

## Current Data Sources

The new system reads from PostgreSQL, not directly from legacy MySQL, MongoDB,
or Elasticsearch.

Primary tables already available:

- `weread_items`
- `source_records`
- `booklists`
- `booklist_items`
- `purchase_history`
- `books`
- `editions`
- `external_ids`
- `contributors`
- `edition_contributors`
- `book_matches`

Current shelf sync source:

- `weread_mobile / shelf/sync-onlyBookid`: current shelf IDs and archive membership
- `weread_mobile / shelf/syncbook`: current shelf metadata details
- `weread_mobile / shelf/sync`: progress, albums, archives, and `mp`
- `weread_web / notebook`: notebook books

## First Build Milestone

1. Backend read API for shelf list, filters, sorting, search, and sync status.
2. Frontend shelf table/grid with dense operational controls.
3. Detail drawer for book metadata, purchase state, reading state, matches, and raw evidence.
4. Manual sync trigger that stores raw payloads first, then projects.

## Local App

The current implementation runs as a local Node/Express app backed by the
PostgreSQL database `weread_douban_migration`.

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:5173`. The app serves the frontend and `/api/*` from the
same process. Shelf reads come from PostgreSQL; tag, mark, and saved-view
operations write back to the local workspace tables.
