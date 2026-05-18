# Web App

This directory contains the browser UI for the rebuilt WeRead/Douban bookshelf
workspace. It keeps the imported prototype's UI/UE, but now reads and writes
through the local API backed by PostgreSQL.

## Run Locally

From the repository root:

```bash
npm install
npm run db:migrate
npm run dev
```

Then open `http://localhost:5173`.

Do not open `index.html` directly from the filesystem. The app must be served by
`apps/api/server.js` so `/api/*` can read and write the local PostgreSQL
database.

## Primary Screens

- Shelf
- Booklists
- Archives
- Purchases
- Matches
- Sync Runs

## Shelf Screen

Default layout:

- left navigation
- compact top toolbar with search, filters, sort, and sync status
- virtualized table as the default view
- optional cover grid for browsing
- detail drawer for selected book

Primary columns:

- cover
- title
- author / translator
- category
- paid
- price
- rating
- reading state
- archive / booklist indicators
- updated / read updated time

## UX Rules

- Optimize for scanning and repeated use.
- Keep filter state visible.
- Do not hide sync errors.
- Use drawer navigation instead of full page jumps for book inspection.

## Prototype Coverage

The imported prototype covers:

- shelf search, saved views, filters, sorting, table/grid modes
- manual tags, imported tags, system tags, price tags, workflow tags
- purchase and price watch areas
- Douban match review states
- cross-platform badges for WeRead, Douban, JD Read, and Zhangyue
- detail drawer with source evidence, data quality, collections, and Chat context
- floating Chat workspace and full Chat screen
