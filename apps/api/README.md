# API App

Initial backend direction: a small PostgreSQL-backed service for the rebuilt UI.

## Proposed Endpoints

```text
GET  /api/shelf
GET  /api/shelf/:wereadBookId
GET  /api/booklists
GET  /api/booklists/:booklistId
GET  /api/archives
GET  /api/sync-runs
POST /api/sync-runs
GET  /api/search
```

## Shelf Query Parameters

```text
q
media=ebook|audiobook|article
paid=true|false
soldout=true|false
finished=true|false
archiveId
booklistId
category
sort=readUpdateTime|updateTime|price|rating|ratingCount|title|author|totalWords
direction=asc|desc
limit
cursor
```

## First Implementation Notes

- Use SQL views for read models before adding a large ORM layer.
- Keep raw evidence links in responses for detail views.
- Do not make request handlers call WeRead directly; sync should be a job.

