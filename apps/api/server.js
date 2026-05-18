const path = require("path");
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 5173);
const webRoot = path.resolve(__dirname, "../web");

const pool = new Pool(
  process.env.PG_DSN
    ? { connectionString: process.env.PG_DSN }
    : { database: "weread_douban_migration" }
);

app.use(express.json({ limit: "2mb" }));

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toBool = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
};

const platformKeys = {
  weread: "w",
  douban: "d",
  jd: "j",
  jdread: "j",
  zhangyue: "z",
  zy: "z",
};

const sortSql = {
  readUpdateTime: "wi.read_update_time",
  updateTime: "wi.update_time",
  price: "wi.price",
  rating: "wi.rating",
  ratingCount: "wi.rating_count",
  title: "wi.title",
  author: "wi.author_text",
  totalWords: "wi.total_words",
  doubanRating: "de.douban_rating",
  quality: "quality_rank",
};

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function mapItem(row) {
  const tags = row.tags || [];
  const marks = row.marks || [];
  const offers = row.offers || [];
  const collections = row.collections || [];
  const match = row.match_status || "missing";
  const platforms = {
    w: true,
    d: Boolean(row.douban_id),
    j: offers.some((offer) => /jd|京东/i.test(`${offer.storeName || ""} ${offer.sourceSystem || ""}`)),
    z: offers.some((offer) => /zhang|掌阅|zy/i.test(`${offer.storeName || ""} ${offer.sourceSystem || ""}`)),
  };
  return {
    uuid: row.item_uuid,
    id: row.weread_book_id,
    weread: row.weread_book_id,
    douban: row.douban_id,
    isbn: row.isbn,
    media: row.medium,
    title: row.title,
    subtitle: null,
    author: row.author_text,
    translator: row.translator_text || null,
    publisher: row.publisher,
    category: row.category,
    coverUrl: row.cover_url,
    cover: Number(String(row.weread_book_id || "0").replace(/\D/g, "").slice(-1) || 0) % 8,
    price: toNumber(row.price) ?? 0,
    bucket: priceBucket(row.price),
    paid: row.paid,
    payType: row.pay_type,
    soldout: row.soldout,
    words: row.total_words || 0,
    weReadRating: row.rating ? Number(row.rating) * 10 : 0,
    doubanRating: row.douban_rating ? Number(row.douban_rating) : 0,
    ratingCount: row.douban_votes || row.rating_count || 0,
    progress: row.read_update_time ? 1 : 0,
    readState: row.read_update_time ? "reading" : "unread",
    readUpdate: formatDate(row.read_update_time),
    shelfUpdate: formatDate(row.update_time || row.updated_at),
    match,
    confidence: row.match_confidence ? Number(row.match_confidence) : null,
    platforms,
    offers,
    tags: withComputedTags(tags, row),
    marks: marks.map((m) => m.markType),
    markDetails: marks,
    collections,
    notesCount: Number(row.notes_count || 0),
    qualityFlags: qualityFlags(row),
    rawSourceRecordId: row.raw_source_record_id,
    desc: row.intro || "",
  };
}

function priceBucket(value) {
  const price = toNumber(value);
  if (price === null) return "unknown";
  if (price <= 0) return "free";
  if (price <= 10) return "cheap";
  if (price <= 30) return "mid";
  return "exp";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function withComputedTags(tags, row) {
  const out = [...tags];
  const names = new Set(out.map((t) => t.name));
  const add = (id, name, type, c) => {
    if (!names.has(name)) out.push({ id, name, type, c, source: "computed" });
  };
  if (row.paid === true) add("sys-paid", "已购", "system", "green");
  if (row.paid === false) add("sys-unpaid", "未购", "system", "ink");
  const bucket = priceBucket(row.price);
  if (bucket === "free") add("price-free", "免费", "price", "green");
  if (bucket === "cheap") add("price-cheap", "便宜", "price", "green");
  if (bucket === "exp") add("price-exp", "贵", "price", "rose");
  if (row.match_status === "confirmed" || row.match_status === "imported_legacy") add("sys-match", "豆瓣已匹配", "system", "blue");
  return out;
}

function qualityFlags(row) {
  const flags = [];
  if (!row.douban_id) flags.push("douban_missing");
  if (["candidate", "needs_review", "rejected"].includes(row.match_status)) flags.push(`match_${row.match_status}`);
  if (!row.cover_url) flags.push("cover_missing");
  if (!row.author_text) flags.push("author_missing");
  if (!row.total_words) flags.push("words_missing");
  if (!row.rating) flags.push("weread_rating_missing");
  return flags;
}

function shelfSelectSql(whereSql, orderSql, limitSql) {
  return `
    SELECT
      wi.id AS item_uuid,
      wi.weread_book_id,
      wi.medium::text,
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
      wi.isbn,
      wi.intro,
      wi.publisher,
      wi.total_words,
      wi.book_size,
      wi.rating,
      wi.rating_count,
      wi.raw_source_record_id,
      wi.updated_at,
      bm.status::text AS match_status,
      bm.douban_id,
      bm.confidence AS match_confidence,
      de.douban_rating,
      de.douban_votes,
      de.publisher AS douban_publisher,
      COALESCE(tag_rows.tags, '[]'::jsonb) AS tags,
      COALESCE(mark_rows.marks, '[]'::jsonb) AS marks,
      COALESCE(offer_rows.offers, '[]'::jsonb) AS offers,
      COALESCE(collection_rows.collections, '[]'::jsonb) AS collections,
      COALESCE(note_rows.notes_count, 0) AS notes_count,
      CASE
        WHEN bm.status IN ('needs_review', 'candidate', 'rejected') THEN 100
        WHEN bm.douban_id IS NULL THEN 80
        WHEN wi.cover_url IS NULL OR wi.author_text IS NULL OR wi.total_words IS NULL THEN 60
        ELSE 0
      END AS quality_rank
    FROM weread_items wi
    LEFT JOIN LATERAL (
      SELECT *
      FROM book_matches bm
      WHERE bm.weread_item_id = wi.id
      ORDER BY bm.reviewed_at DESC NULLS LAST, bm.confidence DESC NULLS LAST, bm.created_at DESC
      LIMIT 1
    ) bm ON true
    LEFT JOIN editions de ON de.id = COALESCE(bm.douban_edition_id, bm.edition_id, wi.edition_id)
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id::text,
        'name', t.name,
        'type', COALESCE(tm.tag_type, it.source, 'manual'),
        'c', COALESCE(tm.color_hint, 'blue'),
        'source', COALESCE(tm.source_label, it.source)
      ) ORDER BY t.name) AS tags
      FROM item_tags it
      JOIN tags t ON t.id = it.tag_id
      LEFT JOIN tag_metadata tm ON tm.tag_id = t.id
      WHERE it.weread_item_id = wi.id
    ) tag_rows ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'markType', im.mark_type,
        'severity', im.severity,
        'note', im.note,
        'source', im.source,
        'updatedAt', im.updated_at
      ) ORDER BY im.updated_at DESC) AS marks
      FROM item_marks im
      WHERE im.weread_item_id = wi.id
    ) mark_rows ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(offer ORDER BY (offer->>'salePrice')::numeric NULLS LAST) AS offers
      FROM (
        SELECT jsonb_build_object(
          'sourceSystem', so.source_system::text,
          'storeName', so.store_name,
          'externalOfferId', so.external_offer_id,
          'title', so.title,
          'listPrice', so.list_price,
          'salePrice', so.sale_price,
          'currency', so.currency,
          'updatedAt', so.created_at
        ) AS offer
        FROM store_offers so
        WHERE (so.edition_id IS NOT DISTINCT FROM wi.edition_id)
           OR (wi.isbn IS NOT NULL AND wi.isbn <> '' AND so.isbn = wi.isbn)
           OR (lower(so.title) = lower(wi.title))
        ORDER BY so.created_at DESC
        LIMIT 8
      ) offers
    ) offer_rows ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id', bl.id::text,
        'type', 'booklist',
        'name', bl.name,
        'source', bl.source_system::text
      ) ORDER BY bl.name) AS collections
      FROM booklist_items bli
      JOIN booklists bl ON bl.id = bli.booklist_id
      WHERE bli.weread_item_id = wi.id
    ) collection_rows ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS notes_count
      FROM weread_notes wn
      WHERE wn.weread_item_id = wi.id
    ) note_rows ON true
    ${whereSql}
    ${orderSql}
    ${limitSql}
  `;
}

function buildShelfQuery(query) {
  const params = [];
  const where = ["wi.is_in_shelf IS TRUE"];

  if (query.q) {
    const p = addParam(params, `%${query.q}%`);
    where.push(`(
      wi.title ILIKE ${p}
      OR wi.author_text ILIKE ${p}
      OR wi.publisher ILIKE ${p}
      OR wi.category ILIKE ${p}
      OR wi.isbn ILIKE ${p}
      OR bm.douban_id ILIKE ${p}
      OR EXISTS (
        SELECT 1 FROM item_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE it.weread_item_id = wi.id AND t.name ILIKE ${p}
      )
      OR EXISTS (
        SELECT 1 FROM booklist_items bli
        JOIN booklists bl ON bl.id = bli.booklist_id
        WHERE bli.weread_item_id = wi.id AND bl.name ILIKE ${p}
      )
      OR EXISTS (
        SELECT 1 FROM weread_notes wn
        WHERE wn.weread_item_id = wi.id
          AND (wn.mark_text ILIKE ${p} OR wn.note_text ILIKE ${p} OR wn.review_text ILIKE ${p})
      )
    )`);
  }

  const paid = toBool(query.paid);
  if (paid !== null) where.push(`wi.paid IS ${paid ? "TRUE" : "FALSE"}`);
  if (query.medium) where.push(`wi.medium::text = ${addParam(params, query.medium)}`);
  if (query.priceMax !== undefined) where.push(`wi.price <= ${addParam(params, Number(query.priceMax))}`);
  if (query.priceMin !== undefined) where.push(`wi.price >= ${addParam(params, Number(query.priceMin))}`);
  if (query.tag) {
    where.push(`EXISTS (
      SELECT 1 FROM item_tags it JOIN tags t ON t.id = it.tag_id
      WHERE it.weread_item_id = wi.id AND t.name = ${addParam(params, query.tag)}
    )`);
  }
  if (query.mark) {
    where.push(`EXISTS (
      SELECT 1 FROM item_marks im
      WHERE im.weread_item_id = wi.id AND im.mark_type = ${addParam(params, query.mark)}
    )`);
  }
  if (query.match) where.push(`bm.status::text = ${addParam(params, query.match)}`);
  if (query.platform && query.platform !== "weread") {
    const platform = platformKeys[String(query.platform).toLowerCase()] || query.platform;
    if (platform === "d") where.push("bm.douban_id IS NOT NULL");
    if (platform === "j") where.push(`EXISTS (SELECT 1 FROM store_offers so WHERE (so.edition_id IS NOT DISTINCT FROM wi.edition_id OR lower(so.title) = lower(wi.title)) AND (so.store_name ILIKE '%jd%' OR so.store_name ILIKE '%京东%'))`);
    if (platform === "z") where.push(`EXISTS (SELECT 1 FROM store_offers so WHERE (so.edition_id IS NOT DISTINCT FROM wi.edition_id OR lower(so.title) = lower(wi.title)) AND (so.store_name ILIKE '%掌阅%' OR so.store_name ILIKE '%zhang%'))`);
  }
  if (query.quality === "true" || query.quality === true) {
    where.push(`(bm.douban_id IS NULL OR bm.status IN ('candidate', 'needs_review', 'rejected') OR wi.cover_url IS NULL OR wi.author_text IS NULL OR wi.total_words IS NULL OR wi.rating IS NULL)`);
  }

  const sortKey = sortSql[query.sort] ? query.sort : "readUpdateTime";
  const direction = String(query.direction || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const orderSql = `ORDER BY ${sortSql[sortKey]} ${direction} NULLS LAST, wi.title ASC`;
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500);
  const offset = Math.max(Number(query.offset || 0), 0);
  const limitSql = `LIMIT ${addParam(params, limit)} OFFSET ${addParam(params, offset)}`;
  return {
    sql: shelfSelectSql(`WHERE ${where.join("\n AND ")}`, orderSql, limitSql),
    countSql: `SELECT count(*)::int AS total FROM weread_items wi
      LEFT JOIN LATERAL (
        SELECT * FROM book_matches bm
        WHERE bm.weread_item_id = wi.id
        ORDER BY bm.reviewed_at DESC NULLS LAST, bm.confidence DESC NULLS LAST, bm.created_at DESC
        LIMIT 1
      ) bm ON true
      WHERE ${where.join("\n AND ")}`,
    params,
  };
}

app.get("/api/health", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT current_database() AS database, now() AS now");
  res.json({ ok: true, ...rows[0] });
}));

app.get("/api/shelf", asyncRoute(async (req, res) => {
  const built = buildShelfQuery(req.query);
  const [itemsResult, countResult] = await Promise.all([
    pool.query(built.sql, built.params),
    pool.query(built.countSql, built.params.slice(0, built.params.length - 2)),
  ]);
  res.json({
    items: itemsResult.rows.map(mapItem),
    total: countResult.rows[0]?.total || 0,
    limit: Number(req.query.limit || 100),
    offset: Number(req.query.offset || 0),
  });
}));

app.get("/api/shelf/stats", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM weread_next_shelf_stats");
  res.json(rows[0] || {});
}));

app.get("/api/shelf/:wereadBookId", asyncRoute(async (req, res) => {
  const params = [req.params.wereadBookId];
  const sql = shelfSelectSql("WHERE wi.weread_book_id = $1", "", "LIMIT 1");
  const { rows } = await pool.query(sql, params);
  if (!rows[0]) return res.status(404).json({ error: "not_found" });
  const item = mapItem(rows[0]);
  const notes = await pool.query(
    `SELECT note_type, chapter_title, mark_text, note_text, review_text, created_at_source
     FROM weread_notes wn
     JOIN weread_items wi ON wi.id = wn.weread_item_id
     WHERE wi.weread_book_id = $1
     ORDER BY created_at_source DESC NULLS LAST
     LIMIT 20`,
    [req.params.wereadBookId]
  );
  res.json({ ...item, notes: notes.rows });
}));

app.get("/api/tags", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      t.id::text,
      t.name,
      COALESCE(tm.tag_type, 'manual') AS type,
      COALESCE(tm.color_hint, 'blue') AS color,
      COALESCE(tm.source_label, t.source_system::text, 'manual') AS source,
      count(it.weread_item_id)::int AS count
    FROM tags t
    LEFT JOIN tag_metadata tm ON tm.tag_id = t.id
    LEFT JOIN item_tags it ON it.tag_id = t.id
    GROUP BY t.id, t.name, tm.tag_type, tm.color_hint, tm.source_label
    ORDER BY count DESC, t.name
  `);
  res.json({ tags: rows });
}));

app.post("/api/tags", asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  const type = req.body.type || "manual";
  const color = req.body.color || "blue";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tag = await client.query(
      `INSERT INTO tags (name, source_system)
       VALUES ($1, 'manual')
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id::text, name`,
      [name]
    );
    await client.query(
      `INSERT INTO tag_metadata (tag_id, tag_type, color_hint, source_label)
       VALUES ($1, $2, $3, 'manual')
       ON CONFLICT (tag_id) DO UPDATE
       SET tag_type = EXCLUDED.tag_type, color_hint = EXCLUDED.color_hint, updated_at = now()`,
      [tag.rows[0].id, type, color]
    );
    await client.query("COMMIT");
    res.status(201).json({ tag: { ...tag.rows[0], type, color } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.patch("/api/items/tags", asyncRoute(async (req, res) => {
  const bookIds = Array.isArray(req.body.bookIds) ? req.body.bookIds : [];
  const add = Array.isArray(req.body.add) ? req.body.add : [];
  const remove = Array.isArray(req.body.remove) ? req.body.remove : [];
  if (!bookIds.length) return res.status(400).json({ error: "bookIds_required" });
  const client = await pool.connect();
  let changed = 0;
  try {
    await client.query("BEGIN");
    for (const name of add) {
      const tag = await client.query(
        `INSERT INTO tags (name, source_system)
         VALUES ($1, 'manual')
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [String(name).trim()]
      );
      await client.query(
        `INSERT INTO tag_metadata (tag_id, tag_type, color_hint, source_label)
         VALUES ($1, 'manual', 'blue', 'manual')
         ON CONFLICT (tag_id) DO NOTHING`,
        [tag.rows[0].id]
      );
      const inserted = await client.query(
        `INSERT INTO item_tags (weread_item_id, tag_id, source)
         SELECT wi.id, $1, 'manual'
         FROM weread_items wi
         WHERE wi.weread_book_id = ANY($2::text[])
         ON CONFLICT DO NOTHING`,
        [tag.rows[0].id, bookIds]
      );
      changed += inserted.rowCount;
    }
    for (const name of remove) {
      const deleted = await client.query(
        `DELETE FROM item_tags it
         USING tags t, weread_items wi
         WHERE it.tag_id = t.id
           AND it.weread_item_id = wi.id
           AND t.name = $1
           AND wi.weread_book_id = ANY($2::text[])`,
        [String(name).trim(), bookIds]
      );
      changed += deleted.rowCount;
    }
    await client.query("COMMIT");
    res.json({ ok: true, changed });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.patch("/api/items/marks", asyncRoute(async (req, res) => {
  const bookIds = Array.isArray(req.body.bookIds) ? req.body.bookIds : [];
  const markType = String(req.body.markType || "").trim();
  const remove = Boolean(req.body.remove);
  if (!bookIds.length || !markType) return res.status(400).json({ error: "bookIds_and_markType_required" });
  if (remove) {
    const deleted = await pool.query(
      `DELETE FROM item_marks im
       USING weread_items wi
       WHERE im.weread_item_id = wi.id
         AND wi.weread_book_id = ANY($1::text[])
         AND im.mark_type = $2`,
      [bookIds, markType]
    );
    return res.json({ ok: true, changed: deleted.rowCount });
  }
  const inserted = await pool.query(
    `INSERT INTO item_marks (weread_item_id, mark_type, severity, note, source)
     SELECT wi.id, $2, COALESCE($3, 'normal'), $4, 'manual'
     FROM weread_items wi
     WHERE wi.weread_book_id = ANY($1::text[])
     ON CONFLICT (weread_item_id, mark_type) DO UPDATE
     SET severity = EXCLUDED.severity, note = EXCLUDED.note, updated_at = now()`,
    [bookIds, markType, req.body.severity || "normal", req.body.note || null]
  );
  res.json({ ok: true, changed: inserted.rowCount });
}));

app.get("/api/collections", asyncRoute(async (_req, res) => {
  const booklists = await pool.query(`
    SELECT bl.id::text, 'booklist' AS type, bl.name, bl.source_system::text AS source,
           COALESCE(count(bli.id), 0)::int AS count,
           COALESCE(bl.updated_at_source, bl.created_at) AS updated_at
    FROM booklists bl
    LEFT JOIN booklist_items bli ON bli.booklist_id = bl.id
    GROUP BY bl.id
    ORDER BY count DESC, bl.name
    LIMIT 200
  `);
  const manual = await pool.query(`
    SELECT id::text, collection_type AS type, name, 'manual' AS source,
           (SELECT count(*)::int FROM manual_collection_items mci WHERE mci.collection_id = mc.id) AS count,
           updated_at
    FROM manual_collections mc
    ORDER BY updated_at DESC
  `);
  const saved = await pool.query(`
    SELECT id::text, 'saved' AS type, name, 'saved_view' AS source, 0 AS count, updated_at
    FROM saved_views
    ORDER BY updated_at DESC
  `);
  res.json({ collections: [...manual.rows, ...saved.rows, ...booklists.rows] });
}));

app.get("/api/collections/:id/items", asyncRoute(async (req, res) => {
  const params = [req.params.id, Math.min(Number(req.query.limit || 100), 500)];
  const sql = shelfSelectSql(
    `WHERE wi.is_in_shelf IS TRUE AND (
      EXISTS (SELECT 1 FROM booklist_items bli WHERE bli.weread_item_id = wi.id AND bli.booklist_id::text = $1)
      OR EXISTS (SELECT 1 FROM manual_collection_items mci WHERE mci.weread_item_id = wi.id AND mci.collection_id::text = $1)
    )`,
    "ORDER BY wi.title ASC",
    "LIMIT $2"
  );
  const { rows } = await pool.query(sql, params);
  res.json({ items: rows.map(mapItem), total: rows.length });
}));

app.post("/api/saved-views", asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  const slug = String(req.body.slug || name).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
  const { rows } = await pool.query(
    `INSERT INTO saved_views (slug, name, definition)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE
     SET name = EXCLUDED.name, definition = EXCLUDED.definition, updated_at = now()
     RETURNING id::text, slug, name, definition, updated_at`,
    [slug, name, req.body.definition || {}]
  );
  res.status(201).json({ savedView: rows[0] });
}));

app.get("/api/notes", asyncRoute(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.q) {
    const p = addParam(params, `%${req.query.q}%`);
    where.push(`(wn.mark_text ILIKE ${p} OR wn.note_text ILIKE ${p} OR wn.review_text ILIKE ${p} OR wi.title ILIKE ${p})`);
  }
  const limit = addParam(params, Math.min(Number(req.query.limit || 100), 500));
  const { rows } = await pool.query(
    `SELECT wn.id::text, wn.note_type, wn.chapter_title, wn.mark_text, wn.note_text, wn.review_text, wn.created_at_source,
            wi.weread_book_id, wi.title, wi.author_text, wi.cover_url
     FROM weread_notes wn
     LEFT JOIN weread_items wi ON wi.id = wn.weread_item_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY wn.created_at_source DESC NULLS LAST
     LIMIT ${limit}`,
    params
  );
  res.json({ notes: rows });
}));

app.get("/api/quality", asyncRoute(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const candidateRows = await pool.query(
    `SELECT wi.weread_book_id
     FROM weread_items wi
     LEFT JOIN LATERAL (
       SELECT *
       FROM book_matches bm
       WHERE bm.weread_item_id = wi.id
       ORDER BY bm.reviewed_at DESC NULLS LAST, bm.confidence DESC NULLS LAST, bm.created_at DESC
       LIMIT 1
     ) bm ON true
     WHERE wi.is_in_shelf IS TRUE
       AND (
         bm.douban_id IS NULL
         OR bm.status IN ('candidate', 'needs_review', 'rejected')
         OR wi.cover_url IS NULL
         OR wi.author_text IS NULL
         OR wi.total_words IS NULL
         OR wi.rating IS NULL
       )
     ORDER BY
       CASE
         WHEN bm.status IN ('needs_review', 'candidate', 'rejected') THEN 100
         WHEN bm.douban_id IS NULL THEN 80
         WHEN wi.cover_url IS NULL OR wi.author_text IS NULL OR wi.total_words IS NULL THEN 60
         ELSE 0
       END DESC,
       wi.updated_at DESC
     LIMIT $1`,
    [limit]
  );
  const ids = candidateRows.rows.map((row) => row.weread_book_id);
  if (!ids.length) return res.json({ items: [] });
  const result = await pool.query(
    shelfSelectSql(
      "WHERE wi.weread_book_id = ANY($1::text[])",
      "ORDER BY array_position($1::text[], wi.weread_book_id)",
      ""
    ),
    [ids]
  );
  res.json({ items: result.rows.map(mapItem) });
}));

app.get("/api/sync-runs", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT source_system::text, source_name, count(*)::int AS count,
           max(imported_at) AS latest_imported_at,
           max(fetched_at) AS latest_fetched_at
    FROM source_records
    GROUP BY source_system, source_name
    ORDER BY latest_imported_at DESC NULLS LAST
    LIMIT 50
  `);
  res.json({ runs: rows });
}));

app.use(express.static(webRoot));
app.get("*", (_req, res) => res.sendFile(path.join(webRoot, "index.html")));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "internal_error", message: error.message });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`WeRead Next app listening on http://127.0.0.1:${port}`);
});
