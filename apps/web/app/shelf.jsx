/* global React, Icon, Cover, Tag, MarkBadge, MatchPill, PlatformBadges,
          Price, ReadState, PaidPill, RatingCell, Checkbox */

/* ----- Saved view tabs ------------------------------------------------- */
const SavedViewTabs = ({ views, active, onSelect }) => (
  <div className="svtabs">
    {views.map(v => (
      <button
        key={v.id}
        className="svtab"
        aria-current={active === v.id || undefined}
        onClick={() => onSelect(v.id)}
      >
        <span>{v.title}</span>
        <span className="svtab__count">{v.count.toLocaleString()}</span>
      </button>
    ))}
    <button className="svtab svtab--new" title="保存当前查询为视图">
      <Icon n="plus" s={11} /> 新建视图
    </button>
  </div>
);

/* ----- Filter row ------------------------------------------------------ */
const FILTER_DEFS = [
  { id: "paid",   k: "已购",     v: "true" },
  { id: "price",  k: "价格",     v: "≤ ¥30" },
  { id: "state",  k: "阅读",     v: "未完成" },
  { id: "match",  k: "豆瓣匹配", v: "已确认" },
  { id: "tag",    k: "tag",      v: "AI" },
  { id: "watch",  k: "标记",     v: "价格/购买关注" },
  { id: "quality",k: "质量",     v: "缺失/冲突" },
  { id: "platform",k:"平台",     v: "京东/掌阅可用" },
];

const VIEW_FILTERS = {
  "v-all":      [],
  "v-now":      ["state"],
  "v-cheap":    ["paid", "price", "state"],
  "v-watch":    ["watch"],
  "v-q":        ["quality"],
  "v-ai":       ["tag"],
};

const filterBooksByIds = (books, ids) => books.filter(b => {
  const checks = {
    paid:     b.paid === true,
    price:    b.price <= 30,
    state:    b.readState !== "finished",
    match:    b.match === "confirmed" || b.match === "imported",
    tag:      (b.tags || []).some(t => t.id === "ai" || t.name === "AI"),
    watch:    (b.marks || []).includes("watch") || (b.tags || []).some(t => t.id === "watch" || t.id === "wantbuy"),
    quality:  ["missing", "conflict", "candidate", "review"].includes(b.match) || (b.conflicts || []).length > 0 || b.words === 0 || b.weReadRating === 0,
    platform: b.platforms?.j || b.platforms?.z,
  };
  return ids.every(id => checks[id]);
});

const FilterRow = ({ activeFilters, toggleFilter }) => (
  <div className="fr">
    <span style={{ color: "var(--mid)", fontSize: 11.5, marginRight: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon n="filter" s={12} /> Filters
    </span>
    {FILTER_DEFS.map(f => {
      const active = activeFilters.includes(f.id);
      return (
      <button
        key={f.id}
        className={"fr__chip" + (active ? " fr__chip--active" : "")}
        onClick={() => toggleFilter(f.id)}
      >
        <span className="fr__chip-k">{f.k}</span>
        <span className="fr__chip-v">{f.v}</span>
        {active && <span className="fr__chip-x"><Icon n="close" s={10} /></span>}
      </button>
    );})}
    <button className="fr__add" onClick={() => toggleFilter("quality")}>
      <Icon n="plus" s={11} /> 添加筛选
    </button>
    <span className="fr__sep" />
    <button className="fr__chip" title="排序">
      <Icon n="sort" s={12} />
      <span className="fr__chip-k">排序</span>
      <span className="fr__chip-v">豆瓣评分 ↓</span>
    </button>
    <button className="fr__chip" title="分组">
      <span className="fr__chip-k">分组</span>
      <span className="fr__chip-v">无</span>
    </button>
  </div>
);

/* ----- Operation toolbar ---------------------------------------------- */
const OperationToolbar = ({ selected, selectedIds, totalShown, total, layout, setLayout, onClear, onAction, onChanged }) => (
  <div className="op">
    <span className="op__count">
      <strong>{totalShown.toLocaleString()}</strong> <span style={{ color: "var(--mid)", fontWeight: 400 }}>· 共 {total.toLocaleString()} 本</span>
    </span>

    {selected > 0 && (
      <span className="op__sel">
        <span>选中 {selected}</span>
        <button onClick={onClear}><Icon n="close" s={10} /></button>
      </span>
    )}

    {selected > 0 ? (
      <>
        <button className="btn btn--sm" onClick={async () => { await window.Api.addTags(selectedIds, ["待整理"]); onAction(`已写入本地数据库：${selected} 本添加 tag「待整理」`); onChanged?.(); }}><Icon n="tag" s={11} /> 编辑标签</button>
        <button className="btn btn--sm" onClick={async () => { await window.Api.addMark(selectedIds, "purchase_watch", "Added from shelf operation toolbar"); onAction(`已写入本地数据库：${selected} 本添加特殊标记 purchase_watch`); onChanged?.(); }}><Icon n="flag" s={11} /> 添加标记</button>
        <button className="btn btn--sm" onClick={() => onAction("已准备加入集合：微信书单、桌面目录或保存视图")}><Icon n="folder" s={11} /> 加入集合</button>
        <button className="btn btn--sm" onClick={() => onAction("Chat 范围已切到选中书目，可请求总结、打标或比较")}><Icon n="sparkle" s={11} /> 询问 LLM</button>
        <button className="btn btn--sm" onClick={() => onAction("元数据补全会先写入 source_records，再投影到列表字段")}><Icon n="wand" s={11} /> 补全元数据</button>
        <button className="btn btn--sm" onClick={() => onAction("已送入 Douban Matches 队列：LLM 只解释证据，不自动确认")}><Icon n="link" s={11} /> 对比豆瓣候选</button>
      </>
    ) : (
      <>
        <button className="btn btn--sm" onClick={async () => { await window.Api.saveView(`视图 ${new Date().toLocaleTimeString()}`, { source: "shelf-toolbar", totalShown }); onAction("已写入本地数据库：当前查询保存到 saved_views"); }}><Icon n="save" s={11} /> 保存视图</button>
        <button className="btn btn--sm" onClick={() => onAction("Chat 范围已切到当前筛选结果，可继续自然语言搜索")}><Icon n="sparkle" s={11} /> 询问 LLM</button>
        <button className="btn btn--sm" onClick={() => onAction("质量报告已生成：缺字段、匹配冲突、封面/译者差异会进入 Data Quality")}><Icon n="warn" s={11} /> 质量报告</button>
      </>
    )}

    <span className="op__sep" />

    <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      <button
        className="btn btn--sm"
        style={{ borderRadius: 0, border: 0, background: layout === "table" ? "var(--accent-2)" : "transparent", color: layout === "table" ? "var(--accent-ink)" : "var(--mid)" }}
        onClick={() => setLayout("table")}
      ><Icon n="rows" s={11} /> 表格</button>
      <button
        className="btn btn--sm"
        style={{ borderRadius: 0, border: 0, borderLeft: "1px solid var(--line)", background: layout === "grid" ? "var(--accent-2)" : "transparent", color: layout === "grid" ? "var(--accent-ink)" : "var(--mid)" }}
        onClick={() => setLayout("grid")}
      ><Icon n="grid" s={11} /> 封面</button>
    </div>
  </div>
);

/* ----- Sortable column header ----------------------------------------- */
const Th = ({ children, sort, sortKey, setSort, align, width }) => (
  <th style={{ width, textAlign: align || "left" }}>
    {sortKey ? (
      <button
        className="sortable"
        data-active={sort.key === sortKey || undefined}
        onClick={() => setSort(s => ({ key: sortKey, dir: s.key === sortKey && s.dir === "desc" ? "asc" : "desc" }))}
        style={{ background: "transparent", border: 0, padding: 0, font: "inherit", color: "inherit" }}
      >
        {children}
        {sort.key === sortKey && (
          <Icon n={sort.dir === "desc" ? "chevd" : "chevu"} s={10} />
        )}
      </button>
    ) : children}
  </th>
);

/* ----- Table ----------------------------------------------------------- */
const ShelfTable = ({ books, selected, setSelected, active, setActive, sort, setSort }) => {
  const allSel = books.length > 0 && books.every(b => selected.has(b.id));
  const anySel = books.some(b => selected.has(b.id));

  const toggleAll = () => {
    if (allSel) setSelected(new Set());
    else setSelected(new Set(books.map(b => b.id)));
  };
  const toggle = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <colgroup>
          <col className="col-check" /><col className="col-cover" />
          <col className="col-title" /><col className="col-author" />
          <col className="col-tags" /><col className="col-state" />
          <col className="col-price" /><col className="col-rating" />
          <col className="col-match" /><col className="col-plat" />
          <col className="col-update" /><col className="col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="col-check">
              <Checkbox on={allSel} indet={!allSel && anySel} onChange={toggleAll} />
            </th>
            <th />
            <Th sortKey="title" sort={sort} setSort={setSort}>书目</Th>
            <Th>作者 · 译者</Th>
            <Th>标签 · 标记</Th>
            <Th sortKey="readUpdate" sort={sort} setSort={setSort}>阅读</Th>
            <Th sortKey="price" sort={sort} setSort={setSort} align="right">价格</Th>
            <Th sortKey="doubanRating" sort={sort} setSort={setSort}>评分 W · D</Th>
            <Th>匹配</Th>
            <Th>平台</Th>
            <Th sortKey="shelfUpdate" sort={sort} setSort={setSort}>更新</Th>
            <th />
          </tr>
        </thead>
        <tbody>
          {books.map(b => {
            const isSel = selected.has(b.id);
            const isAct = active === b.id;
            return (
              <tr
                key={b.id}
                data-selected={isSel || undefined}
                data-active={isAct || undefined}
                onClick={() => setActive(b.id)}
              >
                <td className="col-check"><Checkbox on={isSel} onChange={() => toggle(b.id)} /></td>
                <td><Cover b={b} /></td>
                <td className="title-c">
                  <div className="title-cell">
                    <div className="title-text">
                      <div className="title-row">
                        <span className="title-name">{b.title}</span>
                        {b.subtitle && <span className="title-sub">· {b.subtitle}</span>}
                      </div>
                      <div className="title-sub mono" style={{ fontSize: 10.5 }}>
                        {b.id.startsWith("album:") ? "album · " : "ebook · "}{b.id} · {b.publisher || "—"}
                      </div>
                    </div>
                    {b.marks.map(m => <MarkBadge key={m} k={m} />)}
                  </div>
                </td>
                <td>
                  <span className="author-cell">
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b.author}</span>
                    {b.translator && <span className="trans">/ {b.translator}</span>}
                  </span>
                </td>
                <td>
                  <div className="tags-cell">
                    {b.tags.slice(0, 3).map(t => <Tag key={t.id} t={t} sys={t.type !== "manual"} />)}
                    {b.tags.length > 3 && <span className="tag tag--more">+{b.tags.length - 3}</span>}
                  </div>
                </td>
                <td><ReadState b={b} /></td>
                <td><Price b={b} /></td>
                <td><RatingCell b={b} /></td>
                <td><MatchPill s={b.match} /></td>
                <td><PlatformBadges p={b.platforms} /></td>
                <td className="update-cell">{b.shelfUpdate}</td>
                <td className="col-actions">
                  <button className="row-actions" onClick={(e) => { e.stopPropagation(); }}>
                    <Icon n="more" s={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ----- Cover grid alternate layout ------------------------------------ */
const CoverGrid = ({ books, active, setActive }) => (
  <div className="tbl-wrap">
    <div className="grid-cover">
      {books.map(b => (
        <div
          key={b.id}
          className="gc"
          data-active={active === b.id || undefined}
          onClick={() => setActive(b.id)}
        >
          <Cover b={b} w="100%" h="auto" fontSize={18} />
          <div>
            <div className="gc__t">{b.title}</div>
            <div className="gc__a">{b.author}</div>
            <div className="gc__m" style={{ marginTop: 4 }}>
              <Price b={b} />
              <span style={{ marginLeft: "auto" }}><MatchPill s={b.match} /></span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ----- Pagination footer ---------------------------------------------- */
const PageFoot = ({ total, shown }) => (
  <div className="foot">
    <span>显示 1 – {shown} · 共 {total.toLocaleString()} 本</span>
    <span className="foot__sep" />
    <span>每页</span>
    <button className="btn btn--sm">100 ▾</button>
    <div className="foot__pg">
      <button title="上一页"><Icon n="chev" s={10} style={{ transform: "rotate(180deg)" }} /></button>
      <button aria-current="true">1</button>
      <button>2</button>
      <button>3</button>
      <button>…</button>
      <button>898</button>
      <button title="下一页"><Icon n="chev" s={10} /></button>
    </div>
  </div>
);

/* ----- The whole Shelf page ------------------------------------------- */
const ShelfPage = ({ query, books, active, setActive, layout, setLayout, sort, setSort, total = 89_739, onChanged }) => {
  const [selected, setSelected] = React.useState(new Set());
  const [view, setView] = React.useState("v-all");
  const [manualFilters, setManualFilters] = React.useState([]);
  const [notice, setNotice] = React.useState("");
  const viewFilters = VIEW_FILTERS[view] || [];
  const activeFilters = Array.from(new Set([...viewFilters, ...manualFilters]));
  const filteredBooks = React.useMemo(() => filterBooksByIds(books, activeFilters), [books, activeFilters.join("|")]);
  const toggleFilter = (id) => {
    setManualFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const switchView = (id) => {
    setView(id);
    setManualFilters([]);
    setSelected(new Set());
  };
  return (
    <>
      <SavedViewTabs views={window.SAVED_VIEWS} active={view} onSelect={switchView} />
      <FilterRow activeFilters={activeFilters} toggleFilter={toggleFilter} />
      <OperationToolbar
        selected={selected.size}
        selectedIds={Array.from(selected)}
        totalShown={filteredBooks.length}
        total={total}
        layout={layout}
        setLayout={setLayout}
        onClear={() => setSelected(new Set())}
        onAction={setNotice}
        onChanged={onChanged}
      />
      {notice && (
        <div className="op-note">
          <Icon n="dot" s={10} />
          <span>{notice}</span>
          <button onClick={() => setNotice("")}><Icon n="close" s={10} /></button>
        </div>
      )}
      {layout === "table"
        ? <ShelfTable books={filteredBooks} selected={selected} setSelected={setSelected} active={active} setActive={setActive} sort={sort} setSort={setSort} />
        : <CoverGrid books={filteredBooks} active={active} setActive={setActive} />}
      <PageFoot total={total} shown={filteredBooks.length} />
    </>
  );
};

Object.assign(window, { ShelfPage });
