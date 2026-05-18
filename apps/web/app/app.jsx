/* global React, ReactDOM, Sidebar, Topbar, ShelfPage, Drawer,
          TagsPage, PricesPage, MatchesPage, ChatPage, Icon,
          CollectionsPage, PlatformsPage, NotesPage, DataQualityPage, SyncRunsPage,
          TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "accent":  "indigo",
  "layout":  "table",
  "rightChat": true,
  "drawerOpen": true
}/*EDITMODE-END*/;

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("shelf");
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState("3300290981"); // pre-selected for first impression
  const [chatOpen, setChatOpen] = React.useState(false);
  const [sort, setSort] = React.useState({ key: "doubanRating", dir: "desc" });
  const [remoteBooks, setRemoteBooks] = React.useState(window.BOOKS || []);
  const [remoteTotal, setRemoteTotal] = React.useState((window.BOOKS || []).length);
  const [apiStatus, setApiStatus] = React.useState("connecting");
  const [reloadSeq, setReloadSeq] = React.useState(0);

  // apply density + accent to <html>
  React.useEffect(() => {
    document.documentElement.dataset.density = t.density;
    document.documentElement.dataset.accent  = t.accent;
  }, [t.density, t.accent]);

  React.useEffect(() => {
    let cancelled = false;
    setApiStatus("loading");
    window.Api.shelf({ q: query, sort: sort.key, direction: sort.dir, limit: 300 })
      .then(data => {
        if (cancelled) return;
        setRemoteBooks(data.items);
        setRemoteTotal(data.total || data.items.length);
        if (!data.items.find(b => b.id === active) && data.items[0]) setActive(data.items[0].id);
        setApiStatus("live");
      })
      .catch(error => {
        if (cancelled) return;
        console.error(error);
        setApiStatus("fallback");
      });
    return () => { cancelled = true; };
  }, [query, sort.key, sort.dir, reloadSeq]);

  const books = remoteBooks;

  const activeBook = books.find(b => b.id === active) || window.BOOKS.find(b => b.id === active);

  const showDrawer = route === "shelf" && t.drawerOpen && activeBook;

  const crumbs = (() => {
    if (route === "shelf")       return ["Library", "Shelf · 全部"];
    if (route === "tags")        return ["Library", "Tags"];
    if (route === "prices")      return ["Library", "Purchases & Price"];
    if (route === "matches")     return ["Library", "Douban Matches"];
    if (route === "chat")        return ["Operations", "Chat"];
    if (route === "collections") return ["Library", "Collections"];
    if (route === "platforms")   return ["Library", "Platforms"];
    if (route === "notes")       return ["Library", "Notes"];
    if (route === "quality")     return ["Operations", "Data Quality"];
    if (route === "sync")        return ["Operations", "Sync Runs"];
    return ["Library"];
  })();

  return (
    <div className="app" data-drawer={showDrawer ? "open" : "closed"} data-route={route}>
      <Sidebar route={route} setRoute={setRoute} />

      <div className="main" style={{ position: "relative" }}>
        {route !== "chat" && (
          <Topbar
            crumbs={crumbs}
            query={query}
            setQuery={setQuery}
            right={
              <>
                <button className="btn"><Icon n="filter" s={12} /> 高级筛选</button>
                <span className={"api-chip api-chip--" + apiStatus}>
                  {apiStatus === "live" ? "PostgreSQL live" : apiStatus === "loading" ? "loading DB" : apiStatus === "fallback" ? "mock fallback" : "connecting"}
                </span>
                <button
                  className="btn"
                  onClick={() => setTweak("drawerOpen", !t.drawerOpen)}
                  title="详情抽屉"
                >
                  <Icon n="drawer" s={12} />
                </button>
              </>
            }
          />
        )}

        {route === "shelf" && (
          <ShelfPage
            query={query}
            books={books}
            active={active}
            setActive={(id) => { setActive(id); if (!t.drawerOpen) setTweak("drawerOpen", true); }}
            layout={t.layout}
            setLayout={(v) => setTweak("layout", v)}
            sort={sort}
            setSort={setSort}
            total={remoteTotal}
            onChanged={() => setReloadSeq(x => x + 1)}
          />
        )}
        {route === "tags"     && <TagsPage />}
        {route === "prices"   && <PricesPage setRoute={setRoute} setActive={setActive} />}
        {route === "matches"  && <MatchesPage />}
        {route === "chat"     && <ChatPage />}
        {route === "collections" && <CollectionsPage setRoute={setRoute} setActive={setActive} />}
        {route === "platforms"   && <PlatformsPage setRoute={setRoute} setActive={setActive} />}
        {route === "notes"       && <NotesPage setRoute={setRoute} setActive={setActive} />}
        {route === "quality"     && <DataQualityPage setRoute={setRoute} setActive={setActive} />}
        {route === "sync"        && <SyncRunsPage />}

        {/* floating chat */}
        {route !== "chat" && t.rightChat && (
          chatOpen
            ? <ChatPop onClose={() => setChatOpen(false)} setRoute={setRoute} />
            : <button className="chat-fab" onClick={() => setChatOpen(true)}>
                <Icon n="sparkle" s={13} /> 询问书库 <span className="k">⌘J</span>
              </button>
        )}
      </div>

      {showDrawer && <Drawer book={activeBook} onClose={() => setTweak("drawerOpen", false)} />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout">
          <TweakRadio
            label="表格密度"
            value={t.density}
            onChange={v => setTweak("density", v)}
            options={[
              { label: "紧凑", value: "compact" },
              { label: "标准", value: "cozy" },
              { label: "宽松", value: "comfy" },
            ]}
          />
          <TweakRadio
            label="书库模式"
            value={t.layout}
            onChange={v => setTweak("layout", v)}
            options={[
              { label: "表格", value: "table" },
              { label: "封面", value: "grid" },
            ]}
          />
          <TweakToggle
            label="详情抽屉"
            value={t.drawerOpen}
            onChange={v => setTweak("drawerOpen", v)}
          />
          <TweakToggle
            label="右下角 Chat"
            value={t.rightChat}
            onChange={v => setTweak("rightChat", v)}
          />
        </TweakSection>
        <TweakSection label="Accent">
          <TweakRadio
            label="主色"
            value={t.accent}
            onChange={v => setTweak("accent", v)}
            options={[
              { label: "Indigo", value: "indigo" },
              { label: "Ink",    value: "ink" },
              { label: "Moss",   value: "moss" },
              { label: "Clay",   value: "clay" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

/* ----- floating chat pop -------------------------------------------- */
const ChatPop = ({ onClose, setRoute }) => (
  <div className="chat-pop">
    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", background: "var(--panel-2)", display: "flex", alignItems: "center", gap: 8 }}>
      <Icon n="sparkle" s={13} />
      <strong style={{ fontSize: 13 }}>询问书库</strong>
      <span style={{ color: "var(--mid-2)", fontSize: 11, marginLeft: 4 }}>范围 · 当前筛选 (24)</span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => setRoute("chat")} title="展开为全屏"><Icon n="arr" s={11} /></button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}><Icon n="close" s={11} /></button>
      </span>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div className="msg msg--u">
        <div className="msg__av">C</div>
        <div className="msg__body">
          <div className="msg__txt" style={{ fontSize: 12.5 }}>这一批里哪些匹配有冲突？</div>
        </div>
      </div>
      <div className="msg msg--a">
        <div className="msg__av"><Icon n="sparkle" s={11} /></div>
        <div className="msg__body">
          <div className="msg__txt" style={{ fontSize: 12.5 }}>当前筛选中 <strong>3</strong> 本存在匹配冲突，<strong>1</strong> 本待审核：</div>
          <div className="msg__card" style={{ marginTop: 8 }}>
            <div style={{ padding: "6px 10px", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div>· The Pragmatic Programmer <span style={{ color: "var(--bad)" }}>· 译者 / 封面 冲突</span></div>
              <div>· 数字化转型的迷雾 <span style={{ color: "var(--bad)" }}>· 作者/出版/封面 缺失</span></div>
              <div>· 硅谷之火（中文版） <span style={{ color: "var(--warn)" }}>· 译者待审</span></div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            <button className="btn btn--sm">筛选这 3 本</button>
            <button className="btn btn--sm">送到 Matches 队列</button>
          </div>
        </div>
      </div>
    </div>
    <div style={{ padding: 10, borderTop: "1px solid var(--line)" }}>
      <div className="chat__compose-box" style={{ padding: 8 }}>
        <textarea rows={1} placeholder="问当前筛选 · ⌘↵ 发送" style={{ fontSize: 12.5 }} />
      </div>
    </div>
  </div>
);

const StubPage = ({ title, body }) => (
  <div className="page">
    <div className="page__hd">
      <div className="page__title">{title}</div>
      <div className="page__sub">{body}</div>
    </div>
    <div className="page__bd">
      <div className="empty">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Icon n="dot" s={14} />
          <div>区块已建模 · 实现在第二阶段</div>
        </div>
      </div>
    </div>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
