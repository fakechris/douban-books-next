-- Read models for the rebuilt shelf-first product.
-- These views are intentionally simple and can be replaced by materialized
-- views once query behavior is validated.

CREATE OR REPLACE VIEW weread_next_current_shelf_items AS
SELECT
  wi.weread_book_id,
  wi.medium,
  wi.title,
  wi.author_text,
  wi.category,
  wi.cover_url,
  wi.price,
  wi.paid,
  wi.pay_type,
  wi.soldout,
  wi.book_status,
  wi.publish_time,
  wi.update_time,
  wi.read_update_time,
  wi.total_words,
  wi.book_size,
  wi.rating,
  wi.rating_count,
  wi.is_in_shelf,
  wi.raw_source_record_id,
  wi.updated_at,
  CASE
    WHEN wi.weread_book_id LIKE 'MP_WXS_%' THEN true
    WHEN wi.weread_book_id IN ('mpbook', 'wxFloatingBook') THEN true
    ELSE false
  END AS is_article_like,
  CASE
    WHEN wi.paid IS true THEN 'paid'
    WHEN wi.soldout IS true THEN 'unavailable'
    WHEN wi.pay_type IS NOT NULL THEN 'unpaid_or_membership'
    ELSE 'unknown'
  END AS ownership_state
FROM weread_items wi
WHERE wi.is_in_shelf IS true;

CREATE OR REPLACE VIEW weread_next_shelf_stats AS
SELECT
  count(*) AS total_items,
  count(*) FILTER (WHERE medium = 'ebook') AS ebook_count,
  count(*) FILTER (WHERE medium = 'audiobook') AS audiobook_count,
  count(*) FILTER (WHERE paid IS true) AS paid_count,
  count(*) FILTER (WHERE paid IS false) AS unpaid_count,
  count(*) FILTER (WHERE soldout IS true) AS soldout_count,
  count(*) FILTER (WHERE read_update_time IS NOT NULL) AS has_read_progress_count,
  count(*) FILTER (WHERE weread_book_id LIKE 'MP_WXS_%') AS placeholder_article_count,
  max(updated_at) AS last_projected_at
FROM weread_next_current_shelf_items;

CREATE OR REPLACE VIEW weread_next_shelf_categories AS
SELECT
  category,
  medium,
  count(*) AS item_count,
  count(*) FILTER (WHERE paid IS true) AS paid_count,
  avg(price) FILTER (WHERE price IS NOT NULL) AS avg_price,
  max(read_update_time) AS latest_read_update_time
FROM weread_next_current_shelf_items
GROUP BY category, medium;

