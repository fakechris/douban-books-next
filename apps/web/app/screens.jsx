/* global React, Icon, Cover, Tag, MarkBadge, MatchPill, PlatformBadges,
          Price, ReadState, PaidPill, RatingCell, Checkbox */

/* =====================================================================
   Tags screen
===================================================================== */
const TAG_GROUPS = [
  { id: "manual",   title: "Manual tags",          desc: "用户创建，自由形式" },
  { id: "imported", title: "Imported / legacy",    desc: "从旧数据库迁移，保留来源" },
  { id: "system",   title: "System tags",          desc: "计算得出，不可直接编辑" },
  { id: "price",    title: "Price tags",           desc: "基于价格桶或人工设定" },
  { id: "workflow", title: "Workflow tags",        desc: "待办状态" },
];

const TagsPage = () => {
  const [activeGroup, setActiveGroup] = React.useState("manual");
  const [tagQuery, setTagQuery] = React.useState("");
  const tags = window.TAG_DEFS
    .filter(t => t.type === activeGroup)
    .filter(t => !tagQuery.trim() || `${t.name} ${t.id} ${t.src || ""}`.toLowerCase().includes(tagQuery.toLowerCase()));
  const [hovered, setHovered] = React.useState(tags[0]?.id);

  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">
          Tags
          <span style={{ fontSize: 11, color: "var(--mid)", padding: "2px 8px", border: "1px solid var(--line)", borderRadius: 999 }}>
            312 标签 · 用于 89,739 本
          </span>
        </div>
        <div className="page__sub">手工 tag · 旧库迁移 tag · 系统 tag · 价格 tag · 工作流 tag — 都是搜索的一等公民</div>
      </div>

      <div className="page__bd" style={{ display: "grid", gridTemplateColumns: "240px 1fr 340px", gap: 18, height: "100%", minHeight: 0, overflow: "hidden" }}>
        {/* group nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TAG_GROUPS.map(g => (
            <button
              key={g.id}
              className="sb__item"
              aria-current={activeGroup === g.id || undefined}
              onClick={() => setActiveGroup(g.id)}
              style={{ padding: "8px 10px", height: "auto", alignItems: "flex-start", flexDirection: "column", gap: 2 }}
            >
              <span style={{ fontWeight: 500 }}>{g.title}</span>
              <span style={{ color: "var(--mid-2)", fontSize: 11 }}>{g.desc}</span>
            </button>
          ))}
          <div style={{ marginTop: 12, padding: "10px 12px", border: "1px dashed var(--line)", borderRadius: 8, fontSize: 11.5, color: "var(--mid)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--mid-2)", marginBottom: 6 }}>批量操作</div>
            将当前搜索转为 tag · 重命名 · 合并 · 删除
          </div>
        </div>

        {/* table */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <div className="tb__search" style={{ flex: 1 }}>
              <span className="tb__search-ic"><Icon n="search" s={13} /></span>
              <input placeholder="过滤标签…" value={tagQuery} onChange={e => setTagQuery(e.target.value)} />
            </div>
            <button className="btn"><Icon n="plus" s={12} /> 新建标签</button>
            <button className="btn"><Icon n="edit" s={12} /> 合并</button>
          </div>
          <div className="tagm-list" style={{ flex: 1, overflow: "auto" }}>
            <div className="tagm-h">
              <div>名称</div>
              <div>类型</div>
              <div>来源</div>
              <div>更新</div>
              <div style={{ textAlign: "right" }}>用量</div>
            </div>
            {tags.map(t => (
              <div
                key={t.id}
                className="tagm-row"
                aria-current={hovered === t.id || undefined}
                onMouseEnter={() => setHovered(t.id)}
              >
                <div className="l">
                  <span className="swatch" style={{ background: `var(--tag-${t.c === "ink" ? "blue" : t.c})`, opacity: t.c === "ink" ? 0.3 : 1 }} />
                  <Tag t={t} sys={t.type !== "manual"} />
                </div>
                <div className="meta">{t.type}</div>
                <div className="meta">{t.src || "user"}</div>
                <div className="meta">2 天前</div>
                <div className="c" style={{ textAlign: "right" }}>{t.count.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* right inspector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto", paddingRight: 4 }}>
          {(() => {
            const t = tags.find(x => x.id === hovered) || tags[0];
            if (!t) return null;
            return (
              <>
                <div className="card">
                  <div className="card__h">
                    <Tag t={t} sys={t.type !== "manual"} />
                    <span style={{ color: "var(--mid)", fontSize: 11 }}>· {t.type}</span>
                    <span className="c">{t.count.toLocaleString()}</span>
                  </div>
                  <div className="card__sub" style={{ marginBottom: 10 }}>
                    {t.type === "manual"   && "用户创建 · 可重命名、合并、删除"}
                    {t.type === "imported" && `从 ${t.src} 迁移 · 保留 provenance`}
                    {t.type === "system"   && "系统计算得出 · 不可直接编辑，可用于保存视图"}
                    {t.type === "price"    && "基于价格桶 · 阈值可在 Tweaks 中配置"}
                    {t.type === "workflow" && "工作流状态 · 用于待办与批量推进"}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn btn--sm"><Icon n="search" s={11} /> 查看含此标签的书</button>
                    {t.type === "manual" && <>
                      <button className="btn btn--sm"><Icon n="edit" s={11} /> 重命名</button>
                      <button className="btn btn--sm"><Icon n="link" s={11} /> 合并到</button>
                      <button className="btn btn--sm"><Icon n="x" s={11} /> 删除</button>
                    </>}
                    {t.type === "system" && <button className="btn btn--sm"><Icon n="save" s={11} /> 转保存视图</button>}
                  </div>
                </div>

                <div className="card">
                  <div className="card__h">最近书目 <span className="c">12</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {window.BOOKS.slice(0, 6).map(b => (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <Cover b={b} w={20} h={28} fontSize={8} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</span>
                        <span className="num" style={{ fontSize: 11, color: "var(--mid)" }}>{b.shelfUpdate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   Purchases & Price screen
===================================================================== */
const PricesPage = ({ setRoute, setActive }) => {
  const watch = window.BOOKS.filter(b => b.marks.includes("watch")).concat(window.BOOKS.filter(b => b.tags.some(t => t.id === "watch"))).slice(0, 8);
  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">
          Purchases &amp; Price
          <span style={{ fontSize: 11, color: "var(--mid-2)", fontWeight: 400 }}>价格关注 · 购买关注 · 跨平台比价</span>
        </div>
        <div className="page__sub">补足 WeRead 原生缺失的价格筛选与历史对比</div>
      </div>

      <div className="page__bd">
        {/* stats */}
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card__h">已购</div>
            <div className="card__big">12,408</div>
            <div className="card__sub">¥ 总投入 <span className="num">487,290</span> · 平均 <span className="num">¥39</span></div>
          </div>
          <div className="card">
            <div className="card__h">会员可读</div>
            <div className="card__big">4,182</div>
            <div className="card__sub">无限卡覆盖 · 含 <span className="num">312</span> 高分书</div>
          </div>
          <div className="card">
            <div className="card__h">价格关注</div>
            <div className="card__big" style={{ color: "var(--warn)" }}>64</div>
            <div className="card__sub">本周 <span className="num">12</span> 本降价 · <span className="num">3</span> 本破历史低价</div>
          </div>
          <div className="card">
            <div className="card__h">购买关注</div>
            <div className="card__big">38</div>
            <div className="card__sub">京东低价可购 <span className="num">14</span> 本 · 比 WeRead 便宜均 <span className="num">¥12</span></div>
          </div>
        </div>

        {/* bucket bar */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card__h">价格分布 <span style={{ color: "var(--mid)", fontSize: 11, fontWeight: 400 }}>· 价格桶阈值可在 Tweaks 调整</span></div>
          <div className="bucket-bar">
            <div style={{ width: "10%" }}>
              <span style={{ color: "var(--ok)" }}>免费 0</span>
              <span className="n">2,041</span>
            </div>
            <div style={{ width: "22%" }}>
              <span style={{ color: "var(--ok)" }}>便宜 0 – 10</span>
              <span className="n">8,321</span>
            </div>
            <div style={{ width: "48%" }}>
              <span>中等 10 – 30</span>
              <span className="n">41,092</span>
            </div>
            <div style={{ width: "20%" }}>
              <span style={{ color: "var(--bad)" }}>贵 &gt; 30</span>
              <span className="n">1,874</span>
            </div>
          </div>
        </div>

        {/* watch list */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card__h" style={{ padding: "12px 14px 8px", margin: 0, borderBottom: "1px solid var(--hairline)" }}>
            <Icon n="eye" s={13} /> 价格关注列表
            <span className="c">64</span>
          </div>
          {watch.map(b => (
            <div key={b.id} className="watch-row" onClick={() => { setActive(b.id); setRoute("shelf"); }}>
              <Cover b={b} w={26} h={36} fontSize={9} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                <div style={{ color: "var(--mid)", fontSize: 11.5 }}>{b.author}{b.translator && ` · 译 ${b.translator}`}</div>
              </div>
              <div className="num" style={{ textAlign: "right" }}>
                <div style={{ color: "var(--ink)" }}>¥{b.price.toFixed(2)}</div>
                <div style={{ fontSize: 10.5, color: "var(--mid-2)" }}>WeRead</div>
              </div>
              <div className="num" style={{ textAlign: "right", color: "var(--ok)" }}>
                <div>¥{(b.price * 0.78).toFixed(2)}</div>
                <div style={{ fontSize: 10.5, color: "var(--mid-2)" }}>JD 最低</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11.5 }}>
                {b.paid
                  ? <span style={{ color: "var(--mid)" }}>已购</span>
                  : <span style={{ color: "var(--warn)" }}>关注中 · 7天</span>}
              </div>
              <button className="row-actions" style={{ opacity: 1 }}><Icon n="more" s={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   Douban Matches review queue
===================================================================== */
const MATCH_QUEUE = [
  { state: "candidate", confidence: 0.78 },
  { state: "candidate", confidence: 0.63 },
  { state: "conflict",  confidence: 0.94 },
  { state: "review",    confidence: 0.55 },
  { state: "missing",   confidence: null },
];

const MatchesPage = () => {
  const queue = window.BOOKS.filter(b => ["candidate","conflict","review","missing"].includes(b.match)).slice(0, 6);
  const [idx, setIdx] = React.useState(0);
  const cur = queue[idx];

  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">
          Douban Matches
          <span style={{ fontSize: 11, color: "var(--warn)", padding: "2px 8px", background: "var(--warn-bg)", borderRadius: 999 }}>
            218 candidate · 132 conflict · 35,493 missing
          </span>
        </div>
        <div className="page__sub">LLM 在第一阶段不可自动确认，只能提供证据与建议</div>
      </div>

      <div className="page__bd" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, height: "100%", minHeight: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
          <div style={{ fontSize: 11, color: "var(--mid-2)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 8px 6px" }}>
            队列 · 6 / 218
          </div>
          {queue.map((b, i) => (
            <button
              key={b.id}
              className="sb__item"
              aria-current={i === idx || undefined}
              onClick={() => setIdx(i)}
              style={{ padding: 8, height: "auto", alignItems: "flex-start" }}
            >
              <Cover b={b} w={28} h={40} fontSize={9} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                <div style={{ color: "var(--mid-2)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.author}</div>
                <div style={{ marginTop: 4, display: "flex", gap: 4, alignItems: "center" }}>
                  <MatchPill s={b.match} />
                  {b.match !== "missing" && <span className="num" style={{ fontSize: 10.5, color: "var(--mid)" }}>· {(MATCH_QUEUE[i % MATCH_QUEUE.length].confidence * 100 || 0).toFixed(0)}%</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {cur && (
          <div style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 }}>
            <div className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Cover b={cur} w={64} h={92} fontSize={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{cur.title}</div>
                {cur.subtitle && <div style={{ color: "var(--mid)", fontSize: 12.5, marginTop: 2 }}>{cur.subtitle}</div>}
                <div style={{ marginTop: 6, color: "var(--ink-2)" }}>{cur.author}{cur.translator && ` · 译 ${cur.translator}`}</div>
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="chip chip--src">weread {cur.weread}</span>
                  {cur.douban && <span className="chip chip--src">douban {cur.douban}</span>}
                  {cur.isbn && <span className="chip chip--src">{cur.isbn}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
                <button className="btn btn--prim"><Icon n="check" s={12} /> 确认匹配</button>
                <button className="btn"><Icon n="x" s={12} /> 拒绝</button>
                <button className="btn"><Icon n="search" s={12} /> 搜候选</button>
                <button className="btn"><Icon n="sparkle" s={12} /> 让 LLM 比较</button>
              </div>
            </div>

            <div className="mc">
              <div className="mc__side">
                <div className="mc__side-h"><span className="dot" style={{ background: "var(--accent)" }} /> WeRead · 当前</div>
                <div className="mc__title">{cur.title}</div>
                <div className="mc__sub">{cur.subtitle}</div>
                <div style={{ marginTop: 10 }}>
                  <div className="mc__line"><span className="k">作者</span><span className="v" data-match="true">{cur.author}</span></div>
                  <div className="mc__line"><span className="k">译者</span><span className="v" data-conflict={cur.conflicts?.includes("translator") || undefined}>{cur.translator || "—"}</span></div>
                  <div className="mc__line"><span className="k">出版</span><span className="v">{cur.publisher}</span></div>
                  <div className="mc__line"><span className="k">ISBN</span><span className="v mono">{cur.isbn || "—"}</span></div>
                  <div className="mc__line"><span className="k">评分</span><span className="v mono">{cur.weReadRating ? (cur.weReadRating / 10).toFixed(1) : "—"}</span></div>
                  <div className="mc__line"><span className="k">封面</span><span className="v">{cur.conflicts?.includes("cover") ? <span style={{ color: "var(--bad)" }}>不一致</span> : "一致"}</span></div>
                </div>
              </div>
              <div className="mc__side">
                <div className="mc__side-h"><span className="dot" style={{ background: "var(--ok)" }} /> Douban · 候选 #1 · <span className="num">{((MATCH_QUEUE[idx % MATCH_QUEUE.length].confidence || 0.78) * 100).toFixed(0)}%</span></div>
                <div className="mc__title">{cur.title}</div>
                <div className="mc__sub">{cur.subtitle}</div>
                <div style={{ marginTop: 10 }}>
                  <div className="mc__line"><span className="k">作者</span><span className="v" data-match="true">{cur.author}</span></div>
                  <div className="mc__line"><span className="k">译者</span><span className="v" data-conflict={cur.conflicts?.includes("translator") || undefined}>{cur.conflicts?.includes("translator") ? "钱学森" : (cur.translator || "—")}</span></div>
                  <div className="mc__line"><span className="k">出版</span><span className="v">{cur.publisher}</span></div>
                  <div className="mc__line"><span className="k">ISBN</span><span className="v mono">{cur.isbn || "—"}</span></div>
                  <div className="mc__line"><span className="k">评分</span><span className="v mono">{cur.doubanRating ? cur.doubanRating.toFixed(1) : "—"} · {(cur.ratingCount || 0).toLocaleString()}</span></div>
                  <div className="mc__line"><span className="k">链接</span><span className="v"><a href="#" style={{ color: "var(--accent)" }}>book.douban.com/subject/{cur.douban || "—"}</a></span></div>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: "var(--accent-2)", borderColor: "var(--accent-3)" }}>
              <div className="card__h" style={{ color: "var(--accent-ink)" }}>
                <Icon n="sparkle" s={12} /> LLM 证据
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mid)" }}>claude-haiku · 0.4s · 21 source_records</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--accent-ink)", lineHeight: 1.6 }}>
                标题与作者精确一致；出版社、ISBN 一致；译者字段冲突（WeRead: <strong>{cur.translator}</strong> / Douban: <strong>钱学森</strong>）。
                豆瓣条目更新更近（2024-02），WeRead 字段最后变更 2020-06。
                <strong>建议</strong>：接受匹配，采纳豆瓣的译者字段；记录原 WeRead 译者到 raw evidence。
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <button className="btn btn--sm" style={{ background: "rgba(255,255,255,0.7)" }}>查看 21 条原始证据</button>
                <button className="btn btn--sm" style={{ background: "rgba(255,255,255,0.7)" }}>仅采纳建议</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =====================================================================
   Collections: booklists, folders, desktop directories, saved views
===================================================================== */
const COLLECTION_TYPE_LABEL = {
  booklist: "微信书单",
  folder: "微信文件夹",
  archive: "归档",
  directory: "桌面目录",
  saved: "保存视图",
  smart: "动态集合",
};

const collectionBooks = (collection) => window.BOOKS.filter(b => {
  const titles = window.collectionTitlesForBook?.(b) || [];
  if (collection.type === "booklist") return titles.includes(collection.title) || (collection.title.includes("AI") && b.tags.some(t => t.id === "ai"));
  if (collection.type === "directory") return titles.includes(collection.title) || b.category?.includes(collection.title.split("/").pop()?.slice(0, 2));
  if (collection.type === "saved") return titles.includes(collection.title);
  if (collection.type === "smart") return b.tags.some(t => t.id === "ai") && b.doubanRating >= 8.5;
  if (collection.type === "folder") return titles.includes(collection.title) || b.readState === "reading";
  if (collection.type === "archive") return b.shelfUpdate?.includes("2020") || b.shelfUpdate?.includes("2021");
  return false;
});

const CollectionsPage = ({ setRoute, setActive }) => {
  const [remoteCollections, setRemoteCollections] = React.useState(window.COLLECTIONS);
  const [type, setType] = React.useState("booklist");
  const [activeId, setActiveId] = React.useState(window.COLLECTIONS.find(c => c.type === "booklist")?.id);
  React.useEffect(() => {
    window.Api.collections().then(data => {
      const rows = (data.collections || []).map(c => ({
        id: c.id, type: c.type, title: c.name, count: c.count || 0,
        src: c.source, updated: c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "—",
      }));
      if (rows.length) {
        setRemoteCollections(rows);
        setActiveId(rows.find(c => c.type === "booklist")?.id || rows[0].id);
      }
    }).catch(console.error);
  }, []);
  const groups = Array.from(new Set(remoteCollections.map(c => c.type)));
  const visible = remoteCollections.filter(c => c.type === type);
  const active = remoteCollections.find(c => c.id === activeId) || visible[0] || remoteCollections[0];
  const books = collectionBooks(active).slice(0, 8);

  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">Collections <span style={{ fontSize: 12, color: "var(--mid-2)", fontWeight: 400 }}>· 书单 / 目录 / 保存视图统一入口</span></div>
        <div className="page__sub">所有组织方式都可以打开成 Shelf 结果列表，并继续搜索、排序、打 tag、加标记。</div>
      </div>
      <div className="page__bd" style={{ display: "grid", gridTemplateColumns: "220px 360px 1fr", gap: 18, minHeight: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {groups.map(g => (
            <button key={g} className="sb__item" aria-current={type === g || undefined} onClick={() => { setType(g); setActiveId(window.COLLECTIONS.find(c => c.type === g)?.id); }}>
              <span className="sb__item-l">{COLLECTION_TYPE_LABEL[g] || g}</span>
              <span className="sb__item-c">{window.COLLECTIONS.filter(c => c.type === g).length}</span>
            </button>
          ))}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card__h"><Icon n="save" s={12} /> 保存视图</div>
            <div className="card__sub">保存搜索词、筛选、排序、列配置、表格/封面模式。动态集合实时更新。</div>
          </div>
        </div>

        <div className="tagm-list" style={{ overflow: "auto" }}>
          {visible.map(c => (
            <button key={c.id} className="collection-row" aria-current={active?.id === c.id || undefined} onClick={() => setActiveId(c.id)}>
              <div style={{ minWidth: 0 }}>
                <div className="t">{c.title}</div>
                <div className="m">{COLLECTION_TYPE_LABEL[c.type]} · {c.src} · {c.updated}</div>
              </div>
              <span className="num">{c.count.toLocaleString()}</span>
            </button>
          ))}
        </div>

        <div style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="card__h">
              {active.title}
              <span className="c">{active.count.toLocaleString()}</span>
            </div>
            <div className="card__sub">{COLLECTION_TYPE_LABEL[active.type]} · source: {active.src} · updated: {active.updated}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn btn--prim" onClick={() => setRoute("shelf")}><Icon n="rows" s={12} /> 作为 Shelf 打开</button>
              <button className="btn"><Icon n="tag" s={12} /> 批量打 tag</button>
              <button className="btn"><Icon n="sparkle" s={12} /> 问这个集合</button>
              <button className="btn"><Icon n="save" s={12} /> 保存副本</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card__h" style={{ padding: "12px 14px", margin: 0, borderBottom: "1px solid var(--hairline)" }}>集合内书目预览</div>
            {books.map(b => (
              <div key={b.id} className="watch-row" onClick={() => { setActive(b.id); setRoute("shelf"); }}>
                <Cover b={b} w={26} h={36} fontSize={9} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                  <div style={{ color: "var(--mid)", fontSize: 11.5 }}>{b.author} · {b.category}</div>
                </div>
                <div><Price b={b} /></div>
                <MatchPill s={b.match} />
                <PlatformBadges p={b.platforms} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   Platforms
===================================================================== */
const PlatformsPage = ({ setRoute, setActive }) => {
  const [rows, setRows] = React.useState(window.BOOKS.filter(b => b.platforms?.j || b.platforms?.z || b.douban).slice(0, 12));
  React.useEffect(() => {
    window.Api.shelf({ limit: 100, platform: "douban", sort: "price", direction: "desc" })
      .then(data => setRows(data.items.slice(0, 12)))
      .catch(console.error);
  }, []);
  const stats = [
    ["WeRead", 89739, "主书架与购买状态"],
    ["Douban", 41802, "评分、出版、标签、跳转"],
    ["JD Read", 13240, "价格与可购状态"],
    ["Zhangyue", 8291, "备选平台数据"],
  ];
  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">Platforms <span style={{ fontSize: 12, color: "var(--mid-2)", fontWeight: 400 }}>· WeRead / Douban / JD / Zhangyue</span></div>
        <div className="page__sub">跨平台展示用于比价、补全元数据、解释匹配证据。</div>
      </div>
      <div className="page__bd">
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {stats.map(([name, count, desc]) => (
            <div className="card" key={name}>
              <div className="card__h">{name}</div>
              <div className="card__big">{count.toLocaleString()}</div>
              <div className="card__sub">{desc}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="platform-h">
            <div>书目</div><div>WeRead</div><div>Douban</div><div>JD Read</div><div>Zhangyue</div><div>动作</div>
          </div>
          {rows.map(b => (
            <div key={b.id} className="platform-row">
              <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
                <Cover b={b} w={26} h={36} fontSize={9} />
                <div style={{ minWidth: 0 }}>
                  <div className="t">{b.title}</div>
                  <div className="m">{b.author} · {b.category}</div>
                </div>
              </div>
              <div><span className="num">¥{b.price.toFixed(2)}</span><br/><span className="m">{b.paid ? "已购" : "未购"}</span></div>
              <div>{b.douban ? <><span className="num">{b.doubanRating.toFixed(1)}</span><br/><span className="m">{b.douban}</span></> : <span className="m">未匹配</span>}</div>
              <div>{b.platforms.j ? <><span className="num" style={{ color: "var(--ok)" }}>¥{(b.price * 0.85).toFixed(2)}</span><br/><span className="m">可购</span></> : <span className="m">—</span>}</div>
              <div>{b.platforms.z ? <><span className="num">¥{(b.price * 0.92).toFixed(2)}</span><br/><span className="m">可购</span></> : <span className="m">—</span>}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn--sm" onClick={() => { setActive(b.id); setRoute("shelf"); }}>详情</button>
                <button className="btn btn--sm"><Icon n="link" s={11} /> 跳转</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   Notes
===================================================================== */
const NotesPage = ({ setRoute, setActive }) => {
  const [rows, setRows] = React.useState([]);
  React.useEffect(() => {
    window.Api.notes().then(data => setRows(data.notes || [])).catch(console.error);
  }, []);
  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">Notes <span style={{ fontSize: 12, color: "var(--mid-2)", fontWeight: 400 }}>· 笔记 / 划线 / 笔记驱动搜索</span></div>
        <div className="page__sub">从 notebook books、划线、评论摘要中反向找到值得重读或补 metadata 的书。</div>
      </div>
      <div className="page__bd" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, overflow: "hidden" }}>
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          {(rows.length ? rows : window.BOOKS.slice(0, 8).map(b => ({ weread_book_id: b.id, title: b.title, author_text: b.author, mark_text: "暂无真实笔记，展示书目占位", note_type: "placeholder" }))).map((n, i) => {
            const b = { id: n.weread_book_id, title: n.title, author: n.author_text, cover: i % 8, match: "missing" };
            return (
            <div key={n.id || n.weread_book_id || i} className="note-row" onClick={() => { setActive(n.weread_book_id); setRoute("shelf"); }}>
              <Cover b={b} w={28} h={40} fontSize={9} />
              <div style={{ minWidth: 0 }}>
                <div className="t">{n.title}</div>
                <div className="quote">“{n.mark_text || n.note_text || n.review_text || "暂无文本"}”</div>
                <div className="m">{n.author_text || "—"} · {n.note_type} · {n.chapter_title || "未分章"}</div>
              </div>
              <MatchPill s="missing" />
            </div>
          );})}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="card__h"><Icon n="search" s={12} /> 笔记搜索</div>
            <div className="card__sub">搜索笔记文本、书名、tag、书单名。结果可回到 Shelf 继续筛选。</div>
            <div className="tb__search" style={{ marginTop: 10 }}>
              <span className="tb__search-ic"><Icon n="search" s={13} /></span>
              <input placeholder="搜索划线、笔记、评论…" />
            </div>
          </div>
          <div className="card">
            <div className="card__h"><Icon n="sparkle" s={12} /> LLM 用法</div>
            <div className="card__sub">总结一个 tag/书单里的笔记主题；把笔记关键词转成筛选条件；给一批书生成重读理由。</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   Data Quality
===================================================================== */
const DataQualityPage = ({ setRoute, setActive }) => {
  const [remoteIssues, setRemoteIssues] = React.useState([]);
  React.useEffect(() => {
    window.Api.quality(50).then(data => setRemoteIssues(data.items || [])).catch(console.error);
  }, []);
  const issues = (remoteIssues.length ? remoteIssues : window.BOOKS
    .filter(b => ["missing", "conflict", "candidate", "review"].includes(b.match) || (b.conflicts || []).length || b.words === 0 || b.weReadRating === 0)
    .slice(0, 12));
  const issueLabel = (b) => {
    if (b.match === "missing") return "豆瓣缺失";
    if (b.match === "conflict") return "匹配冲突";
    if ((b.conflicts || []).includes("translator")) return "译者冲突";
    if ((b.conflicts || []).includes("cover")) return "封面冲突";
    if (b.words === 0) return "字数缺失";
    return "待审核";
  };
  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">Data Quality <span style={{ fontSize: 12, color: "var(--mid-2)", fontWeight: 400 }}>· 缺失 / 冲突 / 候选 / 过期</span></div>
        <div className="page__sub">把数据问题变成可筛选、可分派、可由 LLM 解释但需人工确认的工作队列。</div>
      </div>
      <div className="page__bd">
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="card"><div className="card__h">匹配缺失</div><div className="card__big" style={{ color: "var(--bad)" }}>35,493</div><div className="card__sub">需要候选检索或跳过</div></div>
          <div className="card"><div className="card__h">字段冲突</div><div className="card__big" style={{ color: "var(--warn)" }}>132</div><div className="card__sub">作者、译者、封面、出版</div></div>
          <div className="card"><div className="card__h">缺元数据</div><div className="card__big">481</div><div className="card__sub">封面、字数、价格、评分</div></div>
          <div className="card"><div className="card__h">可自动补全</div><div className="card__big" style={{ color: "var(--ok)" }}>219</div><div className="card__sub">先保存 source_records</div></div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {issues.map(b => (
            <div key={b.id} className="quality-row" onClick={() => { setActive(b.id); setRoute("shelf"); }}>
              <Cover b={b} w={28} h={40} fontSize={9} />
              <div style={{ minWidth: 0 }}>
                <div className="t">{b.title}</div>
                <div className="m">{b.author} · {b.publisher || "出版社缺失"} · {b.category}</div>
              </div>
              <span className="pill" style={{ color: "var(--bad)", background: "var(--bad-bg)", borderColor: "transparent" }}>{issueLabel(b)}</span>
              <MatchPill s={b.match} />
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn--sm"><Icon n="sparkle" s={11} /> 解释</button>
                <button className="btn btn--sm"><Icon n="wand" s={11} /> 补全</button>
                <button className="btn btn--sm"><Icon n="check" s={11} /> 跳过</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   Sync Runs
===================================================================== */
const SyncRunsPage = () => {
  const [remoteRuns, setRemoteRuns] = React.useState([]);
  React.useEffect(() => {
    window.Api.syncRuns().then(data => setRemoteRuns(data.runs || [])).catch(console.error);
  }, []);
  const fallbackRuns = [
    { name: "weread_mobile / shelf/syncbook", status: "ok", count: "90 batches", raw: "source_records +91", time: "今天 09:42", note: "auth redacted · projected" },
    { name: "weread_mobile / shelf/sync-onlyBookid", status: "ok", count: "90,231 ids", raw: "source_records +1", time: "今天 09:21", note: "archive membership" },
    { name: "weread_web / notebook", status: "ok", count: "1,643 books", raw: "source_records +1", time: "昨天 23:12", note: "notes available" },
    { name: "weread_web / shelf/sync", status: "warn", count: "timeout", raw: "source_records +1", time: "昨天 22:58", note: "upstream 3s timeout" },
    { name: "legacy_mysql / purchase", status: "ok", count: "12,408 rows", raw: "source_records", time: "迁移阶段", note: "read-only import" },
  ];
  const runs = remoteRuns.length ? remoteRuns.map(r => ({
    name: `${r.source_system} / ${r.source_name}`,
    status: "ok",
    count: `${r.count} records`,
    raw: "source_records",
    time: r.latest_imported_at ? new Date(r.latest_imported_at).toLocaleString() : "—",
    note: r.latest_fetched_at ? `fetched ${new Date(r.latest_fetched_at).toLocaleString()}` : "imported",
  })) : fallbackRuns;
  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">Sync Runs <span style={{ fontSize: 12, color: "var(--mid-2)", fontWeight: 400 }}>· raw first, projection second</span></div>
        <div className="page__sub">同步和补全都必须先保存原始响应，再投影到 UI read model。</div>
      </div>
      <div className="page__bd" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, overflow: "hidden" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {runs.map(r => (
            <div key={r.name} className="sync-row">
              <span className="sync-dot" data-status={r.status} />
              <div>
                <div className="t">{r.name}</div>
                <div className="m">{r.note}</div>
              </div>
              <div className="num">{r.count}</div>
              <div>{r.raw}</div>
              <div className="m">{r.time}</div>
              <button className="btn btn--sm">证据</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="card__h"><Icon n="sync" s={12} /> 手动同步</div>
            <div className="card__sub">触发 WeRead mobile `skey` 路径、Skill 补全或仅投影已有 raw payload。</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              <button className="btn btn--prim"><Icon n="sync" s={12} /> 同步当前书架</button>
              <button className="btn"><Icon n="wand" s={12} /> 只补选中书详情</button>
              <button className="btn"><Icon n="rows" s={12} /> 重跑 projection</button>
            </div>
          </div>
          <div className="card">
            <div className="card__h"><Icon n="warn" s={12} /> 安全约束</div>
            <div className="card__sub">request metadata 中 skey/cookie/vid 必须脱敏；raw payload 保留，业务表只保存投影结果。</div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  TagsPage, PricesPage, MatchesPage,
  CollectionsPage, PlatformsPage, NotesPage, DataQualityPage, SyncRunsPage,
});
