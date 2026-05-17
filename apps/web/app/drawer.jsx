/* global React, Icon, Cover, Tag, MarkBadge, MatchPill, PlatformBadges, Price */

const DrSection = ({ title, more, children }) => (
  <div className="dr__sec">
    <div className="dr__sec-h">
      {title}
      {more && <span className="more">{more}</span>}
    </div>
    {children}
  </div>
);

const Drawer = ({ book, onClose }) => {
  if (!book) {
    return (
      <aside className="dr">
        <div className="empty">
          选中一本书查看详情
        </div>
      </aside>
    );
  }
  const b = book;
  const compareConflict = (k) => (b.conflicts || []).includes(k);

  // mock douban side for comparison
  const douban = {
    title:      b.title,
    author:     b.author,
    translator: compareConflict("translator") ? "（豆瓣记录：钱学森）" : b.translator,
    publisher:  b.publisher,
    cover:      compareConflict("cover")      ? "封面不一致" : "一致",
  };

  return (
    <aside className="dr">
      <div className="dr__hd">
        <div className="dr__hd-row">
          <span className="chip chip--src">{b.id.startsWith("album:") ? "audiobook" : "ebook"}</span>
          <MatchPill s={b.match} />
          <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button className="btn"><Icon n="link" s={12} /> 打开</button>
            <button className="btn btn--ghost" onClick={onClose} title="关闭"><Icon n="close" s={13} /></button>
          </span>
        </div>
        <div className="dr__top">
          <Cover b={b} w={76} h={108} fontSize={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dr__title">{b.title}</div>
            {b.subtitle && <div className="dr__subtitle">{b.subtitle}</div>}
            <div className="dr__byline">
              {b.author}
              {b.translator && <span className="trans"> · 译 {b.translator}</span>}
            </div>
            <div className="dr__ids">
              <span className="chip chip--src">weread {b.weread}</span>
              {b.douban && <span className="chip chip--src">douban {b.douban}</span>}
              {b.isbn && <span className="chip chip--src">{b.isbn}</span>}
            </div>
          </div>
        </div>
        <div className="dr__hd-row" style={{ flexWrap: "wrap", gap: 6 }}>
          <button className="btn btn--sm"><Icon n="tag" s={11} /> 标签</button>
          <button className="btn btn--sm"><Icon n="flag" s={11} /> 标记</button>
          <button className="btn btn--sm"><Icon n="folder" s={11} /> 集合</button>
          <button className="btn btn--sm"><Icon n="check" s={11} /> 确认匹配</button>
          <button className="btn btn--sm"><Icon n="wand" s={11} /> 补全</button>
          <button className="btn btn--sm"><Icon n="sparkle" s={11} /> 问 LLM</button>
        </div>
      </div>

      <div className="dr__bd">

        <DrSection title="Tags & Marks" more="编辑">
          <div className="tags-cell" style={{ flexWrap: "wrap", gap: 4 }}>
            {b.tags.map(t => <Tag key={t.id} t={t} sys={t.type !== "manual"} />)}
          </div>
          {b.marks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {b.marks.map(m => (
                <span key={m} className="pill" style={{
                  background: m === "watch" ? "var(--warn-bg)" : m === "bad" ? "var(--bad-bg)" : "var(--accent-2)",
                  color:      m === "watch" ? "var(--warn)"    : m === "bad" ? "var(--bad)"    : "var(--accent-ink)",
                  borderColor: "transparent",
                }}>
                  <MarkBadge k={m} />
                  {m === "watch" ? "价格关注" : m === "bad" ? "数据质量" : m === "priority" ? "优先阅读" : m}
                </span>
              ))}
            </div>
          )}
        </DrSection>

        <DrSection title="WeRead facts">
          <dl className="dr__kv">
            <dt>价格</dt>     <dd style={{ display: "flex", alignItems: "center", gap: 8 }}><Price b={b} /><PaidPillBadge b={b} /></dd>
            <dt>阅读进度</dt> <dd>{b.readState === "finished" ? "已读完" : b.readState === "reading" ? `${b.progress}%` : "未读"}</dd>
            <dt>类别</dt>     <dd>{b.category}</dd>
            <dt>字数</dt>     <dd className="mono">{b.words ? b.words.toLocaleString() : "—"}</dd>
            <dt>更新</dt>     <dd className="mono">书架 {b.shelfUpdate} · 阅读 {b.readUpdate}</dd>
            <dt>源链接</dt>   <dd><a href="#" style={{ color: "var(--accent)" }}>weread://{b.weread}</a></dd>
          </dl>
        </DrSection>

        <DrSection title="WeRead × Douban">
          <div className="dr__compare">
            <div>
              <div className="dr__compare__h"><span className="dot" style={{ background: "var(--accent)" }} /> WeRead</div>
              <div className="dr__compare__v">{b.title}</div>
              <div className="dr__compare__v" style={{ marginTop: 2 }}>{b.author}{b.translator && ` · 译 ${b.translator}`}</div>
              <div className="dr__compare__v" style={{ marginTop: 2, color: "var(--mid)" }}>{b.publisher}</div>
              <div className="dr__compare__v" style={{ marginTop: 6 }}>
                评分 <span className="mono">{b.weReadRating ? (b.weReadRating/10).toFixed(1) : "—"}</span>
              </div>
            </div>
            <div>
              <div className="dr__compare__h"><span className="dot" style={{ background: "var(--ok)" }} /> Douban {b.douban && <span className="mono" style={{ color: "var(--mid-2)" }}>· {b.douban}</span>}</div>
              <div className="dr__compare__v">{douban.title}</div>
              <div className="dr__compare__v" data-conflict={compareConflict("translator") || undefined} style={{ marginTop: 2 }}>
                {douban.author}{douban.translator && ` · 译 ${douban.translator}`}
              </div>
              <div className="dr__compare__v" style={{ marginTop: 2, color: "var(--mid)" }}>{douban.publisher}</div>
              <div className="dr__compare__v" style={{ marginTop: 6 }}>
                评分 <span className="mono">{b.doubanRating ? b.doubanRating.toFixed(1) : "—"}</span>
                <span style={{ color: "var(--mid-2)", marginLeft: 4 }}>({(b.ratingCount || 0).toLocaleString()})</span>
              </div>
            </div>
          </div>
          {b.conflicts && b.conflicts.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--bad)", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon n="warn" s={12} />
              字段冲突：{b.conflicts.join(" · ")}
              <button className="btn btn--sm" style={{ marginLeft: "auto" }}><Icon n="sparkle" s={11} /> 让 LLM 解释证据</button>
            </div>
          )}
        </DrSection>

        <DrSection title="跨平台">
          <div>
            <div className="dr__platrow">
              <span className="name">WeRead</span>
              <span className="id">{b.weread}</span>
              <span className="price">{b.bucket === "free" ? "免费" : `¥${b.price.toFixed(2)}`}</span>
              <span className="state"><PaidPillBadge b={b} /></span>
            </div>
            <div className="dr__platrow">
              <span className="name">Douban</span>
              <span className="id">{b.douban || "—"}</span>
              <span className="price">—</span>
              <span className="state">{b.douban ? <span style={{ color: "var(--ok)" }}>已匹配</span> : <span style={{ color: "var(--mid-2)" }}>未匹配</span>}</span>
            </div>
            <div className="dr__platrow">
              <span className="name">JD Read</span>
              <span className="id">{b.platforms.j ? "JD-" + b.weread.slice(-7) : "—"}</span>
              <span className="price">{b.platforms.j ? `¥${(b.price * 0.85).toFixed(2)}` : "—"}</span>
              <span className="state">{b.platforms.j ? <span style={{ color: "var(--ok)" }}>可购</span> : <span style={{ color: "var(--mid-2)" }}>—</span>}</span>
            </div>
            <div className="dr__platrow">
              <span className="name">Zhangyue</span>
              <span className="id">{b.platforms.z ? "ZY-" + b.weread.slice(-8) : "—"}</span>
              <span className="price">{b.platforms.z ? `¥${(b.price * 0.92).toFixed(2)}` : "—"}</span>
              <span className="state">{b.platforms.z ? <span style={{ color: "var(--ok)" }}>可购</span> : <span style={{ color: "var(--mid-2)" }}>—</span>}</span>
            </div>
          </div>
        </DrSection>

        <DrSection title="集合归属">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <span className="chip"><Icon n="stack" s={10} /> 必读清单</span>
            <span className="chip"><Icon n="folder" s={10} /> /Books/中文/历史</span>
            <span className="chip"><Icon n="bookm" s={10} /> 床头柜</span>
            <span className="chip"><Icon n="save" s={10} /> 便宜已购待读</span>
          </div>
        </DrSection>

        {(b.match === "missing" || b.match === "conflict" || (b.conflicts && b.conflicts.length > 0)) && (
          <DrSection title="数据质量">
            <ul style={{ margin: 0, paddingLeft: 16, color: "var(--mid)", fontSize: 12, lineHeight: 1.7 }}>
              {b.match === "missing" && <li><span style={{ color: "var(--bad)" }}>豆瓣匹配缺失</span> · 候选 3 条</li>}
              {b.match === "conflict" && <li><span style={{ color: "var(--bad)" }}>匹配冲突</span> · 评分相差 ≥ 0.5</li>}
              {b.conflicts?.includes("cover") && <li>封面与豆瓣不一致</li>}
              {b.conflicts?.includes("translator") && <li>译者字段冲突</li>}
              {b.conflicts?.includes("author") && <li>作者字段冲突</li>}
              {b.weReadRating === 0 && b.doubanRating === 0 && <li>评分数据缺失</li>}
              {b.words === 0 && <li>字数 / 篇幅缺失</li>}
            </ul>
          </DrSection>
        )}

        <DrSection title="原始证据">
          <div className="dr__evi">
            <div><span className="k">source_records:</span> <span className="v">{b.weread}.shelf-syncbook</span> · 2025-05-12 14:02</div>
            <div><span className="k">source_records:</span> <span className="v">{b.weread}.book-detail</span> · 2025-05-12 14:02</div>
            {b.douban && <div><span className="k">douban.subject:</span> <span className="v">{b.douban}</span> · imported 2021-08-19</div>}
            <div style={{ marginTop: 4 }}><span className="k">projected:</span> <span className="v">weread_items · {b.shelfUpdate}</span></div>
          </div>
        </DrSection>

        {b.match !== "confirmed" && (
          <DrSection title="LLM 建议">
            <div className="dr__llm">
              <div className="dr__llm__h"><Icon n="sparkle" s={11} /> claude-haiku · {b.match === "missing" ? "候选检索" : "证据比较"} · 待用户确认</div>
              <div>
                {b.match === "missing"
                  ? <>在豆瓣检索到 <strong>3</strong> 条候选，最佳匹配置信度 <span className="mono">0.78</span>：标题精确、作者一致、出版社相同；缺 ISBN 互证。</>
                  : <>WeRead 与豆瓣译者字段冲突：WeRead 显示 <strong>{b.translator}</strong>，豆瓣显示 <strong>{douban.translator}</strong>。豆瓣源更新更近，建议采纳豆瓣。</>}
              </div>
              <div className="dr__llm__act">
                <button className="btn btn--sm">查看候选</button>
                <button className="btn btn--sm">看证据</button>
                <button className="btn btn--sm">忽略</button>
              </div>
            </div>
          </DrSection>
        )}

      </div>
    </aside>
  );
};

// re-export PaidPill under a unique name to avoid naming collision
const PaidPillBadge = (props) => window.PaidPill(props);

Object.assign(window, { Drawer });
