#!/usr/bin/env python3
"""Sync current WeRead shelf details through the mobile skey API.

This script reads the full shelf ID response from /shelf/sync?onlyBookid=1,
then batches IDs into /shelf/syncbook requests. Raw responses are saved before
any projection and can also be inserted into PostgreSQL source_records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BOOKS_DIR = Path(__file__).resolve().parents[1]
DEFAULT_RAW_DIR = BOOKS_DIR / "runtime" / "weread-mobile-sync" / "syncbook-full"
DEFAULT_SHELF_IDS = BOOKS_DIR / "runtime" / "weread-mobile-sync" / "shelfSync_onlyBookid_synckey0.json"
DEFAULT_PG_DSN = os.environ.get("PG_DSN", "dbname=weread_douban_migration")
SYNCBOOK_URL = "https://i.weread.qq.com/shelf/syncbook"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["syncbook", "check-raw", "project-raw"])
    parser.add_argument("--skey", default=os.environ.get("WEREAD_SKEY", ""))
    parser.add_argument("--vid", default=os.environ.get("WEREAD_VID", ""))
    parser.add_argument("--shelf-ids", default=str(DEFAULT_SHELF_IDS))
    parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR))
    parser.add_argument("--pg-dsn", default=DEFAULT_PG_DSN)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--limit-batches", type=int, default=0)
    parser.add_argument("--start-batch", type=int, default=0)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--write-db", action="store_true")
    return parser.parse_args()


def load_ids(path: str) -> tuple[list[str], list[str]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    book_ids: list[str] = []
    album_ids: list[str] = []
    for item in payload.get("bookIds", []):
        book_id = item.get("bookId")
        if not book_id:
            continue
        if item.get("type") == 1:
            album_ids.append(book_id)
        else:
            book_ids.append(book_id)
    return book_ids, album_ids


def batched(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def request_payload_for_batch(book_batch: list[str], album_batch: list[str] | None = None) -> dict[str, Any]:
    return {
        "bookIds": book_batch,
        "albumIds": album_batch or [],
    }


def call_syncbook(args: argparse.Namespace, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        SYNCBOOK_URL,
        data=body,
        method="POST",
        headers={
            "Host": "i.weread.qq.com",
            "channelId": "AppStore",
            "Accept": "*/*",
            "vid": args.vid,
            "Accept-Language": "zh-Hans-CN;q=1, en-CN;q=0.9",
            "Content-Type": "application/json",
            "basever": "10.1.0.80",
            "User-Agent": "WeRead/10.1.0 (iPhone; iOS 26.4.2; Scale/3.00)",
            "skey": args.skey,
            "v": "10.1.0.80",
        },
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=args.timeout) as resp:  # noqa: S310
            raw = resp.read()
            status = resp.status
            headers = dict(resp.headers)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code
        headers = dict(exc.headers)

    text = raw.decode("utf-8", errors="replace")
    try:
        data: Any = json.loads(text)
    except json.JSONDecodeError:
        data = {"raw_text": text}
    return {
        "status": status,
        "headers": headers,
        "elapsed_seconds": round(time.time() - started, 3),
        "response_bytes": len(raw),
        "payload": data,
    }


def save_raw(raw_dir: Path, batch_index: int, request_payload: dict[str, Any], result: dict[str, Any]) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / f"syncbook_batch_{batch_index:05d}.json"
    record = {
        "batch_index": batch_index,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "request": {
            "url": SYNCBOOK_URL,
            "bookIds": request_payload.get("bookIds", []),
            "albumIds": request_payload.get("albumIds", []),
        },
        "response": {
            "status": result["status"],
            "headers": result["headers"],
            "elapsed_seconds": result["elapsed_seconds"],
            "response_bytes": result["response_bytes"],
        },
        "payload": result["payload"],
    }
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def connect_pg(args: argparse.Namespace):
    import psycopg2

    return psycopg2.connect(args.pg_dsn)


def insert_source_record(conn, batch_index: int, raw_path: Path, request_payload: dict[str, Any], result: dict[str, Any]) -> str:
    import psycopg2.extras

    payload = result["payload"]
    digest = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    request_hash = hashlib.sha256(
        json.dumps(request_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]
    source_pk = f"syncbook:batch:{batch_index:05d}:{request_hash}"
    request = {
        "method": "POST",
        "url": SYNCBOOK_URL,
        "headers": {
            "Host": "i.weread.qq.com",
            "vid": "<redacted>",
            "skey": "<redacted>",
            "basever": "10.1.0.80",
            "User-Agent": "WeRead/10.1.0 (iPhone; iOS 26.4.2; Scale/3.00)",
        },
        "payload": request_payload,
    }
    response = {
        "status": result["status"],
        "elapsed_seconds": result["elapsed_seconds"],
        "response_bytes": result["response_bytes"],
        "raw_path": str(raw_path),
    }
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO source_records (
              source_system, source_name, source_pk, source_url, record_kind,
              fetched_at, request, response, payload, payload_hash, notes
            )
            VALUES (
              'weread_mobile', 'shelf/syncbook', %s, %s, 'api_response',
              now(), %s, %s, %s, %s, 'iOS WeRead syncbook full shelf batch; auth headers redacted'
            )
            ON CONFLICT DO NOTHING
            RETURNING id::text
            """,
            (
                source_pk,
                SYNCBOOK_URL,
                psycopg2.extras.Json(request, dumps=json.dumps),
                psycopg2.extras.Json(response, dumps=json.dumps),
                psycopg2.extras.Json(payload, dumps=lambda obj: json.dumps(obj, ensure_ascii=False)),
                digest,
            ),
        )
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute(
            """
            SELECT id::text
            FROM source_records
            WHERE source_system = 'weread_mobile'
              AND source_name = 'shelf/syncbook'
              AND source_pk = %s
              AND payload_hash = %s
            LIMIT 1
            """,
            (source_pk, digest),
        )
        existing = cur.fetchone()
    if not existing:
        raise RuntimeError(f"source_records insert returned no row for batch {batch_index}")
    return existing[0]


def summarize_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {"payload_type": type(payload).__name__}
    return {
        "errcode": payload.get("errcode") or payload.get("errCode"),
        "books": len(payload.get("books") or []),
        "albums": len(payload.get("albums") or []),
        "bookProgress": len(payload.get("bookProgress") or []),
        "emptyInfoIds": len(payload.get("emptyInfoIds") or []),
        "supplyBooks": len(payload.get("supplyBooks") or []),
    }


def run_syncbook(args: argparse.Namespace) -> None:
    if not args.skey:
        raise SystemExit("Missing --skey or WEREAD_SKEY")

    book_ids, album_ids = load_ids(args.shelf_ids)
    book_batches = batched(book_ids, args.batch_size)
    album_batches = batched(album_ids, args.batch_size)
    total_batches = max(len(book_batches), len(album_batches))
    selected_end = total_batches if not args.limit_batches else min(total_batches, args.start_batch + args.limit_batches)
    raw_dir = Path(args.raw_dir)

    conn = connect_pg(args) if args.write_db else None
    totals = {"books": 0, "albums": 0, "bookProgress": 0, "emptyInfoIds": 0, "batches": 0}
    try:
        for batch_index in range(args.start_batch, selected_end):
            request_payload = request_payload_for_batch(
                book_batches[batch_index] if batch_index < len(book_batches) else [],
                album_batches[batch_index] if batch_index < len(album_batches) else [],
            )
            result = call_syncbook(args, request_payload)
            raw_path = save_raw(raw_dir, batch_index, request_payload, result)
            summary = summarize_payload(result["payload"])
            if result["status"] != 200 or summary.get("errcode"):
                print(json.dumps({"batch": batch_index, "raw_path": str(raw_path), **summary}, ensure_ascii=False))
                raise SystemExit(f"syncbook batch {batch_index} failed")
            source_record_id = None
            if conn:
                source_record_id = insert_source_record(conn, batch_index, raw_path, request_payload, result)
                conn.commit()
            totals["books"] += int(summary.get("books") or 0)
            totals["albums"] += int(summary.get("albums") or 0)
            totals["bookProgress"] += int(summary.get("bookProgress") or 0)
            totals["emptyInfoIds"] += int(summary.get("emptyInfoIds") or 0)
            totals["batches"] += 1
            print(
                json.dumps(
                    {
                        "batch": batch_index,
                        "status": result["status"],
                        "elapsed_seconds": result["elapsed_seconds"],
                        "raw_path": str(raw_path),
                        "source_record_id": source_record_id,
                        **summary,
                    },
                    ensure_ascii=False,
                )
            )
            if args.sleep:
                time.sleep(args.sleep)
    finally:
        if conn:
            conn.close()
    print(json.dumps({"done": True, **totals}, ensure_ascii=False))


def check_raw(args: argparse.Namespace) -> None:
    raw_dir = Path(args.raw_dir)
    totals = {"files": 0, "books": 0, "albums": 0, "bookProgress": 0, "emptyInfoIds": 0}
    for path in sorted(raw_dir.glob("syncbook_batch_*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        summary = summarize_payload(record.get("payload"))
        totals["files"] += 1
        for key in ["books", "albums", "bookProgress", "emptyInfoIds"]:
            totals[key] += int(summary.get(key) or 0)
    print(json.dumps(totals, ensure_ascii=False, indent=2))


def parse_timestamp(value: Any) -> datetime | None:
    if value in (None, "", 0):
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def parse_datetime_text(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, (int, float)):
        return parse_timestamp(value)
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def bool_or_none(value: Any) -> bool | None:
    if value is None:
        return None
    return bool(value)


def numeric_rating(value: Any) -> float | None:
    if value in (None, "", 0):
        return None
    try:
        rating = float(value)
    except (TypeError, ValueError):
        return None
    if rating > 10:
        rating = rating / 100
    return round(rating, 2)


def source_record_map(conn, raw_dir: Path) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT response->>'raw_path', id::text
            FROM source_records
            WHERE source_system = 'weread_mobile'
              AND source_name = 'shelf/syncbook'
              AND response ? 'raw_path'
              AND response->>'raw_path' LIKE %s
            """,
            (str(raw_dir) + "%",),
        )
        return {path: source_id for path, source_id in cur.fetchall() if path}


def upsert_weread_item(conn, item: dict[str, Any], source_record_id: str | None, medium: str) -> None:
    if medium == "audiobook":
        album_info = item.get("albumInfo") or {}
        extra = item.get("albumInfoExtra") or {}
        weread_book_id = f"album:{album_info.get('albumId')}"
        title = album_info.get("name") or ""
        author_text = album_info.get("authorName") or album_info.get("bookAuthor")
        cover_url = album_info.get("cover")
        category = "有声书"
        paid = bool_or_none(extra.get("lecturePaid"))
        pay_type = album_info.get("payType")
        soldout = bool_or_none(album_info.get("off"))
        book_status = album_info.get("finish")
        publish_time = None
        update_time = parse_timestamp(album_info.get("updateTime"))
        read_update_time = parse_timestamp(extra.get("lectureReadUpdateTime"))
        total_words = None
        book_size = album_info.get("trackCount")
        rating = None
        rating_count = None
        intro = album_info.get("intro")
        publisher = None
    else:
        weread_book_id = str(item.get("bookId") or "")
        title = item.get("title") or ""
        author_text = item.get("author")
        cover_url = item.get("cover")
        category = item.get("category")
        paid = bool_or_none(item.get("paid"))
        pay_type = item.get("payType")
        soldout = bool_or_none(item.get("soldout"))
        book_status = item.get("bookStatus")
        publish_time = parse_datetime_text(item.get("publishTime"))
        update_time = parse_timestamp(item.get("updateTime"))
        read_update_time = parse_timestamp(item.get("readUpdateTime"))
        total_words = item.get("totalWords")
        book_size = item.get("bookSize")
        rating = numeric_rating(item.get("newRating"))
        rating_count = item.get("newRatingCount")
        intro = item.get("intro")
        publisher = item.get("publisher")

    if not weread_book_id or not title:
        return
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO weread_items (
              weread_book_id, medium, title, author_text, category, cover_url,
              price, paid, pay_type, soldout, book_status, publish_time,
              update_time, read_update_time, isbn, intro, publisher,
              total_words, book_size, rating, rating_count,
              is_in_shelf, raw_source_record_id, updated_at
            )
            VALUES (
              %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s,
              true, %s, now()
            )
            ON CONFLICT (weread_book_id) DO UPDATE SET
              medium = EXCLUDED.medium,
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
              isbn = COALESCE(EXCLUDED.isbn, weread_items.isbn),
              intro = COALESCE(EXCLUDED.intro, weread_items.intro),
              publisher = COALESCE(EXCLUDED.publisher, weread_items.publisher),
              total_words = EXCLUDED.total_words,
              book_size = EXCLUDED.book_size,
              rating = EXCLUDED.rating,
              rating_count = EXCLUDED.rating_count,
              is_in_shelf = true,
              raw_source_record_id = EXCLUDED.raw_source_record_id,
              updated_at = now()
            """,
            (
                weread_book_id,
                medium,
                title,
                author_text,
                category,
                cover_url,
                item.get("price") if medium != "audiobook" else None,
                paid,
                pay_type,
                soldout,
                book_status,
                publish_time,
                update_time,
                read_update_time,
                item.get("isbn") if medium != "audiobook" else None,
                intro,
                publisher,
                total_words,
                book_size,
                rating,
                rating_count,
                source_record_id,
            ),
        )


def project_raw(args: argparse.Namespace) -> None:
    raw_dir = Path(args.raw_dir)
    conn = connect_pg(args)
    totals = {"files": 0, "books": 0, "albums": 0}
    try:
        raw_to_source = source_record_map(conn, raw_dir)
        for path in sorted(raw_dir.glob("syncbook_batch_*.json")):
            source_record_id = raw_to_source.get(str(path))
            record = json.loads(path.read_text(encoding="utf-8"))
            payload = record.get("payload") or {}
            for book in payload.get("books") or []:
                upsert_weread_item(conn, book, source_record_id, "ebook")
                totals["books"] += 1
            for album in payload.get("albums") or []:
                upsert_weread_item(conn, album, source_record_id, "audiobook")
                totals["albums"] += 1
            totals["files"] += 1
            if totals["files"] % 10 == 0:
                conn.commit()
                print(json.dumps({"projected_files": totals["files"], "books": totals["books"], "albums": totals["albums"]}))
        conn.commit()
    finally:
        conn.close()
    print(json.dumps({"done": True, **totals}, ensure_ascii=False))


def main() -> int:
    args = parse_args()
    if args.command == "syncbook":
        run_syncbook(args)
    elif args.command == "check-raw":
        check_raw(args)
    elif args.command == "project-raw":
        project_raw(args)
    else:
        raise ValueError(args.command)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
