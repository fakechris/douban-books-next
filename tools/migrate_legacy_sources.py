#!/usr/bin/env python3
"""Phase 1 source-record importer for the legacy data migration.

Safety properties:
- Legacy MySQL is read in a READ ONLY transaction.
- Mongo BSON and Elasticsearch are read-only inputs.
- PostgreSQL writes happen only with --write.
- The importer writes only to source_records; it does not project business tables.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql
import psycopg2
import psycopg2.extras
from bson import decode_file_iter
from bson.json_util import dumps as bson_dumps


DEFAULT_MYSQL_TABLES = [
    "weixin",
    "weixin_douban",
    "weixin_booklist",
    "weixin_booklist_book",
    "weixin_pay_history",
    "weixin_copyright",
    "weixin_user",
    "author",
    "meta_book",
    "weixin_meta_book",
    "books",
    "douban_props",
    "jdbook",
    "zybook",
]

MYSQL_PK_COLUMNS = {
    "weixin": "index",
    "weixin_douban": "id",
    "weixin_booklist": "id",
    "weixin_booklist_book": "id",
    "weixin_pay_history": "id",
    "weixin_copyright": "id",
    "weixin_user": "id",
    "author": "id",
    "meta_book": "id",
    "weixin_meta_book": "id",
    "books": "id",
    "douban_props": "id",
    "jdbook": "id",
    "zybook": "id",
}


@dataclass
class SourceRecord:
    source_system: str
    source_name: str
    source_pk: str | None
    record_kind: str
    payload: dict[str, Any]
    source_url: str | None = None
    request: dict[str, Any] | None = None
    response: dict[str, Any] | None = None
    fetched_at: datetime | None = None
    notes: str | None = None

    @property
    def payload_hash(self) -> str:
        raw = json.dumps(self.payload, ensure_ascii=False, sort_keys=True, default=json_default)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def json_default(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    return str(obj)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=["init-schema", "import-mysql", "import-mongo-bson", "import-es", "import-all", "check-target"],
    )
    parser.add_argument("--write", action="store_true", help="Actually write to PostgreSQL. Default is dry-run.")
    parser.add_argument("--pg-dsn", default=os.environ.get("PG_DSN", "dbname=postgres"))
    parser.add_argument(
        "--allow-default-pg-dsn",
        action="store_true",
        help="Permit writes to the default dbname=postgres DSN. Use only for disposable targets.",
    )
    parser.add_argument("--schema", default="docs/legacy-migration/postgres_target_schema.sql")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--limit", type=int, default=0, help="Maximum records per source. 0 means no limit.")
    parser.add_argument("--progress-every", type=int, default=10000)

    parser.add_argument("--mysql-host", default="127.0.0.1")
    parser.add_argument("--mysql-port", type=int, default=3306)
    parser.add_argument("--mysql-socket", default="/tmp/mysql.sock")
    parser.add_argument("--mysql-user", default="root")
    parser.add_argument("--mysql-password", default="")
    parser.add_argument("--mysql-db", default="douban")
    parser.add_argument("--mysql-tables", default=",".join(DEFAULT_MYSQL_TABLES))

    parser.add_argument("--mongo-bson", default="backup/mongo.out/local/book.bson")
    parser.add_argument("--es-url", default="http://127.0.0.1:9200")
    parser.add_argument("--es-indices", default="douban,weixin")
    return parser.parse_args()


def connect_pg(args: argparse.Namespace):
    return psycopg2.connect(args.pg_dsn)


def ensure_safe_write_target(args: argparse.Namespace) -> None:
    if not args.write:
        return
    env_dsn = os.environ.get("PG_DSN")
    using_default = args.pg_dsn == "dbname=postgres" and not env_dsn
    if using_default and not args.allow_default_pg_dsn:
        raise SystemExit(
            "Refusing to write to the default PostgreSQL DSN `dbname=postgres`. "
            "Create a dedicated target database and pass --pg-dsn or set PG_DSN. "
            "For a disposable test only, add --allow-default-pg-dsn."
        )


def init_schema(args: argparse.Namespace) -> None:
    if not args.write:
        print("DRY-RUN init-schema: pass --write to apply schema to PostgreSQL.")
        return
    ensure_safe_write_target(args)
    schema_path = Path(args.schema)
    sql = schema_path.read_text(encoding="utf-8")
    with connect_pg(args) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
    print(f"Applied schema from {schema_path}")


def insert_source_records(conn, records: list[SourceRecord]) -> int:
    if not records:
        return 0
    rows = [
        (
            r.source_system,
            r.source_name,
            r.source_pk,
            r.source_url,
            r.record_kind,
            r.fetched_at,
            psycopg2.extras.Json(r.request, dumps=json_dumps) if r.request is not None else None,
            psycopg2.extras.Json(r.response, dumps=json_dumps) if r.response is not None else None,
            psycopg2.extras.Json(r.payload, dumps=json_dumps),
            r.payload_hash,
            r.notes,
        )
        for r in records
    ]
    sql = """
        INSERT INTO source_records (
          source_system, source_name, source_pk, source_url, record_kind,
          fetched_at, request, response, payload, payload_hash, notes
        )
        VALUES %s
        ON CONFLICT DO NOTHING
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows, page_size=len(rows))
        return cur.rowcount


def json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=json_default)


def flush_batch(args: argparse.Namespace, conn, batch: list[SourceRecord], stats: dict[str, int]) -> None:
    if not batch:
        return
    stats["seen"] += len(batch)
    if args.write:
        inserted = insert_source_records(conn, batch)
        stats["inserted"] += inserted
        conn.commit()
    batch.clear()
    if stats["seen"] % args.progress_every < args.batch_size:
        action = "inserted" if args.write else "validated"
        print(f"{action} {stats['seen']} records...")


def connect_mysql(args: argparse.Namespace):
    return pymysql.connect(
        host=args.mysql_host,
        port=args.mysql_port,
        user=args.mysql_user,
        password=args.mysql_password,
        database=args.mysql_db,
        unix_socket=args.mysql_socket if args.mysql_socket else None,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def iter_mysql_table(conn, table: str, pk: str, batch_size: int, limit: int) -> Iterator[dict[str, Any]]:
    last_pk = None
    yielded = 0
    with conn.cursor() as cur:
        while True:
            where = ""
            params: list[Any] = []
            if last_pk is not None:
                where = f"WHERE `{pk}` > %s"
                params.append(last_pk)
            sql = f"SELECT * FROM `{table}` {where} ORDER BY `{pk}` ASC LIMIT %s"
            params.append(batch_size)
            cur.execute(sql, params)
            rows = cur.fetchall()
            if not rows:
                break
            for row in rows:
                last_pk = row[pk]
                yield row
                yielded += 1
                if limit and yielded >= limit:
                    return


def import_mysql(args: argparse.Namespace) -> dict[str, int]:
    ensure_safe_write_target(args)
    tables = [t.strip() for t in args.mysql_tables.split(",") if t.strip()]
    stats = {"seen": 0, "inserted": 0}
    pg_conn = connect_pg(args) if args.write else None
    batch: list[SourceRecord] = []
    started = time.time()

    mysql_conn = connect_mysql(args)
    try:
        with mysql_conn.cursor() as cur:
            cur.execute("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            cur.execute("START TRANSACTION READ ONLY")
        for table in tables:
            pk = MYSQL_PK_COLUMNS.get(table, "id")
            table_seen_before = stats["seen"]
            for row in iter_mysql_table(mysql_conn, table, pk, args.batch_size, args.limit):
                source_pk = str(row.get(pk)) if row.get(pk) is not None else None
                batch.append(
                    SourceRecord(
                        source_system="legacy_mysql",
                        source_name=f"{args.mysql_db}.{table}",
                        source_pk=source_pk,
                        record_kind="sql_row",
                        payload=row,
                    )
                )
                if len(batch) >= args.batch_size:
                    flush_batch(args, pg_conn, batch, stats)
            flush_batch(args, pg_conn, batch, stats)
            print(f"mysql {table}: {stats['seen'] - table_seen_before} records")
        mysql_conn.rollback()
    finally:
        mysql_conn.close()
        if pg_conn:
            pg_conn.close()

    print_summary("import-mysql", args, stats, started)
    return stats


def import_mongo_bson(args: argparse.Namespace) -> dict[str, int]:
    ensure_safe_write_target(args)
    path = Path(args.mongo_bson)
    if not path.exists():
        raise FileNotFoundError(path)
    stats = {"seen": 0, "inserted": 0}
    pg_conn = connect_pg(args) if args.write else None
    batch: list[SourceRecord] = []
    started = time.time()

    try:
        with path.open("rb") as fh:
            for doc in decode_file_iter(fh):
                payload = json.loads(bson_dumps(doc))
                source_pk = str(doc.get("id") or doc.get("_id"))
                batch.append(
                    SourceRecord(
                        source_system="legacy_mongo",
                        source_name="local.book",
                        source_pk=source_pk,
                        record_kind="bson_document",
                        payload=payload,
                    )
                )
                if len(batch) >= args.batch_size:
                    flush_batch(args, pg_conn, batch, stats)
                if args.limit and stats["seen"] + len(batch) >= args.limit:
                    break
        flush_batch(args, pg_conn, batch, stats)
    finally:
        if pg_conn:
            pg_conn.close()

    print_summary("import-mongo-bson", args, stats, started)
    return stats


def http_json(url: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def iter_es_index(es_url: str, index: str, batch_size: int, limit: int) -> Iterator[tuple[str, dict[str, Any]]]:
    base = es_url.rstrip("/")
    body = {"size": batch_size, "sort": ["_doc"]}
    first = http_json(f"{base}/{urllib.parse.quote(index)}/_search?scroll=2m", body)
    scroll_id = first.get("_scroll_id")
    yielded = 0
    try:
        current = first
        while True:
            hits = current.get("hits", {}).get("hits", [])
            if not hits:
                break
            for hit in hits:
                yield str(hit.get("_id")), hit.get("_source", {})
                yielded += 1
                if limit and yielded >= limit:
                    return
            if not scroll_id:
                break
            current = http_json(f"{base}/_search/scroll", {"scroll": "2m", "scroll_id": scroll_id})
            scroll_id = current.get("_scroll_id")
    finally:
        if scroll_id:
            try:
                http_json(f"{base}/_search/scroll", {"scroll_id": [scroll_id]})
            except Exception:
                pass


def import_es(args: argparse.Namespace) -> dict[str, int]:
    ensure_safe_write_target(args)
    stats = {"seen": 0, "inserted": 0}
    pg_conn = connect_pg(args) if args.write else None
    batch: list[SourceRecord] = []
    started = time.time()
    try:
        for index in [i.strip() for i in args.es_indices.split(",") if i.strip()]:
            index_seen_before = stats["seen"]
            for doc_id, payload in iter_es_index(args.es_url, index, args.batch_size, args.limit):
                batch.append(
                    SourceRecord(
                        source_system="legacy_elasticsearch",
                        source_name=index,
                        source_pk=doc_id,
                        record_kind="search_index_doc",
                        payload=payload,
                    )
                )
                if len(batch) >= args.batch_size:
                    flush_batch(args, pg_conn, batch, stats)
            flush_batch(args, pg_conn, batch, stats)
            print(f"es {index}: {stats['seen'] - index_seen_before} records")
    finally:
        if pg_conn:
            pg_conn.close()
    print_summary("import-es", args, stats, started)
    return stats


def check_target(args: argparse.Namespace) -> None:
    with connect_pg(args) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT source_system, source_name, COUNT(*) AS count
                FROM source_records
                GROUP BY source_system, source_name
                ORDER BY source_system, source_name
                """
            )
            rows = cur.fetchall()
    if not rows:
        print("source_records is empty")
        return
    for row in rows:
        print(f"{row['source_system']}\t{row['source_name']}\t{row['count']}")


def print_summary(command: str, args: argparse.Namespace, stats: dict[str, int], started: float) -> None:
    mode = "WRITE" if args.write else "DRY-RUN"
    elapsed = time.time() - started
    print(f"{command} {mode}: seen={stats['seen']} inserted={stats['inserted']} elapsed={elapsed:.2f}s")


def main() -> int:
    args = parse_args()
    if args.command == "init-schema":
        init_schema(args)
    elif args.command == "import-mysql":
        import_mysql(args)
    elif args.command == "import-mongo-bson":
        import_mongo_bson(args)
    elif args.command == "import-es":
        import_es(args)
    elif args.command == "import-all":
        import_mysql(args)
        import_mongo_bson(args)
        import_es(args)
    elif args.command == "check-target":
        check_target(args)
    else:
        raise ValueError(args.command)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
