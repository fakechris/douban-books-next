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
  const tags = window.TAG_DEFS.filter(t => t.type === activeGroup);
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
              <input placeholder="过滤标签…" />
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

Object.assign(window, { TagsPage, PricesPage, MatchesPage });
