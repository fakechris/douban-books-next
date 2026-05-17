/* global React, Icon */

/* ----- Sidebar -------------------------------------------------------- */
const Sidebar = ({ route, setRoute }) => {
  const main = window.NAV.filter(n => n.group === "main");
  const ops  = window.NAV.filter(n => n.group === "ops");

  const Item = ({ n }) => (
    <button
      className="sb__item"
      aria-current={route === n.id || undefined}
      onClick={() => setRoute(n.id)}
    >
      <span className="sb__item-ic"><Icon n={n.ic} s={14} /></span>
      <span className="sb__item-l">{n.label}</span>
      <span className="sb__item-c">
        {typeof n.count === "number" ? n.count.toLocaleString() : n.count}
      </span>
    </button>
  );

  return (
    <aside className="sb">
      <div className="sb__brand">
        <div className="sb__brand-mark">书</div>
        <div>
          <div className="sb__brand-name">书架 <span style={{ color: "var(--mid-2)", fontWeight: 400 }}>· shelf</span></div>
          <div className="sb__brand-sub">个人书库 · 89,739 本</div>
        </div>
      </div>

      <div className="sb__section">
        <div className="sb__label">Library</div>
        <div className="sb__nav">{main.map(n => <Item key={n.id} n={n} />)}</div>
        {route === "collections" && (
          <div className="sb__sub">
            <button className="sb__item" aria-current="true">微信书单 · 23</button>
            <button className="sb__item">归档 / 文件夹 · 8</button>
            <button className="sb__item">桌面目录 · 6</button>
            <button className="sb__item">本地手工集 · 4</button>
            <button className="sb__item">保存的视图 · 5</button>
            <button className="sb__item">动态集合 · 1</button>
          </div>
        )}
        {route === "tags" && (
          <div className="sb__sub">
            <button className="sb__item" aria-current="true">所有 · 312</button>
            <button className="sb__item">手工 · 218</button>
            <button className="sb__item">导入 · 47</button>
            <button className="sb__item">系统 · 18</button>
            <button className="sb__item">价格 · 4</button>
            <button className="sb__item">工作流 · 5</button>
          </div>
        )}
        {route === "prices" && (
          <div className="sb__sub">
            <button className="sb__item" aria-current="true">已购 · 12,408</button>
            <button className="sb__item">未购 · 77,341</button>
            <button className="sb__item">会员可读 · 4,182</button>
            <button className="sb__item">免费 · 2,041</button>
            <button className="sb__item">便宜书 · 8,321</button>
            <button className="sb__item">贵书 · 1,874</button>
            <button className="sb__item">价格关注 · 64</button>
            <button className="sb__item">购买关注 · 38</button>
            <button className="sb__item">平台最低 · 921</button>
          </div>
        )}
        {route === "matches" && (
          <div className="sb__sub">
            <button className="sb__item" aria-current="true">候选 · 218</button>
            <button className="sb__item">已确认 · 41,802</button>
            <button className="sb__item">导入 · 12,094</button>
            <button className="sb__item">冲突 · 132</button>
            <button className="sb__item">缺失 · 35,493</button>
            <button className="sb__item">已拒 · 84</button>
          </div>
        )}
      </div>

      <div className="sb__section">
        <div className="sb__label">Operations</div>
        <div className="sb__nav">{ops.map(n => <Item key={n.id} n={n} />)}</div>
      </div>

      <div className="sb__footer">
        <div className="sb__user">CH</div>
        <div>
          <div style={{ color: "var(--ink-2)", fontSize: 11.5 }}>chris</div>
          <div>last sync · 2 min ago</div>
        </div>
      </div>
    </aside>
  );
};

/* ----- Topbar --------------------------------------------------------- */
const Topbar = ({ crumbs, query, setQuery, right }) => (
  <div className="tb">
    <div className="tb__crumbs">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: "var(--faint)" }}>›</span>}
          {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
        </React.Fragment>
      ))}
    </div>
    <div className="tb__search">
      <span className="tb__search-ic"><Icon n="search" s={13} /></span>
      <input
        placeholder="搜索 · 书名 / 作者 / 译者 / ISBN / 豆瓣 ID / 标签 / 书单 / 笔记 …"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <span className="tb__search-kbd">⌘K</span>
    </div>
    <div className="tb__right">
      {right}
      <button className="btn btn--ghost" title="同步"><Icon n="sync" s={13} /></button>
      <button className="btn btn--ghost" title="命令"><Icon n="cmd" s={13} /></button>
    </div>
  </div>
);

Object.assign(window, { Sidebar, Topbar });
