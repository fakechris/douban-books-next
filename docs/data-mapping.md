# Data Mapping

## Current Shelf Identity

`weread_items.weread_book_id` is the product identity for WeRead entries.

Recommended ID rules:

- ebook: raw WeRead `bookId`, for example `3300198342`
- album/audiobook: `album:<albumId>`, to avoid collision with ebook IDs
- article/floating placeholders: raw `MP_WXS_*` or synthetic entry IDs when no detail payload exists

## Shelf Detail Source Priority

For current shelf product views:

1. `weread_mobile / shelf/syncbook`
2. `weread_mobile / shelf/sync`
3. `weread_mobile / booklists`
4. legacy `douban.weixin`
5. Douban match tables

Raw source order matters because old legacy rows may be stale.

## Field Mapping

| Product field | Source field | Notes |
| --- | --- | --- |
| title | `books[].title` | From `/shelf/syncbook` |
| author | `books[].author` | Raw author text |
| translator | `books[].translator` | Should become contributor role later |
| cover_url | `books[].cover` | Prefer current WeRead cover |
| price | `books[].price` | Unit: yuan |
| cent_price | `books[].centPrice` | Add column or computed field if needed |
| paid | `books[].paid` | `1` means purchased/owned |
| pay_type | `books[].payType` | Keep raw integer |
| soldout | `books[].soldout` | `1` means unavailable/sold out |
| book_status | `books[].bookStatus` | Keep raw integer |
| category | `books[].category` | Also preserve `categories[]` in raw |
| rating | `books[].newRating / 100` | Schema supports `10.00` |
| rating_count | `books[].newRatingCount` | WeRead rating count |
| total_words | `books[].totalWords` | Ebook word count |
| publish_time | `books[].publishTime` | Convert to timestamp |
| update_time | `books[].updateTime` | Unix timestamp |
| read_update_time | `books[].readUpdateTime` | Unix timestamp |
| finish_reading | `books[].finishReading` | Reading-state field |
| secret | `books[].secret` | Private shelf marker |

## Current Known Counts

Latest successful full current shelf sync:

- ebook IDs requested: 89,749
- ebook details returned: 89,739
- empty detail IDs: 10
- album details returned: 482
- progress rows returned: 50,459

The 10 empty IDs are currently represented as placeholder shelf rows.

