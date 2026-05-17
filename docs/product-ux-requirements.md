# Product UX Requirements

## 1. Product Positioning

This product is a shelf-first library workspace for a very large WeRead library.
It is not a crawler UI and should not inherit the old Flask admin experience.

The first product goal is simple: make a large personal book database searchable,
filterable, taggable, comparable, and explainable.

Primary user needs:

- Find books faster than WeRead's native shelf search.
- Search and filter by metadata that WeRead does not expose well, especially price.
- Reuse legacy stored book data instead of treating the current shelf as the only source.
- Display confirmed Douban matches with reliable jump links.
- Compare WeRead with Douban, JD Read, Zhangyue, and any future platforms.
- Allow LLM/Skill-assisted enrichment while preserving raw source data first.

## 2. Design Principles

- Search first. The default screen should make querying, narrowing, sorting, and saving views obvious.
- Dense but readable. The library is large enough that marketing-style cards are not useful as the primary view.
- Evidence-aware. Every displayed fact should be traceable to a source when needed.
- Manual control over irreversible decisions. LLM suggestions can help, but matching and metadata overwrite decisions need user confirmation.
- Tags and collections are first-class. User-created organization is as important as source-provided metadata.
- Keep context while inspecting. Detail panels should open without losing the current search result.

## 3. Core Information Architecture

Persistent left navigation:

- Shelf: current WeRead shelf and all migrated shelf-like records.
- Collections: booklists, folders, desktop directories, saved views, and manual collections.
- Tags: manual tags, imported legacy tags, system tags, and price tags.
- Purchases & Price: purchased state, price buckets, watch lists, and platform price comparison.
- Douban Matches: confirmed matches, candidates, conflicts, and missing matches.
- Platforms: WeRead, Douban, JD Read, Zhangyue, and future source-specific views.
- Notes: notebook books, notes, highlights, and note-driven search.
- Data Quality: missing metadata, conflicting fields, stale records, duplicate candidates.
- Sync Runs: raw source ingestion, projection status, and errors.
- Chat: natural-language search, analysis, and batch operation assistant.

## 4. Primary Screens

### 4.1 Shelf Workspace

Purpose: the default home screen for finding and operating on books.

Layout:

- Top global search bar.
- Saved view tabs below search.
- Compact faceted filter row.
- Result count and operation toolbar.
- Table-first result view.
- Optional cover grid mode for visual browsing.
- Right detail drawer for selected book.
- Optional right-side Chat panel that can operate on current result set or selected items.

Required table columns:

- Cover.
- Title, subtitle, author, translator, publisher.
- Tags and special marks.
- WeRead state: in shelf, archived, read state, progress, update time.
- Purchase state: paid, unpaid, membership, unavailable, sold out.
- Price: current WeRead price, normalized price bucket, platform lowest price.
- Rating: WeRead rating, Douban rating, rating count.
- Match state: confirmed Douban, candidate, conflict, missing.
- Platform presence: WeRead, Douban, JD Read, Zhangyue.
- Last metadata update.
- Row actions: detail, open source, edit tags, compare, ask LLM.

Required filters:

- Text query.
- Price range and price bucket.
- Purchase state.
- Media type: ebook, audiobook, article collection, paperbook, unknown.
- Read state: unread, reading, finished, has progress, no progress.
- Source platform.
- Category.
- Author, translator, publisher.
- Tag.
- Special mark.
- Booklist.
- Desktop directory/folder.
- Archive/folder state.
- Douban match state.
- Data quality flags.
- Availability: available, sold out, removed, unknown.

Required sorts:

- Relevance.
- Price ascending/descending.
- WeRead rating.
- Douban rating.
- Rating count.
- Read update time.
- Shelf update time.
- Publish time.
- Total words/book size.
- Title.
- Author.
- Data quality priority.

### 4.2 Book Detail Drawer

Purpose: inspect one book without leaving search context.

Sections:

- Identity: title, subtitle, author, translator, publisher, ISBN, language.
- WeRead facts: book ID, shelf state, price, paid state, progress, category, update time, source links.
- Douban facts: subject ID, title, author, translator, publisher, rating, tags, jump link.
- Platform comparison: JD Read and Zhangyue IDs, prices, availability, purchase/read state when available.
- Tags and marks: manual tags, imported tags, system tags, special marks, price tags.
- Collections: WeRead booklists, local collections, desktop directories, archive/folder membership.
- Data quality: missing fields, conflicts, duplicate candidates, stale source warnings.
- Raw evidence: source_records references, payload summaries, fetch time.
- LLM evidence: model-generated comparison or enrichment suggestions, with status.

Primary actions:

- Edit tags.
- Add/remove special mark.
- Add to collection.
- Confirm/reject Douban match.
- Open Douban/WeRead/platform link.
- Trigger metadata enrichment.
- Ask LLM about this book.
- View raw source evidence.

### 4.3 Tags

Tags must support both personal organization and migrated legacy markers.

Tag types:

- Manual tags: user-created free-form tags, for example `AI`, `历史`, `想买`, `可送人`.
- Imported legacy tags: tags or markers migrated from old databases.
- System tags: computed tags such as `已购`, `未购`, `高分`, `缺封面`, `匹配冲突`.
- Price tags: computed or manual tags such as `便宜`, `中等`, `贵`, `重点关注`.
- Workflow tags: `待确认`, `待补全`, `待购买`, `待读`, `可归档`.

Tag behavior:

- A book can have many tags.
- Tags are searchable.
- Tags are filter facets.
- Tags can be edited in bulk.
- Tags can be attached to current shelf items and to non-shelf legacy books.
- System tags are not directly edited, but can be used in saved views.
- Imported tags must preserve source provenance.

Tag management screen:

- Tag list with counts.
- Search tags.
- Rename/merge/delete manual tags.
- See which books use a tag.
- Convert a saved search into a tag assignment operation.
- Bulk apply/remove tag to selected books.

### 4.4 Special Marks

Special marks are structured flags that are more precise than tags. They should
cover old database markers and new workflow needs.

Required marks:

- Purchase watch: books that should be watched for purchase.
- Price watch: books whose price changes matter.
- Expensive: high-price bucket.
- Cheap: low-price bucket.
- Metadata incomplete.
- Match needs review.
- Cover mismatch.
- Translator mismatch.
- Author mismatch.
- Platform conflict.
- Hidden from normal browsing.
- Priority reading.

Each mark should have:

- Mark type.
- Optional note.
- Optional severity or priority.
- Optional created source: manual, imported, computed, LLM suggestion.
- Created and updated timestamps.

Marks must appear in:

- Table chips.
- Filter facets.
- Detail drawer.
- Data Quality screen.
- Chat context.

### 4.5 Purchases & Price

Purpose: solve the core pain point that WeRead cannot search/filter well by price.

Required views:

- All paid books.
- All unpaid books.
- Member-readable books.
- Free books.
- Expensive books.
- Cheap books.
- Price watch list.
- Purchase watch list.
- Platform lowest-price list.

Price model:

- Store raw source price.
- Store normalized numeric price.
- Store price bucket.
- Track platform-specific price when available.
- Track paid/purchase/membership state separately from price.

Price bucket defaults:

- Free: `0`.
- Cheap: `0 < price <= 10`.
- Mid: `10 < price <= 30`.
- Expensive: `price > 30`.

The UI must allow bucket thresholds to become configurable later, but first
milestone can use fixed defaults.

### 4.6 Collections, Booklists, and Desktop Directories

The product needs a unified collection model because WeRead booklists, desktop
directories/folders, archive groups, saved views, and manual lists all behave
like ways to organize books.

Collection types:

- WeRead booklist.
- WeRead archive/folder.
- Desktop directory or local folder grouping.
- Manual collection.
- Saved search/view.
- Imported legacy collection.
- Smart collection.

Collection behavior:

- A book can belong to many collections.
- Collections can be searched.
- Collections appear as facets in Shelf Workspace.
- Collection detail page lists member books with the same table controls.
- Saved views should preserve query, filters, sorts, visible columns, and layout mode.
- Manual collections support add/remove selected books.
- Smart collections are query-based and update dynamically.

Collection screen requirements:

- Sidebar or grouped list of collection types.
- Count per collection.
- Last updated time.
- Source/provenance.
- Open collection as a filtered shelf view.
- Compare overlap between collections later.

### 4.7 Douban Matches

Purpose: expose already matched Douban data and make unresolved matches actionable.

Required states:

- Confirmed.
- Imported legacy.
- Candidate.
- Needs review.
- Rejected.
- Conflict.
- Missing.

The UI must show:

- WeRead book identity.
- Douban subject identity.
- Title/author/translator comparison.
- Cover comparison status.
- Rating and rating count.
- Douban jump link.
- Match source and confidence.
- Whether match was imported, manual, or LLM-suggested.

Actions:

- Open Douban.
- Confirm candidate.
- Reject candidate.
- Search candidates.
- Ask LLM to explain match evidence.
- Mark as unresolved/skip.

LLM cannot auto-confirm a match in the first milestone.

### 4.8 Cross-Platform Data

Platforms:

- WeRead.
- Douban.
- JD Read.
- Zhangyue.
- Future platforms via the same source/external ID model.

For each platform, the UI should show:

- External ID.
- Title.
- Author.
- Price.
- Purchase/read/access state when available.
- Availability.
- Cover.
- Source update time.
- Jump link when available.

Cross-platform use cases:

- Find books that are expensive on WeRead but cheaper elsewhere.
- Find books that are missing from WeRead but available in legacy data.
- Compare title/author/translator across platforms.
- Use platform data as evidence for metadata cleanup.

### 4.9 Chat / LLM Workspace

Chat is not a generic chat room. It is an operation assistant over the current
library context.

Supported interaction modes:

- Natural-language search: "找 20 元以内、已购、豆瓣 8 分以上、还没读完的历史书".
- Query explanation: explain why a book appears in current result.
- Metadata analysis: summarize missing fields and conflicts.
- Match explanation: compare WeRead and Douban candidate evidence.
- Batch suggestion: propose tags or collections for selected books.
- Skill-assisted enrichment: call WeRead Skill or related tools to fetch missing data.

Safety rules:

- External fetches must save raw data to `source_records` first.
- Projection happens after raw save.
- LLM suggestions are saved separately from confirmed user edits.
- Any destructive or broad batch update needs confirmation.
- Chat must show the scope it is acting on: selected books, current filtered result, or entire library.

Chat result types:

- A filtered result set.
- A proposed saved view.
- A proposed tag operation.
- A metadata enrichment job.
- A match explanation.
- A data quality report.

## 5. Data Structure Requirements

The UI should be backed by PostgreSQL read models. Existing normalized tables can
remain source-of-truth, but the frontend should query read-oriented views or API
models.

Required conceptual models:

### 5.1 Shelf Item Read Model

Represents one row in the Shelf Workspace.

Fields:

- Canonical item ID.
- WeRead book ID.
- Edition/book ID if matched.
- Title, subtitle, author, translator, publisher.
- Cover URL.
- Medium.
- Category.
- Price and price bucket.
- Paid/purchase/access state.
- Soldout/availability.
- Rating fields.
- Read/progress/update fields.
- Douban match summary.
- Platform availability summary.
- Tags.
- Marks.
- Collections.
- Data quality flags.
- Last projected time.

### 5.2 Tag Model

Suggested tables or equivalent API concepts:

- `tags`: tag definition.
- `item_tags`: relation between item and tag.
- `tag_aliases`: optional future merge/alias support.

Important fields:

- tag name.
- normalized name.
- tag type.
- color/icon hint for UI.
- source system.
- created/updated timestamps.

### 5.3 Special Mark Model

Suggested tables or equivalent API concepts:

- `item_marks`: structured flags on items.

Important fields:

- item ID.
- mark type.
- severity/priority.
- note.
- source: manual, imported, computed, llm.
- source record or job reference.
- created/updated timestamps.

### 5.4 Collection Model

Suggested tables or equivalent API concepts:

- `collections`.
- `collection_items`.
- `saved_views`.

Important fields:

- collection type.
- source system.
- external ID.
- title.
- description.
- query/filter definition for smart collections.
- member count.
- last synced/projected time.

### 5.5 Platform Availability Model

Suggested table or view:

- `platform_items`.

Important fields:

- item/book/edition ID.
- platform.
- external ID.
- title.
- author.
- price.
- access state.
- availability.
- source URL.
- source record ID.
- updated time.

### 5.6 LLM Action Model

Suggested table or view:

- `llm_actions`.
- `llm_action_items`.

Important fields:

- action type.
- prompt/query.
- scope.
- suggested changes.
- status.
- created by.
- source records used.
- confirmed changes.

## 6. Search Requirements

Search is the most important capability.

Search must support:

- Full-text query over title, subtitle, author, translator, publisher, description, tags, notes, booklist names.
- Fuzzy search for typo-tolerant title/author queries.
- Exact lookup for IDs: WeRead book ID, Douban subject ID, ISBN, platform IDs.
- Faceted filtering.
- Saved views.
- Search within current collection/booklist/tag.
- Search across non-shelf legacy books.
- Search result ranking by relevance plus business signals.

Business signals for ranking:

- Current shelf item first.
- Confirmed Douban match.
- Exact title/author match.
- User tags and marks.
- Paid or price-watch state.
- Read/update recency.
- Higher rating when relevance is tied.

Search UI requirements:

- Global search box always visible.
- Query tokens or chips for active filters.
- One-click clear for each filter.
- Search result count visible.
- Search within current result.
- Keyboard-friendly navigation later.
- Empty state should explain which filters caused zero results.

## 7. User Stories

### Search and Discovery

- As a user, I want to search by title, author, translator, ISBN, Douban ID, tag, note, and booklist so I can locate books in a very large shelf.
- As a user, I want to filter by price and paid state so I can find books worth buying or already owned.
- As a user, I want to sort by price, rating, update time, and reading progress so I can decide what to read or buy next.
- As a user, I want saved views so I can return to frequent queries without rebuilding filters.

### Tagging and Organization

- As a user, I want to add tags to one book or many selected books so I can build my own organization layer.
- As a user, I want to search and filter by tags so tags become part of the discovery flow.
- As a user, I want imported legacy marks to remain visible so old organization work is not lost.
- As a user, I want special marks such as purchase watch and price watch so workflow states are explicit.
- As a user, I want smart collections from saved searches so dynamic groups update automatically.

### Booklists and Directories

- As a user, I want WeRead booklists, desktop directories, archive folders, and manual collections in one place so I do not need to remember where a grouping came from.
- As a user, I want to open any collection as a normal shelf result list so all filters and sorts still work.
- As a user, I want to see which collections a book belongs to inside its detail drawer.

### Matching and Metadata

- As a user, I want confirmed Douban matches displayed in the shelf list and detail drawer so I can trust ratings and external links.
- As a user, I want to inspect match evidence before confirming a candidate so bad matches do not pollute the database.
- As a user, I want to see missing or conflicting metadata so I can decide what to fix.
- As a user, I want to trigger Skill/LLM enrichment when data is incomplete, with raw responses saved first.

### Cross-Platform Comparison

- As a user, I want to compare WeRead, Douban, JD Read, and Zhangyue records for the same book so I can evaluate quality and price.
- As a user, I want to find books that are expensive on one platform but cheap or available elsewhere.
- As a user, I want platform-specific links so I can jump to the source quickly.

### Chat / LLM

- As a user, I want to ask natural-language questions over my library so I can search without knowing all filter syntax.
- As a user, I want Chat to operate on selected books or the current filtered result so batch operations are controlled.
- As a user, I want LLM-generated tag/match/metadata suggestions to be reviewable before applying.

## 8. Use Cases

### Use Case 1: Find Cheap Purchased Books to Read

1. User searches for a topic or category.
2. User filters `paid = true`, `price <= 10`, `read state != finished`.
3. User sorts by Douban rating descending.
4. User saves the view as "便宜已购待读".
5. User opens detail drawer and jumps to WeRead.

### Use Case 2: Maintain Purchase Watch List

1. User filters for expensive, unpaid, high-rated books.
2. User selects interesting books.
3. User applies special mark `purchase_watch`.
4. User opens Purchases & Price view later.
5. User sees watch list with current platform price comparison.

### Use Case 3: Bulk Tag a Topic

1. User searches "LLM OR agent OR 大模型".
2. User narrows by category and confirmed Douban match.
3. User selects all relevant rows.
4. User bulk applies tag `AI`.
5. Tag becomes searchable and available as a facet.

### Use Case 4: Review Bad Metadata

1. User opens Data Quality.
2. User filters `cover mismatch` and `translator mismatch`.
3. User opens a candidate book.
4. User asks LLM to compare WeRead and Douban metadata.
5. User confirms the correct match or marks it unresolved.

### Use Case 5: Use WeRead Skill for Missing Details

1. User filters books with missing price or missing author.
2. User selects a small batch.
3. User triggers enrichment.
4. Backend calls WeRead Skill or approved sync path.
5. Raw response is saved to `source_records`.
6. Projection updates read model.
7. UI shows changed fields and source evidence.

### Use Case 6: Browse a Desktop Directory

1. User opens Collections.
2. User selects a desktop directory/folder imported from old data.
3. The shelf table opens with collection filter applied.
4. User searches within the collection and applies tags/marks.

## 9. Operation Toolbar

Operations available from selected rows:

- Edit tags.
- Add/remove special marks.
- Add to manual collection.
- Remove from manual collection.
- Save current query as view.
- Trigger metadata enrichment.
- Ask LLM about selected books.
- Compare with Douban candidate.
- Export selected result later.

Operations available from current filtered result:

- Save view.
- Ask LLM.
- Generate tag suggestions.
- Generate data quality report.
- Start enrichment job with confirmation.

Operations not allowed without explicit confirmation:

- Apply tag to all filtered rows when count is large.
- Confirm many Douban matches.
- Overwrite normalized metadata.
- Delete tags or collections.

## 10. API Requirements

The API should expose read models aligned with the UX:

- `GET /api/shelf`: search, filters, sorting, pagination.
- `GET /api/shelf/stats`: aggregate counts.
- `GET /api/shelf/{id}`: detail drawer data.
- `GET /api/tags`: tag list and counts.
- `POST /api/tags`: create manual tag.
- `PATCH /api/items/tags`: bulk add/remove tags.
- `GET /api/marks`: mark types and counts.
- `PATCH /api/items/marks`: bulk add/remove marks.
- `GET /api/collections`: booklists, folders, directories, saved views, manual collections.
- `GET /api/collections/{id}/items`: collection as shelf result.
- `POST /api/saved-views`: save query/filter/sort/layout.
- `GET /api/matches`: match review queue.
- `PATCH /api/matches/{id}`: confirm/reject/update match.
- `GET /api/platform-items`: cross-platform search/availability.
- `POST /api/llm-actions`: create Chat/LLM action.
- `GET /api/llm-actions/{id}`: inspect action status and suggestions.
- `POST /api/sync-runs`: start sync/enrichment job.
- `GET /api/source-records/{id}`: inspect raw evidence summary.

## 11. First Milestone

The first build should include:

- Shelf table with strong search/filter/sort.
- Detail drawer.
- Manual tags.
- Special marks.
- Price buckets and purchase/price watch views.
- Collections for booklists, archive/folders, desktop directories, and saved views.
- Confirmed Douban match display and jump links.
- Cross-platform summary fields where data already exists.
- Chat panel that can produce filtered searches and non-destructive suggestions.

The first build can defer:

- Final visual design.
- Full keyboard shortcut system.
- Automatic LLM match confirmation.
- Complex price history charts.
- New crawler implementation.
- Public sharing or multi-user permissions.

## 12. Acceptance Criteria

- User can find a known book by title, author, translator, ISBN, Douban ID, and tag.
- User can filter the shelf by price bucket, paid state, tag, special mark, booklist, and desktop directory.
- User can sort by price and ratings.
- User can add and remove tags on selected books.
- User can mark books as purchase watch and price watch.
- User can save a filtered view and reopen it.
- User can open a book detail drawer and see WeRead, Douban, and platform evidence.
- User can open confirmed Douban match links.
- User can ask Chat a natural-language search question and receive a filtered result or suggested query.
- Any enrichment action stores raw source evidence before changing projected fields.

