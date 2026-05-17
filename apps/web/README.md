# Web App

Initial frontend direction: a dense shelf-management UI for a very large library.

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

