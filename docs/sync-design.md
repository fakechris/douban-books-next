# Sync Design

## Confirmed WeRead Mobile Flow

Authentication:

- `vid`
- mobile `skey`
- iOS WeRead headers matching current app version

Confirmed endpoints:

```text
POST /mobileSync
GET  /shelf/sync?album=1&localBookCount=0&onlyBookid=1&synckey=0
GET  /shelf/sync?synckey=0&lectureSynckey=0
POST /shelf/syncbook
GET  /booklists?count=500&countPerBooklist=4&source=prefetch&synckey=0&type=4&userVid=<vid>
```

## Current Full Sync Algorithm

1. Call `onlyBookid=1&synckey=0`.
2. Split ebook IDs into batches of 1,000.
3. Include all album IDs in the first batch, or sync albums separately.
4. Call `/shelf/syncbook` for each batch.
5. Save each raw response under `books/runtime/...` and `source_records`.
6. Project `books[]` and `albums[]` into `weread_items`.
7. Insert placeholders for `emptyInfoIds`.
8. Reset `is_in_shelf` from the full current sync, not from stale legacy rows.

## Safety Rules

- Never store `skey` or Cookie values in PostgreSQL request metadata.
- Raw response payloads are preserved.
- Sync can be resumed by `start-batch`.
- Projection is idempotent by `weread_book_id`.
- Current-shelf state must be based on a full sync run, not an incremental-only run.

## Open Work

- Add a durable `sync_runs` table.
- Project `bookProgress` into `weread_progress_snapshots`.
- Project archive membership into `weread_archives` and `weread_archive_items`.
- Project `booklists` and booklist membership from current mobile payloads.
- Add a scheduler for periodic sync.

