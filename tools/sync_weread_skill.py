#!/usr/bin/env python3
"""Sync current WeRead shelf through the local WeRead skill gateway.

Raw-first behavior:
- Calls the skill API gateway.
- Saves the exact JSON response to source_records before any projection.
- Optionally projects shelf books/albums/archives from the saved raw record.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras


SKILL_VERSION = "1.0.3"
GATEWAY_URL = "https://i.weread.qq.com/api/agent/gateway"
DEFAULT_PG_DSN = os.environ.get("PG_DSN", "dbname=weread_douban_migration")
BOOKS_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SKILL_RAW_DIR = BOOKS_DIR / "runtime" / "weread-skill-sync"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["shelf-sync", "project-latest-shelf", "check-weread-skill"])
    parser.add_argument("--pg-dsn", default=DEFAULT_PG_DSN)
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--raw-dir", default=str(DEFAULT_SKILL_RAW_DIR))
    parser.add_argument("--no-project", action="store_true", help="Only save raw source_records, do not project.")
    parser.add_argument("--dry-run", action="store_true", help="Call API and write raw file, but do not write PostgreSQL.")
    return parser.parse_args()


def connect_pg(args: argparse.Namespace):
    return psycopg2.connect(args.pg_dsn)


def json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True)


def payload_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json_dumps(payload).encode("utf-8")).hexdigest()


def call_gateway(api_name: str, timeout: int) -> tuple[dict[str, Any], dict[str, Any]]:
    api_key = os.environ.get("WEREAD_API_KEY")
    if not api_key:
        raise SystemExit("WEREAD_API_KEY is not set. Export WEREAD_API_KEY=<your-api-key> and retry.")
    body = {"api_name": api_name, "skill_version": SKILL_VERSION}
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        GATEWAY_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            raw = resp.read()
            payload = json.loads(raw.decode("utf-8"))
            meta = {"status": resp.status, "headers": dict(resp.headers)}
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            payload = {"error": raw.decode("utf-8", errors="replace")}
        meta = {"status": exc.code, "headers": dict(exc.headers)}
    if isinstance(payload, dict) and payload.get("upgrade_info"):
        save_raw_file(api_name, payload)
        message = payload["upgrade_info"].get("message") if isinstance(payload["upgrade_info"], dict) else payload["upgrade_info"]
        raise SystemExit(f"WeRead skill requires upgrade before continuing: {message}")
    return payload, {"request": body, "response": meta}


def save_raw_file(api_name: str, payload: dict[str, Any], raw_dir: str = str(DEFAULT_SKILL_RAW_DIR)) -> Path:
    path = Path(raw_dir)
    path.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = path / f"{timestamp}_{api_name.strip('/').replace('/', '_')}.json"
    filename.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return filename


def insert_source_record(conn, api_name: str, payload: dict[str, Any], meta: dict[str, Any]) -> str:
    digest = payload_hash(payload)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO source_records (
              source_system, source_name, source_pk, record_kind,
              fetched_at, request, response, payload, payload_hash, notes
            )
            VALUES (
              'weread_skill', %s, %s, 'api_response',
              now(), %s, %s, %s, %s, %s
            )
            ON CONFLICT DO NOTHING
            RETURNING id::text
            """,
            (
                api_name,
                stable_source_pk(api_name, payload),
                psycopg2.extras.Json(meta.get("request"), dumps=json.dumps),
                psycopg2.extras.Json(meta.get("response"), dumps=json.dumps),
                psycopg2.extras.Json(payload, dumps=lambda obj: json.dumps(obj, ensure_ascii=False)),
                digest,
                "current WeRead skill sync",
            ),
        )
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute(
            """
            SELECT id::text
            FROM source_records
            WHERE source_system = 'weread_skill'
              AND source_name = %s
              AND source_pk = %s
              AND payload_hash = %s
            ORDER BY imported_at DESC
            LIMIT 1
            """,
            (api_name, stable_source_pk(api_name, payload), digest),
        )
        existing = cur.fetchone()
    if not existing:
        raise RuntimeError("source_records insert returned no id and no existing row was found")
    return existing[0]


def stable_source_pk(api_name: str, payload: dict[str, Any]) -> str:
    if api_name == "/shelf/sync":
        books = payload.get("books") if isinstance(payload.get("books"), list) else []
        albums = payload.get("albums") if isinstance(payload.get("albums"), list) else []
        mp = payload.get("mp")
        return f"shelf:{len(books)}:{len(albums)}:{1 if mp else 0}"
    return api_name


def shelf_counts(payload: dict[str, Any]) -> dict[str, int]:
    books = payload.get("books") if isinstance(payload.get("books"), list) else []
    albums = payload.get("albums") if isinstance(payload.get("albums"), list) else []
    mp = payload.get("mp")
    return {
        "books": len(books),
        "albums": len(albums),
        "mp": 1 if mp else 0,
        "total": len(books) + len(albums) + (1 if mp else 0),
        "private": sum(1 for book in books if book.get("secret") == 1)
        + sum(1 for album in albums if (album.get("albumInfoExtra") or {}).get("secret") == 1)
        + (1 if mp else 0),
    }


def parse_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"1", "true", "yes"}:
        return True
    if text in {"0", "false", "no"}:
        return False
    return None


def unix_ts(value: Any) -> datetime | None:
    if value in (None, "", 0, "0"):
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def decimal_or_none(value: Any):
    if value in (None, ""):
        return None
    try:
        return str(value)
    except Exception:
        return None


def project_shelf_payload(conn, source_record_id: str, payload: dict[str, Any]) -> dict[str, int]:
    stats = {"books": 0, "albums": 0, "archives": 0, "archive_items": 0}
    books = payload.get("books") if isinstance(payload.get("books"), list) else []
    albums = payload.get("albums") if isinstance(payload.get("albums"), list) else []
    archives = payload.get("archive") if isinstance(payload.get("archive"), list) else []

    with conn.cursor() as cur:
        for book in books:
            book_id = str(book.get("bookId") or "").strip()
            title = str(book.get("title") or "").strip()
            if not book_id or not title:
                continue
            cur.execute(
                """
                INSERT INTO weread_items (
                  weread_book_id, medium, title, author_text, category, cover_url,
                  paid, pay_type, publish_time, update_time, read_update_time,
                  intro, publisher, rating, rating_count, is_in_shelf, raw_source_record_id
                )
                VALUES (%s, 'ebook', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, %s)
                ON CONFLICT (weread_book_id) DO UPDATE SET
                  medium = EXCLUDED.medium,
                  title = EXCLUDED.title,
                  author_text = EXCLUDED.author_text,
                  category = EXCLUDED.category,
                  cover_url = EXCLUDED.cover_url,
                  paid = coalesce(EXCLUDED.paid, weread_items.paid),
                  pay_type = coalesce(EXCLUDED.pay_type, weread_items.pay_type),
                  update_time = coalesce(EXCLUDED.update_time, weread_items.update_time),
                  read_update_time = coalesce(EXCLUDED.read_update_time, weread_items.read_update_time),
                  is_in_shelf = true,
                  raw_source_record_id = EXCLUDED.raw_source_record_id,
                  updated_at = now()
                """,
                (
                    book_id,
                    title,
                    book.get("author"),
                    book.get("category"),
                    book.get("cover"),
                    parse_bool(book.get("paid")),
                    book.get("payType"),
                    unix_ts(book.get("publishTime")),
                    unix_ts(book.get("updateTime")),
                    unix_ts(book.get("readUpdateTime")),
                    book.get("intro"),
                    book.get("publisher"),
                    decimal_or_none(book.get("newRating") or book.get("rating")),
                    book.get("ratingCount"),
                    source_record_id,
                ),
            )
            stats["books"] += 1

        for album in albums:
            info = album.get("albumInfo") or {}
            extra = album.get("albumInfoExtra") or {}
            album_id = str(info.get("albumId") or "").strip()
            title = str(info.get("name") or "").strip()
            if not album_id or not title:
                continue
            weread_id = f"album:{album_id}"
            cur.execute(
                """
                INSERT INTO weread_items (
                  weread_book_id, medium, title, author_text, cover_url,
                  paid, pay_type, update_time, read_update_time, intro,
                  is_in_shelf, raw_source_record_id
                )
                VALUES (%s, 'audiobook', %s, %s, %s, %s, %s, %s, %s, %s, true, %s)
                ON CONFLICT (weread_book_id) DO UPDATE SET
                  medium = EXCLUDED.medium,
                  title = EXCLUDED.title,
                  author_text = EXCLUDED.author_text,
                  cover_url = EXCLUDED.cover_url,
                  paid = EXCLUDED.paid,
                  pay_type = EXCLUDED.pay_type,
                  update_time = EXCLUDED.update_time,
                  read_update_time = EXCLUDED.read_update_time,
                  intro = EXCLUDED.intro,
                  is_in_shelf = true,
                  raw_source_record_id = EXCLUDED.raw_source_record_id,
                  updated_at = now()
                """,
                (
                    weread_id,
                    title,
                    info.get("authorName"),
                    info.get("cover"),
                    parse_bool(extra.get("lecturePaid")),
                    info.get("payType"),
                    unix_ts(info.get("updateTime")),
                    unix_ts(extra.get("lectureReadUpdateTime")),
                    info.get("intro"),
                    source_record_id,
                ),
            )
            stats["albums"] += 1

        for archive in archives:
            archive_id = str(archive.get("archiveId") or archive.get("id") or archive.get("name") or "").strip()
            name = str(archive.get("name") or archive_id).strip()
            if not archive_id or not name:
                continue
            cur.execute(
                """
                INSERT INTO weread_archives (archive_id, name, archive_type, sort_order, raw_source_record_id)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (archive_id) DO UPDATE SET
                  name = EXCLUDED.name,
                  archive_type = EXCLUDED.archive_type,
                  sort_order = EXCLUDED.sort_order,
                  raw_source_record_id = EXCLUDED.raw_source_record_id,
                  updated_at = now()
                RETURNING id
                """,
                (archive_id, name, archive.get("type"), archive.get("sort"), source_record_id),
            )
            db_archive_id = cur.fetchone()[0]
            stats["archives"] += 1
            for book_id in archive.get("bookIds") or []:
                cur.execute("SELECT id FROM weread_items WHERE weread_book_id = %s", (str(book_id),))
                row = cur.fetchone()
                if not row:
                    continue
                cur.execute(
                    """
                    INSERT INTO weread_archive_items (archive_id, weread_item_id, item_medium)
                    VALUES (%s, %s, 'ebook')
                    ON CONFLICT (archive_id, weread_item_id) DO NOTHING
                    """,
                    (db_archive_id, row[0]),
                )
                stats["archive_items"] += cur.rowcount

    return stats


def shelf_sync(args: argparse.Namespace) -> None:
    started = time.time()
    payload, meta = call_gateway("/shelf/sync", args.timeout)
    raw_path = save_raw_file("/shelf/sync", payload, args.raw_dir)
    counts = shelf_counts(payload) if isinstance(payload, dict) else {"books": 0, "albums": 0, "mp": 0, "total": 0, "private": 0}
    if args.dry_run:
        print(
            json.dumps(
                {
                    "mode": "dry-run",
                    "raw_path": str(raw_path),
                    "errcode": payload.get("errcode"),
                    "errmsg": payload.get("errmsg"),
                    "errlog": payload.get("errlog"),
                    "counts": counts,
                },
                ensure_ascii=False,
            )
        )
        return

    with connect_pg(args) as conn:
        source_record_id = insert_source_record(conn, "/shelf/sync", payload, meta)
        if payload.get("errcode") not in (None, 0):
            conn.commit()
            print(
                json.dumps(
                    {
                        "source_record_id": source_record_id,
                        "raw_path": str(raw_path),
                        "errcode": payload.get("errcode"),
                        "errmsg": payload.get("errmsg"),
                        "errlog": payload.get("errlog"),
                        "counts": counts,
                    },
                    ensure_ascii=False,
                )
            )
            return
        projection = {} if args.no_project else project_shelf_payload(conn, source_record_id, payload)
        conn.commit()
    elapsed = time.time() - started
    print(
        json.dumps(
            {
                "source_record_id": source_record_id,
                "raw_path": str(raw_path),
                "counts": counts,
                "projection": projection,
                "elapsed_seconds": round(elapsed, 2),
            },
            ensure_ascii=False,
        )
    )


def project_latest_shelf(args: argparse.Namespace) -> None:
    with connect_pg(args) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT id::text, payload
                FROM source_records
                WHERE source_system = 'weread_skill' AND source_name = '/shelf/sync'
                ORDER BY fetched_at DESC NULLS LAST, imported_at DESC
                LIMIT 1
                """
            )
            row = cur.fetchone()
        if not row:
            raise SystemExit("No /shelf/sync source_record found")
        stats = project_shelf_payload(conn, row["id"], row["payload"])
        conn.commit()
    print(json.dumps({"source_record_id": row["id"], "projection": stats}, ensure_ascii=False))


def check_weread_skill(args: argparse.Namespace) -> None:
    with connect_pg(args) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT source_name, count(*), max(imported_at)
                FROM source_records
                WHERE source_system = 'weread_skill'
                GROUP BY source_name
                ORDER BY source_name
                """
            )
            source_rows = cur.fetchall()
            cur.execute("SELECT count(*) FILTER (WHERE is_in_shelf), count(*) FROM weread_items")
            shelf_count = cur.fetchone()
            cur.execute("SELECT count(*) FROM weread_archives")
            archives = cur.fetchone()[0]
    print("source_records")
    for name, count, imported_at in source_rows:
        print(f"{name}\t{count}\t{imported_at}")
    print(f"weread_items_in_shelf\t{shelf_count[0]}\nweread_items_total\t{shelf_count[1]}\nweread_archives\t{archives}")


def main() -> int:
    args = parse_args()
    if args.command == "shelf-sync":
        shelf_sync(args)
    elif args.command == "project-latest-shelf":
        project_latest_shelf(args)
    elif args.command == "check-weread-skill":
        check_weread_skill(args)
    else:
        raise ValueError(args.command)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
