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
const ACTIVE_FILTERS = [
  { id: "paid",   k: "已购",   v: "true",         active: true },
  { id: "price",  k: "价格",   v: "≤ ¥30",        active: true },
  { id: "state",  k: "阅读",   v: "未完成",        active: true },
  { id: "match",  k: "豆瓣匹配", v: "已确认",       active: false },
  { id: "tag",    k: "tag",   v: "AI",           active: false },
];

const FilterRow = () => (
  <div className="fr">
    <span style={{ color: "var(--mid)", fontSize: 11.5, marginRight: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon n="filter" s={12} /> Filters
    </span>
    {ACTIVE_FILTERS.map(f => (
      <button
        key={f.id}
        className={"fr__chip" + (f.active ? " fr__chip--active" : "")}
      >
        <span className="fr__chip-k">{f.k}</span>
        <span className="fr__chip-v">{f.v}</span>
        {f.active && <span className="fr__chip-x"><Icon n="close" s={10} /></span>}
      </button>
    ))}
    <button className="fr__add">
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
const OperationToolbar = ({ selected, totalShown, total, layout, setLayout, onClear }) => (
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
        <button className="btn btn--sm"><Icon n="tag" s={11} /> 编辑标签</button>
        <button className="btn btn--sm"><Icon n="flag" s={11} /> 添加标记</button>
        <button className="btn btn--sm"><Icon n="folder" s={11} /> 加入集合</button>
        <button className="btn btn--sm"><Icon n="sparkle" s={11} /> 询问 LLM</button>
        <button className="btn btn--sm"><Icon n="wand" s={11} /> 补全元数据</button>
        <button className="btn btn--sm"><Icon n="link" s={11} /> 对比豆瓣候选</button>
      </>
    ) : (
      <>
        <button className="btn btn--sm"><Icon n="save" s={11} /> 保存视图</button>
        <button className="btn btn--sm"><Icon n="sparkle" s={11} /> 询问 LLM</button>
        <button className="btn btn--sm"><Icon n="warn" s={11} /> 质量报告</button>
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
const ShelfPage = ({ query, books, active, setActive, layout, setLayout, sort, setSort }) => {
  const [selected, setSelected] = React.useState(new Set());
  const [view, setView] = React.useState("v-all");
  return (
    <>
      <SavedViewTabs views={window.SAVED_VIEWS} active={view} onSelect={setView} />
      <FilterRow />
      <OperationToolbar
        selected={selected.size}
        totalShown={books.length}
        total={89_739}
        layout={layout}
        setLayout={setLayout}
        onClear={() => setSelected(new Set())}
      />
      {layout === "table"
        ? <ShelfTable books={books} selected={selected} setSelected={setSelected} active={active} setActive={setActive} sort={sort} setSort={setSort} />
        : <CoverGrid books={books} active={active} setActive={setActive} />}
      <PageFoot total={89_739} shown={books.length} />
    </>
  );
};

Object.assign(window, { ShelfPage });
