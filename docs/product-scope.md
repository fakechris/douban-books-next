# Product Scope

## Goal

Rebuild the bookshelf product around the current WeRead shelf data, not around
the legacy crawler UI. The product should make a large personal library
searchable, sortable, inspectable, and safely syncable.

## Core Views

- Shelf: all current shelf entries, including ebooks, albums, and article entries.
- Booklists: WeRead booklists and their member books.
- Archives: WeRead shelf folders/archive membership.
- Purchases: paid/free/trial/member-access views.
- Matches: WeRead-to-Douban matching state and confidence.
- Sync Runs: raw-source ingestion history and projection status.

## Core Workflows

- Find a book quickly by title, author, translator, category, ISBN, or Douban match.
- Sort the current shelf by price, paid state, rating, read time, update time, word count, and title.
- Filter by paid/unpaid, sold out, private, finished, in progress, category, archive, booklist, and media type.
- Inspect one book with all known source evidence.
- Trigger a sync and see exactly which raw payloads were saved and projected.
- Compare WeRead and Douban metadata with model-assisted evidence later.

## Non-goals For The First Milestone

- Rebuilding the old Flask-AppBuilder admin screens.
- Reintroducing Elasticsearch or MongoDB for normal product reads.
- Editing historical raw payloads.
- Automatically approving model-generated WeRead/Douban matches.

