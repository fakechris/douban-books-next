# Safe Migration Runbook

这份 runbook 用于把旧的 MySQL / MongoDB BSON / Elasticsearch 数据持续迁移到新的 PostgreSQL 目标库。核心原则是：旧数据源只读，目标库可重复导入，先保存原始数据，再做业务投影。

## Safety Invariants

- 不直接修改旧 MySQL、旧 MongoDB、旧 Elasticsearch。
- MySQL 导入使用 `START TRANSACTION READ ONLY`，只读取旧表。
- MongoDB 第一阶段只读 `backup/mongo.out/local/book.bson`，不启动或写入旧 Mongo 数据目录。
- Elasticsearch 只通过 `_search` / scroll 读取；它是派生索引，不作为最终可信源。
- `tools/migrate_legacy_sources.py` 默认 dry-run；只有显式传 `--write` 才会写 PostgreSQL。
- 写入只进入 PostgreSQL `source_records`，不直接改 `books`、`editions`、`weread_items`、`book_matches` 等业务表。
- 写入 PostgreSQL 时必须指定专用目标库 DSN。脚本默认拒绝写入 `dbname=postgres`，除非显式加 `--allow-default-pg-dsn`。

## Current Count Baseline

这些数字来自当前本地审计，用来做迁移校验。

| Source | Object | Expected count |
| --- | --- | ---: |
| MySQL | `douban.weixin` | 173,515 |
| MySQL | `douban.books` | 154,062 |
| MySQL | `douban.weixin_douban` | 19,117 |
| MySQL | `douban.weixin_booklist` | 726 |
| MySQL | `douban.weixin_booklist_book` | 56,647 |
| MySQL | `douban.weixin_pay_history` | 25,032 |
| MySQL | `douban.weixin_user` | 63 |
| MySQL | `douban.douban_props` | 323,708 |
| Mongo BSON | `local.book` | 490,229 |
| Elasticsearch | `douban` | 904,763 |
| Elasticsearch | `weixin` | 71,511 |

## Preflight Audit

先跑一次只读审计，确认当前旧数据源状态。

```bash
python3 tools/audit_legacy_data.py
```

审计报告默认写到：

```text
/private/tmp/legacy-data-audit/legacy_data_audit.md
/private/tmp/legacy-data-audit/legacy_data_audit.json
```

如果 MySQL socket、Elasticsearch 本地端口被沙箱拦截，需要按 Codex 提示允许本机只读连接。

## Create Target Database

使用一个新的 PostgreSQL 数据库，不要直接用默认 `postgres` 库。

```bash
createdb weread_douban_migration
export PG_DSN="dbname=weread_douban_migration"
```

如果需要远端或 Docker PostgreSQL，改成对应 DSN，例如：

```bash
export PG_DSN="postgresql://user:password@127.0.0.1:5432/weread_douban_migration"
```

## Validate Schema Without Applying

先用事务回滚验证 schema 可执行。

```bash
psql "$PG_DSN" -v ON_ERROR_STOP=1 -c BEGIN -f docs/legacy-migration/postgres_target_schema.sql -c ROLLBACK
```

确认后再初始化目标库。

```bash
python3 tools/migrate_legacy_sources.py init-schema --write
```

## Dry-Run Imports

小样本 dry-run 应该先全部通过。

```bash
python3 tools/migrate_legacy_sources.py import-mongo-bson --limit 5
python3 tools/migrate_legacy_sources.py import-mysql --mysql-tables weixin,weixin_douban --limit 5
python3 tools/migrate_legacy_sources.py import-es --es-indices weixin --limit 5
```

这些命令不写目标库，只验证读取和序列化路径。

## Write Source Records

按可信度和价值分批写入 `source_records`。每批可以重复执行，`source_records_idempotency_idx` 会阻止同一来源、同一主键、同一 payload hash 的重复记录。

先迁移最高价值旧源：

```bash
python3 tools/migrate_legacy_sources.py import-mysql \
  --mysql-tables weixin,weixin_douban,weixin_booklist,weixin_booklist_book,weixin_pay_history,weixin_user \
  --write

python3 tools/migrate_legacy_sources.py import-mongo-bson --write
```

再迁移补充源：

```bash
python3 tools/migrate_legacy_sources.py import-mysql \
  --mysql-tables weixin_copyright,author,meta_book,weixin_meta_book,books,douban_props,jdbook,zybook \
  --write
```

Elasticsearch 是派生数据。只有在需要补齐缺失 ID 或保留旧搜索索引样本时再写入：

```bash
python3 tools/migrate_legacy_sources.py import-es --es-indices douban,weixin --write
```

## Check Target Counts

每批结束后检查目标库中各来源记录数。

```bash
python3 tools/migrate_legacy_sources.py check-target
```

关键校验：

- `legacy_mysql douban.weixin` 应接近 173,515。
- `legacy_mysql douban.weixin_douban` 应接近 19,117。
- `legacy_mongo local.book` 应为 490,229。
- Elasticsearch 如果写入，`legacy_elasticsearch douban` 应接近 904,763，`weixin` 应接近 71,511。

## Continue Safely

持续迁移时遵守这个顺序：

1. 先把新来源写入 `source_records`。
2. 再写投影脚本，把 `source_records` 投影到业务表。
3. 投影脚本必须可重复执行，并且保留 `primary_source_record_id` 或证据字段。
4. 人工确认过的 `book_matches` 只能由显式审核或高置信规则更新，模型比较结果先进入 `match_candidates`。
5. 微信读书 skill 的新同步也按同样模式：API 原始响应先入 `source_records`，再更新 `weread_items`、进度、笔记、书架。
6. 登录态、API 原始响应和探测日志必须写到项目内 `runtime/`，不要写 `/tmp` 或 `/private/tmp`。`runtime/` 已被 `.gitignore` 忽略，用于保存本地登录态和可重复排查的 raw JSON。

## Current WeRead Web Sync

当前可用的 Web Cookie 路径：

```bash
node tools/open_weread_web_login.js
/opt/homebrew/Caskroom/miniconda/base/bin/python tools/sync_weread_web_cookie.py save-api --api both
```

当前结论：

- `https://weread.qq.com/api/user/notebook` 可以通过 Web Cookie 调通，并已保存 1,643 本 notebook books 的原始响应。
- `https://weread.qq.com/web/shelf/sync?synckey=0` 可以鉴权，但用户的大书架会触发服务端 `timeout of 3000ms exceeded`。本地客户端超时已设为 600 秒，接口仍约 3.17 秒返回，因此这是上游服务端内部 3000ms 限制，不是本地请求提前断开。
- 旧移动端 `https://i.weread.qq.com/shelf/sync` 使用 Web Cookie 返回 `errcode=-2012`，不是当前路径。
- 所有这些响应先保存到 `source_records`，后续再决定是否投影 notebook 元数据或寻找 shelf 的分页/替代接口。

当前可用的移动端 `skey` 路径：

```bash
WEREAD_SKEY=<skey> WEREAD_VID=<vid> ./scripts/sync_mobile_skey.sh
```

这个路径已经确认能同步大书架：`i.weread.qq.com/shelf/sync?synckey=0&lectureSynckey=0` 返回 HTTP 200，约 1.7 MB，包含 `bookProgress`、`albums`、`archive` 和 `mp`。`skey` 与 Cookie 不写入文档或入库 request metadata；响应 payload 完整保存。

## Project Normalized Tables

raw `source_records` 完成后，再投影业务表。投影脚本只读取 PostgreSQL，不再连接旧 MySQL/Mongo/ES。

```bash
python3 tools/project_source_records.py project-weread --write
python3 tools/project_source_records.py project-booklists --write
python3 tools/project_source_records.py project-purchases --write
python3 tools/project_source_records.py project-douban --write
python3 tools/project_source_records.py project-douban-sql --write
python3 tools/project_source_records.py project-douban-contributors-tags --write
python3 tools/project_source_records.py project-douban-props --write
python3 tools/project_source_records.py project-matches --write
python3 tools/project_source_records.py check-projections
```

`project-douban` 先投影 Mongo 豆瓣核心书目、edition 和 external IDs。`project-douban-contributors-tags` 再批量投影作者、译者和标签；这个步骤会写入大量关联记录，运行时间较长是正常的。
`project-douban-props` 使用 MySQL `douban_props` 保守回填空字段，不覆盖 Mongo 已有字段。

## Live MongoDB Note

当前本机 `mongod` 是 8.0.5，无法打开现有 FCV 6.0 数据目录副本。不要直接启动旧 `/opt/homebrew/var/mongodb`。如果需要检查 live Mongo 集合，先复制数据目录，再用兼容的 MongoDB 6/7 二进制打开副本。
