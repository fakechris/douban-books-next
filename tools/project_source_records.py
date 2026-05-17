#!/usr/bin/env python3
"""Project raw source_records into normalized PostgreSQL tables.

This is phase 2 of the migration. It never reads legacy databases directly.
Inputs are the immutable raw payloads already stored in source_records.

Default mode is dry-run. Use --write to update projection tables.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import psycopg2
import psycopg2.extras


DEFAULT_PG_DSN = os.environ.get("PG_DSN", "dbname=weread_douban_migration")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=[
            "project-douban",
            "project-douban-sql",
            "project-douban-contributors-tags",
            "project-douban-props",
            "project-weread",
            "project-booklists",
            "project-purchases",
            "project-matches",
            "project-all",
            "check-projections",
        ],
    )
    parser.add_argument("--write", action="store_true", help="Write projection tables. Default is dry-run.")
    parser.add_argument("--pg-dsn", default=DEFAULT_PG_DSN)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--limit", type=int, default=0, help="Maximum source records per command. 0 means no limit.")
    parser.add_argument("--progress-every", type=int, default=10000)
    return parser.parse_args()


def connect_pg(args: argparse.Namespace):
    return psycopg2.connect(args.pg_dsn)


def json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=json_default)


def json_default(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    return str(obj)


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def parse_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    lowered = str(value).strip().lower()
    if lowered in {"1", "true", "yes", "y"}:
        return True
    if lowered in {"0", "false", "no", "n"}:
        return False
    return None


def parse_timestamp(value: Any) -> str | None:
    text = normalize_text(value)
    if not text or text.startswith("0000-00-00"):
        return None
    return text


def parse_date(value: Any) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    match = re.search(r"(\d{4})(?:[-./年](\d{1,2}))?(?:[-./月](\d{1,2}))?", text)
    if not match:
        return None
    year = int(match.group(1))
    month = int(match.group(2) or 1)
    day = int(match.group(3) or 1)
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def clean_isbn(value: Any) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    cleaned = re.sub(r"[^0-9Xx]", "", text)
    return cleaned.upper() or None


def split_csv_text(value: Any) -> list[str]:
    text = normalize_text(value)
    if not text:
        return []
    return [part.strip() for part in re.split(r"[,，\s]+", text) if part.strip()]


def source_rows(conn, source_system: str, source_name: str, limit: int = 0) -> Iterator[tuple[str, str | None, dict[str, Any]]]:
    sql = """
        SELECT id::text, source_pk, payload
        FROM source_records
        WHERE source_system = %s AND source_name = %s
        ORDER BY source_pk NULLS LAST, id
    """
    if limit:
        sql += " LIMIT %s"
        params: tuple[Any, ...] = (source_system, source_name, limit)
    else:
        params = (source_system, source_name)
    with conn.cursor(name=f"source_{source_name.replace('.', '_')}", cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.itersize = 2000
        cur.execute(sql, params)
        for row in cur:
            yield row["id"], row["source_pk"], row["payload"]


def get_external_subject(conn, source_system: str, id_type: str, external_id: str) -> tuple[str, str] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT subject_type, subject_id::text
            FROM external_ids
            WHERE source_system = %s AND id_type = %s AND external_id = %s
            """,
            (source_system, id_type, external_id),
        )
        row = cur.fetchone()
    return (row[0], row[1]) if row else None


def insert_external_id(
    conn,
    subject_type: str,
    subject_id: str,
    source_system: str,
    id_type: str,
    external_id: str | None,
    source_record_id: str | None,
) -> None:
    if not external_id:
        return
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO external_ids (subject_type, subject_id, source_system, id_type, external_id, source_record_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (source_system, id_type, external_id) DO NOTHING
            """,
            (subject_type, subject_id, source_system, id_type, external_id, source_record_id),
        )


def get_duplicate_isbn13s(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT payload->>'isbn13'
            FROM source_records
            WHERE source_system = 'legacy_mongo'
              AND source_name = 'local.book'
              AND coalesce(payload->>'isbn13', '') <> ''
            GROUP BY payload->>'isbn13'
            HAVING count(*) > 1
            """
        )
        return {row[0] for row in cur.fetchall()}


def ensure_contributor(conn, name: str) -> str:
    normalized = normalize_name(name)
    with conn.cursor() as cur:
        cur.execute("SELECT id::text FROM contributors WHERE normalized_name = %s", (normalized,))
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute(
            """
            INSERT INTO contributors (display_name, normalized_name)
            VALUES (%s, %s)
            ON CONFLICT (normalized_name) WHERE normalized_name IS NOT NULL AND normalized_name <> ''
            DO UPDATE SET display_name = EXCLUDED.display_name
            RETURNING id::text
            """,
            (name, normalized),
        )
        return cur.fetchone()[0]


def ensure_tag(conn, name: str, source_system: str) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tags (name, source_system)
            VALUES (%s, %s)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id::text
            """,
            (name, source_system),
        )
        return cur.fetchone()[0]


def douban_authors(payload: dict[str, Any]) -> list[str]:
    authors = payload.get("author") or []
    if isinstance(authors, str):
        authors = [authors]
    return [name.strip() for name in authors if isinstance(name, str) and name.strip()]


def douban_translators(payload: dict[str, Any]) -> list[str]:
    translators = payload.get("translator") or []
    if isinstance(translators, str):
        translators = [translators]
    return [name.strip() for name in translators if isinstance(name, str) and name.strip()]


def douban_rating(payload: dict[str, Any]) -> tuple[Decimal | None, int | None]:
    rating = payload.get("rating") or {}
    if not isinstance(rating, dict):
        return None, None
    return parse_decimal(rating.get("average")), parse_int(rating.get("numRaters"))


def project_douban(args: argparse.Namespace) -> dict[str, int]:
    stats = {"seen": 0, "books": 0, "editions": 0, "skipped": 0}
    started = time.time()
    if args.write:
        return project_douban_core_bulk(args, started)

    read_conn = connect_pg(args)
    write_conn = connect_pg(args) if args.write else None
    try:
        duplicate_isbn13s = get_duplicate_isbn13s(read_conn)
        target_conn = write_conn or read_conn
        for source_record_id, source_pk, payload in source_rows(read_conn, "legacy_mongo", "local.book", args.limit):
            stats["seen"] += 1
            douban_id = normalize_text(payload.get("id") or source_pk)
            title = normalize_text(payload.get("title"))
            if not douban_id or not title:
                stats["skipped"] += 1
                continue
            if args.write and get_external_subject(target_conn, "legacy_mongo", "douban_id", douban_id):
                stats["skipped"] += 1
                continue
            if not args.write:
                stats["books"] += 1
                stats["editions"] += 1
                maybe_progress(args, stats["seen"], "validated douban")
                continue

            images = payload.get("images") if isinstance(payload.get("images"), dict) else {}
            rating, votes = douban_rating(payload)
            isbn10 = clean_isbn(payload.get("isbn10"))
            raw_isbn13 = clean_isbn(payload.get("isbn13"))
            isbn13 = raw_isbn13 if raw_isbn13 and raw_isbn13 not in duplicate_isbn13s else None
            authors = douban_authors(payload)
            translators = douban_translators(payload)

            with target_conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO books (canonical_title, original_title, sort_title, description)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id::text
                    """,
                    (
                        title,
                        normalize_text(payload.get("origin_title") or payload.get("alt_title")),
                        title,
                        normalize_text(payload.get("summary")),
                    ),
                )
                book_id = cur.fetchone()[0]
                cur.execute(
                    """
                    INSERT INTO editions (
                      book_id, title, subtitle, original_title, isbn10, isbn13, publisher,
                      published_text, published_date, binding, pages, price_text,
                      cover_url, cover_small_url, cover_large_url, description, catalog,
                      author_intro, series_title, douban_rating, douban_votes,
                      source_quality, primary_source_record_id
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s, %s, %s, 'legacy_mongo', %s
                    )
                    RETURNING id::text
                    """,
                    (
                        book_id,
                        title,
                        normalize_text(payload.get("subtitle")),
                        normalize_text(payload.get("origin_title") or payload.get("alt_title")),
                        isbn10,
                        isbn13,
                        normalize_text(payload.get("publisher")),
                        normalize_text(payload.get("pubdate")),
                        parse_date(payload.get("pubdate")),
                        normalize_text(payload.get("binding")),
                        normalize_text(payload.get("pages")),
                        normalize_text(payload.get("price")),
                        normalize_text(payload.get("image")),
                        normalize_text(images.get("small")),
                        normalize_text(images.get("large")),
                        normalize_text(payload.get("summary")),
                        normalize_text(payload.get("catalog")),
                        normalize_text(payload.get("author_intro")),
                        normalize_text(payload.get("series", {}).get("title") if isinstance(payload.get("series"), dict) else None),
                        rating,
                        votes,
                        source_record_id,
                    ),
                )
                edition_id = cur.fetchone()[0]

            insert_external_id(target_conn, "edition", edition_id, "legacy_mongo", "douban_id", douban_id, source_record_id)
            insert_external_id(target_conn, "edition", edition_id, "legacy_mongo", "isbn10", isbn10, source_record_id)
            if raw_isbn13 and raw_isbn13 not in duplicate_isbn13s:
                insert_external_id(target_conn, "edition", edition_id, "legacy_mongo", "isbn13", raw_isbn13, source_record_id)

            for position, name in enumerate(authors):
                contributor_id = ensure_contributor(target_conn, name)
                link_contributor(target_conn, edition_id, contributor_id, "author", position, source_record_id)
            for position, name in enumerate(translators):
                contributor_id = ensure_contributor(target_conn, name)
                link_contributor(target_conn, edition_id, contributor_id, "translator", position, source_record_id)

            for tag in payload.get("tags") or []:
                if not isinstance(tag, dict):
                    continue
                tag_name = normalize_text(tag.get("name"))
                if not tag_name:
                    continue
                tag_id = ensure_tag(target_conn, tag_name, "legacy_mongo")
                with target_conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO edition_tags (edition_id, tag_id, source_system, count)
                        VALUES (%s, %s, 'legacy_mongo', %s)
                        ON CONFLICT (edition_id, tag_id, source_system)
                        DO UPDATE SET count = EXCLUDED.count
                        """,
                        (edition_id, tag_id, parse_int(tag.get("count"))),
                    )

            stats["books"] += 1
            stats["editions"] += 1
            maybe_commit(target_conn, args, stats["seen"])
            maybe_progress(args, stats["seen"], "projected douban")
        if args.write:
            target_conn.commit()
    finally:
        read_conn.close()
        if write_conn:
            write_conn.close()
    print_summary("project-douban", args, stats, started)
    return stats


def project_douban_core_bulk(args: argparse.Namespace, started: float) -> dict[str, int]:
    """Fast core projection for Douban books/editions/external IDs.

    Contributors and tags are intentionally left for a follow-up projection pass.
    The first requirement is to create stable edition IDs for matching.
    """

    stats = {"seen": 0, "books": 0, "editions": 0, "skipped": 0}
    with connect_pg(args) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TEMP TABLE tmp_duplicate_isbn13 ON COMMIT PRESERVE ROWS AS
                SELECT nullif(regexp_replace(coalesce(payload->>'isbn13', ''), '[^0-9Xx]', '', 'g'), '') AS isbn13
                FROM source_records
                WHERE source_system = 'legacy_mongo'
                  AND source_name = 'local.book'
                  AND coalesce(payload->>'isbn13', '') <> ''
                GROUP BY nullif(regexp_replace(coalesce(payload->>'isbn13', ''), '[^0-9Xx]', '', 'g'), '')
                HAVING count(*) > 1
                """
            )
            cur.execute("CREATE INDEX ON tmp_duplicate_isbn13 (isbn13)")
            limit_sql = "LIMIT %s" if args.limit else ""
            params: tuple[Any, ...] = (args.limit,) if args.limit else ()
            cur.execute(
                f"""
                CREATE TEMP TABLE tmp_douban_candidates ON COMMIT DROP AS
                SELECT
                  sr.id AS source_record_id,
                  sr.payload,
                  gen_random_uuid() AS book_id,
                  gen_random_uuid() AS edition_id,
                  nullif(trim(sr.payload->>'id'), '') AS douban_id,
                  nullif(trim(sr.payload->>'title'), '') AS title,
                  nullif(trim(coalesce(sr.payload->>'origin_title', sr.payload->>'alt_title')), '') AS original_title,
                  nullif(regexp_replace(coalesce(sr.payload->>'isbn10', ''), '[^0-9Xx]', '', 'g'), '') AS isbn10,
                  CASE
                    WHEN dup.isbn13 IS NULL THEN nullif(regexp_replace(coalesce(sr.payload->>'isbn13', ''), '[^0-9Xx]', '', 'g'), '')
                    ELSE NULL
                  END AS isbn13,
                  nullif(trim(sr.payload->>'publisher'), '') AS publisher,
                  nullif(trim(sr.payload->>'pubdate'), '') AS published_text,
                  nullif(trim(sr.payload->>'binding'), '') AS binding,
                  nullif(trim(sr.payload->>'pages'), '') AS pages,
                  nullif(trim(sr.payload->>'price'), '') AS price_text,
                  nullif(trim(sr.payload->>'image'), '') AS cover_url,
                  nullif(trim(sr.payload #>> '{{images,small}}'), '') AS cover_small_url,
                  nullif(trim(sr.payload #>> '{{images,large}}'), '') AS cover_large_url,
                  nullif(trim(sr.payload->>'summary'), '') AS description,
                  nullif(trim(sr.payload->>'catalog'), '') AS catalog,
                  nullif(trim(sr.payload->>'author_intro'), '') AS author_intro,
                  CASE
                    WHEN (sr.payload #>> '{{rating,average}}') ~ '^[0-9]+(\\.[0-9]+)?$'
                      THEN (sr.payload #>> '{{rating,average}}')::numeric
                    ELSE NULL
                  END AS douban_rating,
                  CASE
                    WHEN (sr.payload #>> '{{rating,numRaters}}') ~ '^[0-9]+$'
                      THEN (sr.payload #>> '{{rating,numRaters}}')::integer
                    ELSE NULL
                  END AS douban_votes
                FROM source_records sr
                LEFT JOIN external_ids existing
                  ON existing.source_system = 'legacy_mongo'
                 AND existing.id_type = 'douban_id'
                 AND existing.external_id = sr.payload->>'id'
                LEFT JOIN tmp_duplicate_isbn13 dup
                  ON dup.isbn13 = nullif(regexp_replace(coalesce(sr.payload->>'isbn13', ''), '[^0-9Xx]', '', 'g'), '')
                WHERE sr.source_system = 'legacy_mongo'
                  AND sr.source_name = 'local.book'
                  AND existing.id IS NULL
                  AND coalesce(sr.payload->>'id', '') <> ''
                  AND coalesce(sr.payload->>'title', '') <> ''
                ORDER BY sr.source_pk NULLS LAST, sr.id
                {limit_sql}
                """,
                params,
            )
            cur.execute("CREATE INDEX ON tmp_douban_candidates (douban_id)")
            cur.execute("SELECT count(*) FROM tmp_douban_candidates")
            candidate_count = int(cur.fetchone()[0] or 0)
            if candidate_count == 0:
                conn.commit()
                print_summary("project-douban", args, stats, started)
                return stats

            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH inserted_books AS (
                      INSERT INTO books (id, canonical_title, original_title, sort_title, description)
                      SELECT book_id, title, original_title, title, description
                      FROM tmp_douban_candidates
                      RETURNING id
                    ),
                    inserted_editions AS (
                      INSERT INTO editions (
                        id, book_id, title, original_title, isbn10, isbn13, publisher,
                        published_text, binding, pages, price_text, cover_url, cover_small_url,
                        cover_large_url, description, catalog, author_intro, douban_rating,
                        douban_votes, source_quality, primary_source_record_id
                      )
                      SELECT
                        edition_id, book_id, title, original_title, isbn10, isbn13, publisher,
                        published_text, binding, pages, price_text, cover_url, cover_small_url,
                        cover_large_url, description, catalog, author_intro, douban_rating,
                        douban_votes, 'legacy_mongo', source_record_id
                      FROM tmp_douban_candidates
                      RETURNING id
                    ),
                    inserted_douban_ids AS (
                      INSERT INTO external_ids (subject_type, subject_id, source_system, id_type, external_id, source_record_id)
                      SELECT 'edition', edition_id, 'legacy_mongo', 'douban_id', douban_id, source_record_id
                      FROM tmp_douban_candidates
                      ON CONFLICT (source_system, id_type, external_id) DO NOTHING
                      RETURNING id
                    ),
                    inserted_isbn10_ids AS (
                      INSERT INTO external_ids (subject_type, subject_id, source_system, id_type, external_id, source_record_id)
                      SELECT 'edition', edition_id, 'legacy_mongo', 'isbn10', isbn10, source_record_id
                      FROM tmp_douban_candidates
                      WHERE isbn10 IS NOT NULL
                      ON CONFLICT (source_system, id_type, external_id) DO NOTHING
                      RETURNING id
                    ),
                    inserted_isbn13_ids AS (
                      INSERT INTO external_ids (subject_type, subject_id, source_system, id_type, external_id, source_record_id)
                      SELECT 'edition', edition_id, 'legacy_mongo', 'isbn13', isbn13, source_record_id
                      FROM tmp_douban_candidates
                      WHERE isbn13 IS NOT NULL
                      ON CONFLICT (source_system, id_type, external_id) DO NOTHING
                      RETURNING id
                    )
                    SELECT
                      (SELECT count(*) FROM tmp_douban_candidates) AS candidates,
                      (SELECT count(*) FROM inserted_books) AS books,
                      (SELECT count(*) FROM inserted_editions) AS editions
                    """,
                )
                row = cur.fetchone()
            conn.commit()
            stats["seen"] += int(row[0] or 0)
            stats["books"] += int(row[1] or 0)
            stats["editions"] += int(row[2] or 0)
    print_summary("project-douban", args, stats, started)
    return stats


def project_douban_sql(args: argparse.Namespace) -> dict[str, int]:
    """Project legacy MySQL douban.books rows missing from Mongo."""

    stats = {"seen": 0, "books": 0, "editions": 0, "skipped": 0}
    started = time.time()
    if not args.write:
        with connect_pg(args) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT count(*)
                    FROM source_records sr
                    LEFT JOIN external_ids existing
                      ON existing.id_type = 'douban_id'
                     AND existing.external_id = sr.payload->>'douban_id'
                    WHERE sr.source_system = 'legacy_mysql'
                      AND sr.source_name = 'douban.books'
                      AND existing.id IS NULL
                      AND coalesce(sr.payload->>'douban_id', '') <> ''
                      AND coalesce(sr.payload->>'name', '') <> ''
                    """
                )
                stats["seen"] = min(int(cur.fetchone()[0] or 0), args.limit or sys.maxsize)
                stats["books"] = stats["seen"]
                stats["editions"] = stats["seen"]
        print_summary("project-douban-sql", args, stats, started)
        return stats

    with connect_pg(args) as conn:
        with conn.cursor() as cur:
            limit_sql = "LIMIT %s" if args.limit else ""
            params: tuple[Any, ...] = (args.limit,) if args.limit else ()
            cur.execute(
                f"""
                CREATE TEMP TABLE tmp_douban_sql_candidates ON COMMIT DROP AS
                SELECT
                  sr.id AS source_record_id,
                  sr.payload,
                  gen_random_uuid() AS book_id,
                  gen_random_uuid() AS edition_id,
                  nullif(trim(sr.payload->>'douban_id'), '') AS douban_id,
                  nullif(trim(sr.payload->>'name'), '') AS title,
                  nullif(trim(sr.payload->>'author'), '') AS author_text,
                  nullif(trim(sr.payload->>'imgsrc'), '') AS cover_url,
                  nullif(trim(sr.payload->>'intro'), '') AS description,
                  CASE
                    WHEN (sr.payload->>'ratings') ~ '^[0-9]+(\\.[0-9]+)?$'
                      THEN (sr.payload->>'ratings')::numeric
                    ELSE NULL
                  END AS douban_rating,
                  CASE
                    WHEN (sr.payload->>'votes') ~ '^[0-9]+$'
                      THEN (sr.payload->>'votes')::integer
                    ELSE NULL
                  END AS douban_votes
                FROM source_records sr
                LEFT JOIN external_ids existing
                  ON existing.id_type = 'douban_id'
                 AND existing.external_id = sr.payload->>'douban_id'
                WHERE sr.source_system = 'legacy_mysql'
                  AND sr.source_name = 'douban.books'
                  AND existing.id IS NULL
                  AND coalesce(sr.payload->>'douban_id', '') <> ''
                  AND coalesce(sr.payload->>'name', '') <> ''
                ORDER BY sr.source_pk NULLS LAST, sr.id
                {limit_sql}
                """,
                params,
            )
            cur.execute("SELECT count(*) FROM tmp_douban_sql_candidates")
            candidate_count = int(cur.fetchone()[0] or 0)
            if candidate_count == 0:
                conn.commit()
                print_summary("project-douban-sql", args, stats, started)
                return stats
            cur.execute(
                """
                WITH inserted_books AS (
                  INSERT INTO books (id, canonical_title, sort_title, description)
                  SELECT book_id, title, title, description
                  FROM tmp_douban_sql_candidates
                  RETURNING id
                ),
                inserted_editions AS (
                  INSERT INTO editions (
                    id, book_id, title, cover_url, description, douban_rating,
                    douban_votes, source_quality, primary_source_record_id
                  )
                  SELECT
                    edition_id, book_id, title, cover_url, description, douban_rating,
                    douban_votes, 'legacy_mysql_books', source_record_id
                  FROM tmp_douban_sql_candidates
                  RETURNING id
                ),
                inserted_douban_ids AS (
                  INSERT INTO external_ids (subject_type, subject_id, source_system, id_type, external_id, source_record_id)
                  SELECT 'edition', edition_id, 'legacy_mysql', 'douban_id', douban_id, source_record_id
                  FROM tmp_douban_sql_candidates
                  ON CONFLICT (source_system, id_type, external_id) DO NOTHING
                  RETURNING id
                )
                SELECT
                  (SELECT count(*) FROM tmp_douban_sql_candidates),
                  (SELECT count(*) FROM inserted_books),
                  (SELECT count(*) FROM inserted_editions)
                """
            )
            row = cur.fetchone()
        conn.commit()
        stats["seen"] = int(row[0] or 0)
        stats["books"] = int(row[1] or 0)
        stats["editions"] = int(row[2] or 0)
    print_summary("project-douban-sql", args, stats, started)
    return stats


def project_douban_contributors_tags(args: argparse.Namespace) -> dict[str, int]:
    stats = {
        "author_links": 0,
        "translator_links": 0,
        "tags": 0,
        "tag_links": 0,
    }
    started = time.time()
    if not args.write:
        with connect_pg(args) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH mongo_editions AS (
                      SELECT sr.payload
                      FROM source_records sr
                      JOIN external_ids ex
                        ON ex.source_system = 'legacy_mongo'
                       AND ex.id_type = 'douban_id'
                       AND ex.external_id = sr.payload->>'id'
                      WHERE sr.source_system = 'legacy_mongo'
                        AND sr.source_name = 'local.book'
                    ),
                    authors AS (
                      SELECT DISTINCT trim(value) AS name
                      FROM mongo_editions, jsonb_array_elements_text(coalesce(payload->'author', '[]'::jsonb)) value
                      WHERE trim(value) <> ''
                    ),
                    translators AS (
                      SELECT DISTINCT trim(value) AS name
                      FROM mongo_editions, jsonb_array_elements_text(coalesce(payload->'translator', '[]'::jsonb)) value
                      WHERE trim(value) <> ''
                    ),
                    tag_names AS (
                      SELECT DISTINCT trim(tag->>'name') AS name
                      FROM mongo_editions, jsonb_array_elements(coalesce(payload->'tags', '[]'::jsonb)) tag
                      WHERE trim(coalesce(tag->>'name', '')) <> ''
                    )
                    SELECT
                      (SELECT count(*) FROM authors),
                      (SELECT count(*) FROM translators),
                      (SELECT count(*) FROM tag_names)
                    """
                )
                row = cur.fetchone()
                stats["author_links"] = int(row[0] or 0)
                stats["translator_links"] = int(row[1] or 0)
                stats["tags"] = int(row[2] or 0)
        print_summary("project-douban-contributors-tags", args, stats, started)
        return stats

    with connect_pg(args) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TEMP TABLE tmp_mongo_edition_payloads ON COMMIT DROP AS
                SELECT
                  sr.id AS source_record_id,
                  sr.payload,
                  ex.subject_id AS edition_id
                FROM source_records sr
                JOIN external_ids ex
                  ON ex.source_system = 'legacy_mongo'
                 AND ex.id_type = 'douban_id'
                 AND ex.external_id = sr.payload->>'id'
                WHERE sr.source_system = 'legacy_mongo'
                  AND sr.source_name = 'local.book'
                """
            )
            cur.execute("CREATE INDEX ON tmp_mongo_edition_payloads (edition_id)")

            cur.execute(
                """
                WITH raw_names AS (
                  SELECT DISTINCT
                    trim(value) AS display_name,
                    lower(regexp_replace(trim(value), '\\s+', ' ', 'g')) AS normalized_name
                  FROM tmp_mongo_edition_payloads,
                       jsonb_array_elements_text(coalesce(payload->'author', '[]'::jsonb)) value
                  WHERE trim(value) <> ''
                  UNION
                  SELECT DISTINCT
                    trim(value) AS display_name,
                    lower(regexp_replace(trim(value), '\\s+', ' ', 'g')) AS normalized_name
                  FROM tmp_mongo_edition_payloads,
                       jsonb_array_elements_text(coalesce(payload->'translator', '[]'::jsonb)) value
                  WHERE trim(value) <> ''
                ),
                names AS (
                  SELECT min(display_name) AS display_name, normalized_name
                  FROM raw_names
                  GROUP BY normalized_name
                )
                INSERT INTO contributors (display_name, normalized_name)
                SELECT display_name, normalized_name
                FROM names
                ON CONFLICT (normalized_name) WHERE normalized_name IS NOT NULL AND normalized_name <> ''
                DO UPDATE SET display_name = EXCLUDED.display_name
                """
            )

            cur.execute(
                """
                WITH author_links AS (
                  SELECT DISTINCT
                    tmp.edition_id,
                    c.id AS contributor_id,
                    'author'::contributor_role AS role,
                    author_item.ord::integer - 1 AS position,
                    tmp.source_record_id
                  FROM tmp_mongo_edition_payloads tmp
                  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(tmp.payload->'author', '[]'::jsonb))
                    WITH ORDINALITY AS author_item(value, ord)
                  JOIN contributors c
                    ON c.normalized_name = lower(regexp_replace(trim(author_item.value), '\\s+', ' ', 'g'))
                  WHERE trim(author_item.value) <> ''
                )
                INSERT INTO edition_contributors (edition_id, contributor_id, role, position, source_record_id)
                SELECT edition_id, contributor_id, role, position, source_record_id
                FROM author_links
                ON CONFLICT (edition_id, contributor_id, role, position) DO NOTHING
                """
            )
            stats["author_links"] = cur.rowcount

            cur.execute(
                """
                WITH translator_links AS (
                  SELECT DISTINCT
                    tmp.edition_id,
                    c.id AS contributor_id,
                    'translator'::contributor_role AS role,
                    translator_item.ord::integer - 1 AS position,
                    tmp.source_record_id
                  FROM tmp_mongo_edition_payloads tmp
                  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(tmp.payload->'translator', '[]'::jsonb))
                    WITH ORDINALITY AS translator_item(value, ord)
                  JOIN contributors c
                    ON c.normalized_name = lower(regexp_replace(trim(translator_item.value), '\\s+', ' ', 'g'))
                  WHERE trim(translator_item.value) <> ''
                )
                INSERT INTO edition_contributors (edition_id, contributor_id, role, position, source_record_id)
                SELECT edition_id, contributor_id, role, position, source_record_id
                FROM translator_links
                ON CONFLICT (edition_id, contributor_id, role, position) DO NOTHING
                """
            )
            stats["translator_links"] = cur.rowcount

            cur.execute(
                """
                WITH tag_names AS (
                  SELECT DISTINCT trim(tag->>'name') AS name
                  FROM tmp_mongo_edition_payloads,
                       jsonb_array_elements(coalesce(payload->'tags', '[]'::jsonb)) tag
                  WHERE trim(coalesce(tag->>'name', '')) <> ''
                )
                INSERT INTO tags (name, source_system)
                SELECT name, 'legacy_mongo'
                FROM tag_names
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                """
            )
            stats["tags"] = cur.rowcount

            cur.execute(
                """
                WITH tag_links AS (
                  SELECT DISTINCT
                    tmp.edition_id,
                    tags.id AS tag_id,
                    CASE
                      WHEN (tag->>'count') ~ '^[0-9]+$' THEN (tag->>'count')::integer
                      ELSE NULL
                    END AS count
                  FROM tmp_mongo_edition_payloads tmp
                  CROSS JOIN LATERAL jsonb_array_elements(coalesce(tmp.payload->'tags', '[]'::jsonb)) tag
                  JOIN tags ON tags.name = trim(tag->>'name')
                  WHERE trim(coalesce(tag->>'name', '')) <> ''
                )
                INSERT INTO edition_tags (edition_id, tag_id, source_system, count)
                SELECT edition_id, tag_id, 'legacy_mongo', count
                FROM tag_links
                ON CONFLICT (edition_id, tag_id, source_system)
                DO UPDATE SET count = EXCLUDED.count
                """
            )
            stats["tag_links"] = cur.rowcount
        conn.commit()
    print_summary("project-douban-contributors-tags", args, stats, started)
    return stats


def project_douban_props(args: argparse.Namespace) -> dict[str, int]:
    stats = {
        "mapped_editions": 0,
        "updated_editions": 0,
        "isbn_external_ids": 0,
        "author_links": 0,
        "translator_links": 0,
    }
    started = time.time()
    if not args.write:
        with connect_pg(args) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT count(DISTINCT ex.subject_id)
                    FROM source_records p
                    JOIN external_ids ex
                      ON ex.id_type = 'douban_id'
                     AND ex.external_id = p.payload->>'douban_id'
                    WHERE p.source_system = 'legacy_mysql'
                      AND p.source_name = 'douban.douban_props'
                    """
                )
                stats["mapped_editions"] = int(cur.fetchone()[0] or 0)
        print_summary("project-douban-props", args, stats, started)
        return stats

    with connect_pg(args) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TEMP TABLE tmp_douban_props ON COMMIT DROP AS
                SELECT
                  ex.subject_id AS edition_id,
                  p.id AS source_record_id,
                  p.payload->>'key' AS prop_key,
                  nullif(trim(p.payload->>'value'), '') AS prop_value
                FROM source_records p
                JOIN external_ids ex
                  ON ex.id_type = 'douban_id'
                 AND ex.external_id = p.payload->>'douban_id'
                WHERE p.source_system = 'legacy_mysql'
                  AND p.source_name = 'douban.douban_props'
                  AND nullif(trim(p.payload->>'value'), '') IS NOT NULL
                """
            )
            cur.execute("CREATE INDEX ON tmp_douban_props (edition_id)")
            cur.execute("CREATE INDEX ON tmp_douban_props (prop_key)")
            cur.execute("SELECT count(DISTINCT edition_id) FROM tmp_douban_props")
            stats["mapped_editions"] = int(cur.fetchone()[0] or 0)

            cur.execute(
                """
                CREATE TEMP TABLE tmp_douban_prop_pivot ON COMMIT DROP AS
                SELECT
                  edition_id,
                  min(prop_value) FILTER (WHERE prop_key = 'ISBN') AS isbn,
                  min(prop_value) FILTER (WHERE prop_key = '出版社') AS publisher,
                  min(prop_value) FILTER (WHERE prop_key = '出版年') AS published_text,
                  min(prop_value) FILTER (WHERE prop_key = '定价') AS price_text,
                  min(prop_value) FILTER (WHERE prop_key = '页数') AS pages,
                  min(prop_value) FILTER (WHERE prop_key = '装帧') AS binding,
                  min(prop_value) FILTER (WHERE prop_key = '副标题') AS subtitle,
                  min(prop_value) FILTER (WHERE prop_key = '原作名') AS original_title,
                  min(prop_value) FILTER (WHERE prop_key = '丛书') AS series_title
                FROM tmp_douban_props
                GROUP BY edition_id
                """
            )
            cur.execute(
                """
                CREATE TEMP TABLE tmp_douban_prop_clean ON COMMIT DROP AS
                SELECT
                  p.*,
                  nullif(regexp_replace(coalesce(p.isbn, ''), '[^0-9Xx]', '', 'g'), '') AS clean_isbn
                FROM tmp_douban_prop_pivot p
                """
            )
            cur.execute(
                """
                CREATE TEMP TABLE tmp_douban_prop_values ON COMMIT DROP AS
                SELECT
                  edition_id,
                  CASE WHEN length(clean_isbn) = 10 THEN upper(clean_isbn) END AS isbn10,
                  CASE WHEN length(clean_isbn) = 13 THEN upper(clean_isbn) END AS raw_isbn13,
                  publisher,
                  published_text,
                  NULL::date AS published_date,
                  price_text,
                  pages,
                  binding,
                  subtitle,
                  original_title,
                  series_title
                FROM tmp_douban_prop_clean
                """
            )
            cur.execute(
                """
                CREATE TEMP TABLE tmp_prop_duplicate_isbn13 ON COMMIT DROP AS
                SELECT raw_isbn13 AS isbn13
                FROM tmp_douban_prop_values
                WHERE raw_isbn13 IS NOT NULL
                GROUP BY raw_isbn13
                HAVING count(*) > 1
                """
            )
            cur.execute(
                """
                CREATE TEMP TABLE tmp_douban_prop_final ON COMMIT DROP AS
                SELECT
                  v.*,
                  CASE
                    WHEN d.isbn13 IS NULL AND existing.id IS NULL THEN v.raw_isbn13
                    ELSE NULL
                  END AS isbn13
                FROM tmp_douban_prop_values v
                LEFT JOIN tmp_prop_duplicate_isbn13 d ON d.isbn13 = v.raw_isbn13
                LEFT JOIN editions existing
                  ON existing.isbn13 = v.raw_isbn13
                 AND existing.id <> v.edition_id
                """
            )

            cur.execute(
                """
                WITH updated AS (
                  UPDATE editions e
                  SET
                    isbn10 = CASE WHEN coalesce(e.isbn10, '') = '' THEN f.isbn10 ELSE e.isbn10 END,
                    isbn13 = CASE WHEN coalesce(e.isbn13, '') = '' THEN f.isbn13 ELSE e.isbn13 END,
                    publisher = CASE WHEN coalesce(e.publisher, '') = '' THEN f.publisher ELSE e.publisher END,
                    published_text = CASE WHEN coalesce(e.published_text, '') = '' THEN f.published_text ELSE e.published_text END,
                    published_date = coalesce(e.published_date, f.published_date),
                    price_text = CASE WHEN coalesce(e.price_text, '') = '' THEN f.price_text ELSE e.price_text END,
                    pages = CASE WHEN coalesce(e.pages, '') = '' THEN f.pages ELSE e.pages END,
                    binding = CASE WHEN coalesce(e.binding, '') = '' THEN f.binding ELSE e.binding END,
                    subtitle = CASE WHEN coalesce(e.subtitle, '') = '' THEN f.subtitle ELSE e.subtitle END,
                    original_title = CASE WHEN coalesce(e.original_title, '') = '' THEN f.original_title ELSE e.original_title END,
                    series_title = CASE WHEN coalesce(e.series_title, '') = '' THEN f.series_title ELSE e.series_title END,
                    updated_at = now()
                  FROM tmp_douban_prop_final f
                  WHERE e.id = f.edition_id
                    AND (
                      (coalesce(e.isbn10, '') = '' AND f.isbn10 IS NOT NULL) OR
                      (coalesce(e.isbn13, '') = '' AND f.isbn13 IS NOT NULL) OR
                      (coalesce(e.publisher, '') = '' AND f.publisher IS NOT NULL) OR
                      (coalesce(e.published_text, '') = '' AND f.published_text IS NOT NULL) OR
                      (e.published_date IS NULL AND f.published_date IS NOT NULL) OR
                      (coalesce(e.price_text, '') = '' AND f.price_text IS NOT NULL) OR
                      (coalesce(e.pages, '') = '' AND f.pages IS NOT NULL) OR
                      (coalesce(e.binding, '') = '' AND f.binding IS NOT NULL) OR
                      (coalesce(e.subtitle, '') = '' AND f.subtitle IS NOT NULL) OR
                      (coalesce(e.original_title, '') = '' AND f.original_title IS NOT NULL) OR
                      (coalesce(e.series_title, '') = '' AND f.series_title IS NOT NULL)
                    )
                  RETURNING e.id
                )
                SELECT count(*) FROM updated
                """
            )
            stats["updated_editions"] = int(cur.fetchone()[0] or 0)

            cur.execute(
                """
                WITH ids AS (
                  SELECT edition_id, 'isbn10' AS id_type, isbn10 AS external_id
                  FROM tmp_douban_prop_final
                  WHERE isbn10 IS NOT NULL
                  UNION ALL
                  SELECT edition_id, 'isbn13' AS id_type, isbn13 AS external_id
                  FROM tmp_douban_prop_final
                  WHERE isbn13 IS NOT NULL
                ),
                inserted AS (
                  INSERT INTO external_ids (subject_type, subject_id, source_system, id_type, external_id)
                  SELECT 'edition', edition_id, 'legacy_mysql', id_type, external_id
                  FROM ids
                  ON CONFLICT (source_system, id_type, external_id) DO NOTHING
                  RETURNING id
                )
                SELECT count(*) FROM inserted
                """
            )
            stats["isbn_external_ids"] = int(cur.fetchone()[0] or 0)

            cur.execute(
                """
                CREATE TEMP TABLE tmp_prop_contributor_names ON COMMIT DROP AS
                SELECT min(display_name) AS display_name, normalized_name
                FROM (
                  SELECT
                    trim(part) AS display_name,
                    lower(regexp_replace(trim(part), '\\s+', ' ', 'g')) AS normalized_name
                  FROM tmp_douban_props p,
                       regexp_split_to_table(p.prop_value, '\\s*/\\s*') AS part
                  WHERE p.prop_key IN ('作者', '译者')
                    AND trim(part) <> ''
                ) s
                GROUP BY normalized_name
                """
            )
            cur.execute(
                """
                INSERT INTO contributors (display_name, normalized_name)
                SELECT display_name, normalized_name
                FROM tmp_prop_contributor_names
                ON CONFLICT (normalized_name) WHERE normalized_name IS NOT NULL AND normalized_name <> ''
                DO UPDATE SET display_name = EXCLUDED.display_name
                """
            )

            cur.execute(
                """
                WITH links AS (
                  SELECT DISTINCT
                    p.edition_id,
                    c.id AS contributor_id,
                    CASE p.prop_key WHEN '作者' THEN 'author'::contributor_role ELSE 'translator'::contributor_role END AS role,
                    part.ord::integer - 1 AS position,
                    p.source_record_id
                  FROM tmp_douban_props p
                  CROSS JOIN LATERAL regexp_split_to_table(p.prop_value, '\\s*/\\s*') WITH ORDINALITY AS part(name, ord)
                  JOIN contributors c
                    ON c.normalized_name = lower(regexp_replace(trim(part.name), '\\s+', ' ', 'g'))
                  WHERE p.prop_key IN ('作者', '译者')
                    AND trim(part.name) <> ''
                ),
                inserted AS (
                  INSERT INTO edition_contributors (edition_id, contributor_id, role, position, source_record_id)
                  SELECT edition_id, contributor_id, role, position, source_record_id
                  FROM links
                  ON CONFLICT (edition_id, contributor_id, role, position) DO NOTHING
                  RETURNING role
                )
                SELECT
                  count(*) FILTER (WHERE role = 'author'),
                  count(*) FILTER (WHERE role = 'translator')
                FROM inserted
                """
            )
            row = cur.fetchone()
            stats["author_links"] = int(row[0] or 0)
            stats["translator_links"] = int(row[1] or 0)
        conn.commit()

    print_summary("project-douban-props", args, stats, started)
    return stats


def link_contributor(conn, edition_id: str, contributor_id: str, role: str, position: int, source_record_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO edition_contributors (edition_id, contributor_id, role, position, source_record_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (edition_id, contributor_id, role, position) DO NOTHING
            """,
            (edition_id, contributor_id, role, position, source_record_id),
        )


def project_weread(args: argparse.Namespace) -> dict[str, int]:
    stats = {"seen": 0, "projected": 0, "skipped": 0}
    started = time.time()
    read_conn = connect_pg(args)
    write_conn = connect_pg(args) if args.write else None
    try:
        target_conn = write_conn or read_conn
        for source_record_id, source_pk, payload in source_rows(read_conn, "legacy_mysql", "douban.weixin", args.limit):
            stats["seen"] += 1
            weread_book_id = normalize_text(payload.get("bookId") or payload.get("book_id") or source_pk)
            title = normalize_text(payload.get("title"))
            if not weread_book_id or not title:
                stats["skipped"] += 1
                continue
            if args.write:
                with target_conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO weread_items (
                          weread_book_id, medium, title, author_text, category, cover_url,
                          price, paid, pay_type, soldout, book_status, publish_time,
                          update_time, read_update_time, on_time, cpid, isbn, intro,
                          publisher, total_words, book_size, rating, rating_count,
                          copyright_id, is_in_shelf, is_to_buy, raw_source_record_id
                        )
                        VALUES (
                          %s, 'ebook', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                        ON CONFLICT (weread_book_id) DO UPDATE SET
                          title = EXCLUDED.title,
                          author_text = EXCLUDED.author_text,
                          category = EXCLUDED.category,
                          cover_url = EXCLUDED.cover_url,
                          price = EXCLUDED.price,
                          paid = EXCLUDED.paid,
                          pay_type = EXCLUDED.pay_type,
                          soldout = EXCLUDED.soldout,
                          book_status = EXCLUDED.book_status,
                          publish_time = EXCLUDED.publish_time,
                          update_time = EXCLUDED.update_time,
                          read_update_time = EXCLUDED.read_update_time,
                          on_time = EXCLUDED.on_time,
                          cpid = EXCLUDED.cpid,
                          isbn = EXCLUDED.isbn,
                          intro = EXCLUDED.intro,
                          publisher = EXCLUDED.publisher,
                          total_words = EXCLUDED.total_words,
                          book_size = EXCLUDED.book_size,
                          rating = EXCLUDED.rating,
                          rating_count = EXCLUDED.rating_count,
                          copyright_id = EXCLUDED.copyright_id,
                          is_in_shelf = EXCLUDED.is_in_shelf,
                          is_to_buy = EXCLUDED.is_to_buy,
                          raw_source_record_id = EXCLUDED.raw_source_record_id,
                          updated_at = now()
                        RETURNING id::text
                        """,
                        (
                            weread_book_id,
                            title,
                            normalize_text(payload.get("author")),
                            normalize_text(payload.get("category")),
                            normalize_text(payload.get("cover_url")),
                            parse_decimal(payload.get("price")),
                            parse_bool(payload.get("paid")),
                            parse_int(payload.get("pay_type")),
                            parse_bool(payload.get("soldout")),
                            parse_int(payload.get("book_status")),
                            parse_timestamp(payload.get("publish_time")),
                            parse_timestamp(payload.get("update_time")),
                            parse_timestamp(payload.get("read_update_time")),
                            parse_timestamp(payload.get("on_time")),
                            parse_int(payload.get("cpid")),
                            clean_isbn(payload.get("isbn")),
                            normalize_text(payload.get("intro")),
                            normalize_text(payload.get("publisher")),
                            parse_int(payload.get("total_words")),
                            parse_int(payload.get("book_size")),
                            parse_decimal(payload.get("wx_ratings")),
                            parse_int(payload.get("wx_votes")),
                            parse_int(payload.get("copyright_id")),
                            parse_bool(payload.get("is_inshelf")),
                            parse_bool(payload.get("is_tobuy")),
                            source_record_id,
                        ),
                    )
                    weread_item_id = cur.fetchone()[0]
            stats["projected"] += 1
            maybe_commit(target_conn, args, stats["seen"])
            maybe_progress(args, stats["seen"], "projected weread")
        if args.write:
            target_conn.commit()
    finally:
        read_conn.close()
        if write_conn:
            write_conn.close()
    print_summary("project-weread", args, stats, started)
    return stats


def project_booklists(args: argparse.Namespace) -> dict[str, int]:
    stats = {"seen": 0, "projected": 0, "items": 0, "skipped": 0}
    started = time.time()
    read_conn = connect_pg(args)
    write_conn = connect_pg(args) if args.write else None
    try:
        target_conn = write_conn or read_conn
        for source_record_id, source_pk, payload in source_rows(read_conn, "legacy_mysql", "douban.weixin_booklist", args.limit):
            stats["seen"] += 1
            external_id = normalize_text(payload.get("booklist_id") or source_pk)
            name = normalize_text(payload.get("name"))
            if not external_id or not name:
                stats["skipped"] += 1
                continue
            if args.write:
                with target_conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO booklists (
                          source_system, external_booklist_id, name, description, user_external_id,
                          created_at_source, updated_at_source, stats, raw_source_record_id
                        )
                        VALUES ('legacy_mysql', %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (source_system, external_booklist_id) DO UPDATE SET
                          name = EXCLUDED.name,
                          description = EXCLUDED.description,
                          user_external_id = EXCLUDED.user_external_id,
                          created_at_source = EXCLUDED.created_at_source,
                          updated_at_source = EXCLUDED.updated_at_source,
                          stats = EXCLUDED.stats,
                          raw_source_record_id = EXCLUDED.raw_source_record_id
                        """,
                        (
                            external_id,
                            name,
                            normalize_text(payload.get("description")),
                            normalize_text(payload.get("user_vid")),
                            parse_timestamp(payload.get("create_time")),
                            parse_timestamp(payload.get("update_time")),
                            psycopg2.extras.Json(
                                {
                                    "liked_count": parse_int(payload.get("liked_count")),
                                    "share_count": parse_int(payload.get("share_count")),
                                    "collect_count": parse_int(payload.get("collect_count")),
                                    "comment_count": parse_int(payload.get("comment_count")),
                                    "total_count": parse_int(payload.get("total_count")),
                                },
                                dumps=json_dumps,
                            ),
                            source_record_id,
                        ),
                    )
            stats["projected"] += 1
            maybe_commit(target_conn, args, stats["seen"])
        if args.write:
            target_conn.commit()

        for source_record_id, source_pk, payload in source_rows(read_conn, "legacy_mysql", "douban.weixin_booklist_book", args.limit):
            stats["items"] += 1
            if args.write:
                external_booklist_id = normalize_text(payload.get("booklist_id"))
                weread_book_id = normalize_text(payload.get("weixin_id"))
                with target_conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT bl.id::text, wi.id::text
                        FROM booklists bl
                        LEFT JOIN weread_items wi ON wi.weread_book_id = %s
                        WHERE bl.source_system = 'legacy_mysql' AND bl.external_booklist_id = %s
                        """,
                        (weread_book_id, external_booklist_id),
                    )
                    row = cur.fetchone()
                    if not row:
                        continue
                    booklist_id, weread_item_id = row
                    cur.execute(
                        """
                        INSERT INTO booklist_items (booklist_id, weread_item_id, raw)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (booklist_id, weread_item_id) DO UPDATE SET raw = EXCLUDED.raw
                        """,
                        (booklist_id, weread_item_id, psycopg2.extras.Json(payload, dumps=json_dumps)),
                    )
            maybe_commit(target_conn, args, stats["items"])
            maybe_progress(args, stats["items"], "projected booklist items")
        if args.write:
            target_conn.commit()
    finally:
        read_conn.close()
        if write_conn:
            write_conn.close()
    print_summary("project-booklists", args, stats, started)
    return stats


def project_purchases(args: argparse.Namespace) -> dict[str, int]:
    stats = {"seen": 0, "projected": 0, "skipped": 0}
    started = time.time()
    read_conn = connect_pg(args)
    write_conn = connect_pg(args) if args.write else None
    try:
        target_conn = write_conn or read_conn
        for source_record_id, source_pk, payload in source_rows(read_conn, "legacy_mysql", "douban.weixin_pay_history", args.limit):
            stats["seen"] += 1
            external_id = normalize_text(payload.get("hid") or source_pk)
            weread_book_id = normalize_text(payload.get("bookId") or payload.get("book_id"))
            if not external_id:
                stats["skipped"] += 1
                continue
            if args.write:
                with target_conn.cursor() as cur:
                    cur.execute("SELECT id::text FROM weread_items WHERE weread_book_id = %s", (weread_book_id,))
                    row = cur.fetchone()
                    weread_item_id = row[0] if row else None
                    cur.execute(
                        """
                        INSERT INTO purchase_history (
                          source_system, external_history_id, weread_item_id, weread_book_id,
                          pay_time, expire_time, pay_type, gift, item_count, pay_price_cents,
                          chapter_ids, chapter_uids, raw_source_record_id
                        )
                        VALUES ('legacy_mysql', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (source_system, external_history_id) DO UPDATE SET
                          weread_item_id = EXCLUDED.weread_item_id,
                          weread_book_id = EXCLUDED.weread_book_id,
                          pay_time = EXCLUDED.pay_time,
                          expire_time = EXCLUDED.expire_time,
                          pay_type = EXCLUDED.pay_type,
                          gift = EXCLUDED.gift,
                          item_count = EXCLUDED.item_count,
                          pay_price_cents = EXCLUDED.pay_price_cents,
                          chapter_ids = EXCLUDED.chapter_ids,
                          chapter_uids = EXCLUDED.chapter_uids,
                          raw_source_record_id = EXCLUDED.raw_source_record_id
                        """,
                        (
                            external_id,
                            weread_item_id,
                            weread_book_id,
                            parse_timestamp(payload.get("pay_time")),
                            parse_timestamp(payload.get("expire_time")),
                            parse_int(payload.get("pay_type")),
                            parse_int(payload.get("gift")),
                            parse_int(payload.get("count")),
                            parse_int(payload.get("pay_price")),
                            split_csv_text(payload.get("chapter_ids")),
                            split_csv_text(payload.get("chapter_uids")),
                            source_record_id,
                        ),
                    )
            stats["projected"] += 1
            maybe_commit(target_conn, args, stats["seen"])
            maybe_progress(args, stats["seen"], "projected purchases")
        if args.write:
            target_conn.commit()
    finally:
        read_conn.close()
        if write_conn:
            write_conn.close()
    print_summary("project-purchases", args, stats, started)
    return stats


def project_matches(args: argparse.Namespace) -> dict[str, int]:
    stats = {"seen": 0, "projected": 0, "unresolved": 0, "skipped": 0}
    started = time.time()
    read_conn = connect_pg(args)
    write_conn = connect_pg(args) if args.write else None
    try:
        target_conn = write_conn or read_conn
        for source_record_id, source_pk, payload in source_rows(read_conn, "legacy_mysql", "douban.weixin_douban", args.limit):
            stats["seen"] += 1
            weread_book_id = normalize_text(payload.get("weixin_id"))
            douban_id = normalize_text(payload.get("douban_id"))
            if not weread_book_id or not douban_id:
                stats["skipped"] += 1
                continue
            if args.write:
                with target_conn.cursor() as cur:
                    cur.execute("SELECT id::text FROM weread_items WHERE weread_book_id = %s", (weread_book_id,))
                    weread_row = cur.fetchone()
                    cur.execute(
                        """
                        SELECT subject_id::text
                        FROM external_ids
                        WHERE id_type = 'douban_id' AND external_id = %s
                        ORDER BY CASE source_system WHEN 'legacy_mongo' THEN 0 WHEN 'legacy_mysql' THEN 1 ELSE 2 END
                        LIMIT 1
                        """,
                        (douban_id,),
                    )
                    douban_row = cur.fetchone()
                    if not weread_row:
                        stats["unresolved"] += 1
                        continue
                    weread_item_id = weread_row[0]
                    edition_id = douban_row[0] if douban_row else None
                    if edition_id is None:
                        stats["unresolved"] += 1
                    cur.execute(
                        """
                        INSERT INTO book_matches (
                          weread_item_id, edition_id, douban_edition_id, douban_id,
                          status, is_same_version, confidence, evidence,
                          source_system, legacy_weixin_douban_id
                        )
                        VALUES (%s, %s, %s, %s, 'imported_legacy', %s, %s, %s, 'legacy_mysql', %s)
                        ON CONFLICT (weread_item_id, douban_id) DO UPDATE SET
                          edition_id = EXCLUDED.edition_id,
                          douban_edition_id = EXCLUDED.douban_edition_id,
                          status = EXCLUDED.status,
                          is_same_version = EXCLUDED.is_same_version,
                          confidence = EXCLUDED.confidence,
                          evidence = EXCLUDED.evidence,
                          legacy_weixin_douban_id = EXCLUDED.legacy_weixin_douban_id
                        """,
                        (
                            weread_item_id,
                            edition_id,
                            edition_id,
                            douban_id,
                            parse_bool(payload.get("is_same_version")),
                            Decimal("1.0") if parse_bool(payload.get("is_same_version")) else Decimal("0.7"),
                            psycopg2.extras.Json({"legacy_payload": payload, "source_record_id": source_record_id}, dumps=json_dumps),
                            parse_int(payload.get("id")),
                        ),
                    )
            stats["projected"] += 1
            maybe_commit(target_conn, args, stats["seen"])
            maybe_progress(args, stats["seen"], "projected matches")
        if args.write:
            target_conn.commit()
    finally:
        read_conn.close()
        if write_conn:
            write_conn.close()
    print_summary("project-matches", args, stats, started)
    return stats


def check_projections(args: argparse.Namespace) -> None:
    checks = [
        ("books", "SELECT count(*) FROM books"),
        ("editions", "SELECT count(*) FROM editions"),
        ("contributors", "SELECT count(*) FROM contributors"),
        ("edition_contributors", "SELECT count(*) FROM edition_contributors"),
        ("tags", "SELECT count(*) FROM tags"),
        ("edition_tags", "SELECT count(*) FROM edition_tags"),
        ("external_ids", "SELECT count(*) FROM external_ids"),
        ("weread_items", "SELECT count(*) FROM weread_items"),
        ("booklists", "SELECT count(*) FROM booklists"),
        ("booklist_items", "SELECT count(*) FROM booklist_items"),
        ("purchase_history", "SELECT count(*) FROM purchase_history"),
        ("book_matches", "SELECT count(*) FROM book_matches"),
    ]
    with connect_pg(args) as conn:
        with conn.cursor() as cur:
            for name, sql in checks:
                cur.execute(sql)
                print(f"{name}\t{cur.fetchone()[0]}")


def maybe_commit(conn, args: argparse.Namespace, count: int) -> None:
    if args.write and count % args.batch_size == 0:
        conn.commit()


def maybe_progress(args: argparse.Namespace, count: int, label: str) -> None:
    if count and count % args.progress_every == 0:
        print(f"{label} {count} records...")


def print_summary(command: str, args: argparse.Namespace, stats: dict[str, int], started: float) -> None:
    mode = "WRITE" if args.write else "DRY-RUN"
    elapsed = time.time() - started
    rendered = " ".join(f"{key}={value}" for key, value in stats.items())
    print(f"{command} {mode}: {rendered} elapsed={elapsed:.2f}s")


def main() -> int:
    args = parse_args()
    if args.command == "project-douban":
        project_douban(args)
    elif args.command == "project-douban-sql":
        project_douban_sql(args)
    elif args.command == "project-douban-contributors-tags":
        project_douban_contributors_tags(args)
    elif args.command == "project-douban-props":
        project_douban_props(args)
    elif args.command == "project-weread":
        project_weread(args)
    elif args.command == "project-booklists":
        project_booklists(args)
    elif args.command == "project-purchases":
        project_purchases(args)
    elif args.command == "project-matches":
        project_matches(args)
    elif args.command == "project-all":
        project_douban(args)
        project_douban_sql(args)
        project_douban_contributors_tags(args)
        project_douban_props(args)
        project_weread(args)
        project_booklists(args)
        project_purchases(args)
        project_matches(args)
    elif args.command == "check-projections":
        check_projections(args)
    else:
        raise ValueError(args.command)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
