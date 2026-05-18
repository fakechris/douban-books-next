-- Product workspace tables for the local WeRead Next app.
-- These tables hold user-facing organization state that is not part of the
-- immutable source payloads.

CREATE TABLE IF NOT EXISTS tag_metadata (
  tag_id uuid PRIMARY KEY REFERENCES tags(id) ON DELETE CASCADE,
  tag_type text NOT NULL DEFAULT 'manual'
    CHECK (tag_type IN ('manual', 'imported', 'system', 'price', 'workflow')),
  color_hint text,
  source_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weread_item_id uuid NOT NULL REFERENCES weread_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'imported', 'system', 'price', 'workflow', 'llm')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (weread_item_id, tag_id)
);

CREATE INDEX IF NOT EXISTS item_tags_item_idx ON item_tags (weread_item_id);
CREATE INDEX IF NOT EXISTS item_tags_tag_idx ON item_tags (tag_id);

CREATE TABLE IF NOT EXISTS item_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weread_item_id uuid NOT NULL REFERENCES weread_items(id) ON DELETE CASCADE,
  mark_type text NOT NULL,
  severity text NOT NULL DEFAULT 'normal'
    CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  note text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'imported', 'computed', 'llm')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (weread_item_id, mark_type)
);

CREATE INDEX IF NOT EXISTS item_marks_item_idx ON item_marks (weread_item_id);
CREATE INDEX IF NOT EXISTS item_marks_type_idx ON item_marks (mark_type);

CREATE TABLE IF NOT EXISTS saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  collection_type text NOT NULL DEFAULT 'manual'
    CHECK (collection_type IN ('manual', 'saved', 'smart', 'directory')),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES manual_collections(id) ON DELETE CASCADE,
  weread_item_id uuid NOT NULL REFERENCES weread_items(id) ON DELETE CASCADE,
  position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, weread_item_id)
);

CREATE INDEX IF NOT EXISTS manual_collection_items_collection_idx
  ON manual_collection_items (collection_id);
CREATE INDEX IF NOT EXISTS manual_collection_items_item_idx
  ON manual_collection_items (weread_item_id);

INSERT INTO saved_views (slug, name, definition)
VALUES
  ('cheap-paid-unfinished', '便宜已购待读', '{"filters":{"paid":true,"priceMax":30,"readState":"unfinished"},"sort":"doubanRating","direction":"desc"}'),
  ('watch-expensive-unpaid', '贵 + 高分 + 未购', '{"filters":{"mark":"purchase_watch","paid":false},"sort":"price","direction":"desc"}'),
  ('data-quality-queue', 'Data quality 修复队列', '{"filters":{"quality":true},"sort":"quality","direction":"desc"}')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO manual_collections (slug, name, description, collection_type, definition)
VALUES
  ('desktop-books-cn-history', '/Books/中文/历史', 'Imported desktop directory placeholder for local grouping.', 'directory', '{"source":"desktop"}'),
  ('desktop-books-computer', '/Books/计算机', 'Imported desktop directory placeholder for local grouping.', 'directory', '{"source":"desktop"}')
ON CONFLICT (slug) DO NOTHING;
