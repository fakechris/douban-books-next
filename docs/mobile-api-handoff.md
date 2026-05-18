# WeRead Mobile API Handoff

Last updated: 2026-05-18

This document explains the WeRead mobile API path used to populate the local PostgreSQL dataset. It is for engineers working in the new project:

```text
/Users/chris/legacy/crawler/douban-books-next
```

The old reference project remains:

```text
/Users/chris/legacy/crawler/douban
```

Use the old project only for historical API behavior, old scripts, and data archaeology. New sync code, projection code, product APIs, and frontend work should live in `douban-books-next`.

## Existing Documentation Locations

Mobile sync and raw-data policy are currently documented across these files:

- `docs/sync-design.md`
  - Main short design note for confirmed mobile endpoints and the current full sync algorithm.

- `docs/HANDOFF.md`
  - General project handoff.
  - Mentions that the mobile API path is the important path for very large shelves.

- `docs/data-mapping.md`
  - Explains how mobile sync payload fields map into `weread_items`.
  - Contains current known sync counts.

- `docs/legacy-migration/safe_migration_runbook.md`
  - Historical migration runbook.
  - Includes the investigation result that Web shelf sync times out for the large shelf and that mobile `skey` sync works.

This file is the mobile-API-specific handoff so new contributors do not have to assemble the story from all of those documents.

## Why Mobile API Matters

The WeRead web shelf sync path can authenticate, but for this very large shelf it hits an upstream server-side timeout. Increasing the local client timeout does not solve that failure because the server itself returns after roughly 3 seconds.

The mobile API path has already been confirmed to handle the large shelf and should be treated as the primary sync source for shelf membership and detailed book metadata.

## Authentication Model

The confirmed mobile path needs:

- `vid`
- mobile `skey`
- iOS-style WeRead request headers matching the current app version

Do not commit real credential values. Do not write real `skey`, Cookie, or auth headers into docs, code, fixtures, request metadata, or test snapshots.

For local scripts, pass credentials through environment variables or another local-only secret mechanism. The known convention from the migration runbook is:

```bash
WEREAD_SKEY=<redacted> WEREAD_VID=<redacted> ./scripts/sync_mobile_skey.sh
```

That script path is historical context from the old workflow. If rebuilt, the new version should live under `douban-books-next`.

## Confirmed Endpoints

All endpoints are under:

```text
https://i.weread.qq.com
```

Confirmed request shapes:

```text
POST /mobileSync
GET  /shelf/sync?album=1&localBookCount=0&onlyBookid=1&synckey=0
GET  /shelf/sync?synckey=0&lectureSynckey=0
POST /shelf/syncbook
GET  /booklists?count=500&countPerBooklist=4&source=prefetch&synckey=0&type=4&userVid=<vid>
```

Use redacted placeholders in examples. Never paste real headers with live `skey`, Cookie, or account identifiers into the repository.

## What Each Endpoint Does

### `POST /mobileSync`

Purpose:

- Returns high-level sync keys and changed domains.
- Useful for understanding whether shelf, booklist, notification, config, or other domains changed.

Important observed fields:

- `shelf`
- `booklist`
- `searchSynckey`
- `rateSynckey`
- `discoverColumnSynckey`
- other app domains such as chat/config/follower

Product use:

- Use it as a sync coordination signal.
- Do not assume it contains the full shelf item list.

### `GET /shelf/sync?...onlyBookid=1...`

Purpose:

- Returns current shelf membership as IDs.
- This is the efficient way to get the large shelf ID set.

Important query parameters:

- `album=1`
- `localBookCount=<current local count>`
- `onlyBookid=1`
- `synckey=<shelf sync key or 0 for full sync>`

Product use:

- Establish the complete current shelf ID set.
- Reset `weread_items.is_in_shelf` from the result of a full successful sync.
- Split returned book IDs into batches for `/shelf/syncbook`.

### `POST /shelf/syncbook`

Purpose:

- Takes book IDs and album IDs in the JSON body.
- Returns detailed metadata for those shelf items.

Request body shape:

```json
{
  "bookIds": ["<book-id-1>", "<book-id-2>"],
  "albumIds": ["<album-id-1>"]
}
```

Product use:

- Primary source for current WeRead book metadata.
- Project `books[]` into `weread_items`.
- Project `albums[]` using the `album:<albumId>` identity convention to avoid collisions with ebook IDs.
- Preserve empty or missing detail IDs as placeholders so shelf membership stays complete.

### `GET /shelf/sync?synckey=0&lectureSynckey=0`

Purpose:

- Returns non-detail shelf state such as progress, albums, archives, and `mp` entries.

Observed useful payload areas:

- `bookProgress`
- `albums`
- `archive`
- `mp`

Product use:

- Progress and archive/folder membership.
- Article-like or placeholder entries.
- Complements `/shelf/syncbook`; it should not replace detail sync.

### `GET /booklists?...`

Purpose:

- Returns WeRead booklists and sample books per list.

Important query parameters:

- `count=500`
- `countPerBooklist=4`
- `source=prefetch`
- `synckey=<booklist sync key or 0>`
- `type=4`
- `userVid=<vid>`

Product use:

- Booklist discovery.
- Projection target is `booklists` and `booklist_items` when full membership is available.
- Current UI already reads collections from PostgreSQL via `/api/collections`.

## Raw Storage Rule

Every upstream mobile response must be saved before projection.

Correct order:

1. Call mobile API.
2. Save raw response to `source_records`.
3. Redact or omit request secrets from request metadata.
4. Project normalized rows into product tables.
5. Make projection idempotent.
6. Expose sync evidence through `/api/sync-runs` and item evidence APIs.

Never project directly into product tables without first saving raw payloads.

## Source Record Naming

Current source names already observed in PostgreSQL:

```text
weread_mobile / shelf/syncbook
weread_mobile / shelf/sync-onlyBookid
weread_mobile / shelf/sync
weread_mobile / booklists
```

Keep these names stable unless there is a schema migration that updates existing records and docs together.

## Projection Targets

Primary projection targets:

- `weread_items`
  - Current shelf items, ebook details, album details, article-like placeholders.

- `source_records`
  - Raw payloads and safe request metadata.

- `booklists`
  - WeRead booklist records.

- `booklist_items`
  - Booklist membership when available.

- `weread_progress_snapshots`
  - Planned target for `bookProgress`.

- `weread_archives` and `weread_archive_items`
  - Planned target for archive/folder membership.

Current read models:

- `weread_next_current_shelf_items`
- `weread_next_shelf_stats`
- `weread_next_shelf_categories`

## Field Mapping Summary

Main detail source priority for product views:

1. `weread_mobile / shelf/syncbook`
2. `weread_mobile / shelf/sync`
3. `weread_mobile / booklists`
4. legacy `douban.weixin`
5. Douban match tables

Selected mappings from `/shelf/syncbook`:

| Product field | Mobile payload field |
| --- | --- |
| `weread_book_id` | `books[].bookId` |
| `title` | `books[].title` |
| `author_text` | `books[].author` |
| `translator_text` | `books[].translator` |
| `cover_url` | `books[].cover` |
| `price` | `books[].price` |
| `paid` | `books[].paid` |
| `pay_type` | `books[].payType` |
| `soldout` | `books[].soldout` |
| `book_status` | `books[].bookStatus` |
| `category` | `books[].category` |
| `rating` | `books[].newRating / 100` |
| `rating_count` | `books[].newRatingCount` |
| `total_words` | `books[].totalWords` |
| `publish_time` | `books[].publishTime` |
| `update_time` | `books[].updateTime` |
| `read_update_time` | `books[].readUpdateTime` |

For albums, use the synthetic product identity:

```text
album:<albumId>
```

For article-like placeholders, keep raw IDs such as:

```text
MP_WXS_*
```

## Known Counts From Latest Successful Full Sync

The current known numbers are documented in `docs/data-mapping.md`:

- ebook IDs requested: `89,749`
- ebook details returned: `89,739`
- empty detail IDs: `10`
- album details returned: `482`
- progress rows returned: `50,459`

The product API has also returned a current shelf total around `90,231` after projection.

## New Project API Relationship

Do not confuse upstream WeRead mobile endpoints with this project's local product API.

Upstream mobile API:

```text
https://i.weread.qq.com/...
```

Local product API:

```text
http://127.0.0.1:5173/api/...
```

Current local endpoints relevant to sync evidence:

- `GET /api/sync-runs`
- `GET /api/shelf/:wereadBookId/evidence`
- `GET /api/source-records`
- `GET /api/source-records/sample`

The frontend should read normalized data from local `/api/*`, not call WeRead directly.

## What Not To Do

- Do not commit real mobile credentials.
- Do not store `skey` or Cookie values in `source_records.request_metadata`.
- Do not use Web Cookie shelf sync as the primary large-shelf path; it has already hit upstream timeout.
- Do not rely on legacy MySQL/Mongo rows for current shelf membership.
- Do not treat `/mobileSync` as the book detail source.
- Do not update `is_in_shelf` from partial/incremental data unless the sync run is explicitly marked as complete.

## Immediate Next Work

Recommended next engineering steps:

1. Move or recreate the historical mobile sync script under `douban-books-next`.
2. Store credentials only through local env vars or a local secret file ignored by Git.
3. Implement a durable sync runner that writes `source_records` first.
4. Add a `sync_runs` table to group batches and record completion state.
5. Add projection for:
   - `bookProgress`
   - archives/folders
   - full booklist membership
6. Add backend tests for:
   - idempotent raw insert
   - idempotent projection
   - no credential persistence
   - complete shelf reset behavior

