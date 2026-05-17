/* global React */

/* ----- Icon set (16/14 line, currentColor) ---------------------------- */
const Icon = ({ n, s = 14 }) => {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    shelf: <g {...stroke}><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 6h11M2.5 9.5h11" /></g>,
    stack: <g {...stroke}><path d="M2.5 5l5.5-2.5L13.5 5l-5.5 2.5L2.5 5z" /><path d="M2.5 8l5.5 2.5L13.5 8" /><path d="M2.5 11l5.5 2.5L13.5 11" /></g>,
    tag:   <g {...stroke}><path d="M3 8.5V3.5h5l5.5 5.5-5 5L3 8.5z" /><circle cx="5.5" cy="6" r="0.8" /></g>,
    yuan:  <g {...stroke}><path d="M5 3l3 4 3-4M8 7v6.5M5 9.5h6M5 11.5h6" /></g>,
    link:  <g {...stroke}><path d="M6.5 9.5l3-3M5.5 4.5h-1a2.5 2.5 0 0 0 0 5h1M10.5 11.5h1a2.5 2.5 0 0 0 0-5h-1" /></g>,
    globe: <g {...stroke}><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" /></g>,
    note:  <g {...stroke}><path d="M4 2.5h6l2.5 2.5v8.5H4z" /><path d="M9.5 2.5v3h3M6 8h4M6 10.5h3" /></g>,
    warn:  <g {...stroke}><path d="M8 2.5l5.5 10H2.5L8 2.5z" /><path d="M8 6.5v3M8 11h0" /></g>,
    sync:  <g {...stroke}><path d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3" /><path d="M11.5 2.5v2.5h-2.5M4.5 13.5V11h2.5" /></g>,
    chat:  <g {...stroke}><path d="M2.5 4.5h11v7H8.5L5.5 13.5v-2H2.5z" /><path d="M5.5 7.5h5M5.5 9.5h3" /></g>,
    search: <g {...stroke}><circle cx="7" cy="7" r="4" /><path d="M10 10l3 3" /></g>,
    plus:  <g {...stroke}><path d="M8 3v10M3 8h10" /></g>,
    chev:  <g {...stroke}><path d="M5 3l4 5-4 5" /></g>,
    chevd: <g {...stroke}><path d="M3 6l5 4 5-4" /></g>,
    chevu: <g {...stroke}><path d="M3 10l5-4 5 4" /></g>,
    close: <g {...stroke}><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></g>,
    filter:<g {...stroke}><path d="M2.5 4h11M4.5 8h7M6.5 12h3" /></g>,
    sort:  <g {...stroke}><path d="M4 3v10M2 11l2 2 2-2M11 3v10M9 5l2-2 2 2" /></g>,
    more:  <g {...stroke}><circle cx="3.5" cy="8" r="0.8" /><circle cx="8" cy="8" r="0.8" /><circle cx="12.5" cy="8" r="0.8" /></g>,
    dot:   <g {...stroke}><circle cx="8" cy="8" r="2" /></g>,
    eye:   <g {...stroke}><path d="M1.5 8c2-3.5 4-5 6.5-5s4.5 1.5 6.5 5c-2 3.5-4 5-6.5 5S3.5 11.5 1.5 8z" /><circle cx="8" cy="8" r="2" /></g>,
    star:  <g {...stroke}><path d="M8 2.5l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.7l-3.6 1.9.7-4-2.9-2.8 4-.6L8 2.5z" /></g>,
    bookm: <g {...stroke}><path d="M4 2.5h8v11l-4-2.5-4 2.5z" /></g>,
    flag:  <g {...stroke}><path d="M4 13.5V2.5M4 2.5h7l-1.5 2.5L11 7.5H4" /></g>,
    bolt:  <g {...stroke}><path d="M9 2.5l-5 6.5h3l-1 4.5 5-6.5h-3l1-4.5z" /></g>,
    edit:  <g {...stroke}><path d="M3 11l1-3 7-7 2 2-7 7-3 1zM10 2l2 2" /></g>,
    check: <g {...stroke}><path d="M3 8l3.5 3.5L13 4.5" /></g>,
    x:     <g {...stroke}><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></g>,
    arr:   <g {...stroke}><path d="M3 8h10M9 4l4 4-4 4" /></g>,
    grid:  <g {...stroke}><rect x="2.5" y="2.5" width="4.5" height="4.5" /><rect x="9" y="2.5" width="4.5" height="4.5" /><rect x="2.5" y="9" width="4.5" height="4.5" /><rect x="9" y="9" width="4.5" height="4.5" /></g>,
    rows:  <g {...stroke}><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></g>,
    cmd:   <g {...stroke}><path d="M5 5h6v6H5zM5 5a1.5 1.5 0 1 1-1.5 1.5M5 11a1.5 1.5 0 1 1-1.5-1.5M11 5a1.5 1.5 0 1 0 1.5 1.5M11 11a1.5 1.5 0 1 0 1.5-1.5" /></g>,
    book:  <g {...stroke}><path d="M3 3.5h4a2 2 0 0 1 2 2v8M13 3.5h-4a2 2 0 0 0-2 2v8" /></g>,
    sparkle:<g {...stroke}><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2" /></g>,
    wand:  <g {...stroke}><path d="M3 13l8-8M9 3l1 1 1-1 1 1M2 6l1 1 1-1 1 1" /></g>,
    folder:<g {...stroke}><path d="M2.5 4.5h4l1 1.5h6v7h-11z" /></g>,
    archive:<g {...stroke}><rect x="2.5" y="3" width="11" height="3" rx="0.5"/><path d="M3.5 6v7h9V6M6 9h4"/></g>,
    drawer:<g {...stroke}><path d="M2.5 2.5h11v11h-11zM9 2.5v11M11 5l1.5 1.5M11 8l1.5 1.5" /></g>,
    save:  <g {...stroke}><path d="M3 3.5h8l2 2v8H3zM5 3.5v3h5v-3M5 13.5v-4h6v4" /></g>,
    ai:    <g {...stroke}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v6M5 8h6M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6" /></g>,
  };
  return (
    <svg viewBox="0 0 16 16" width={s} height={s} style={{ display: "block", flex: "none" }} aria-hidden="true">
      {paths[n] || paths.dot}
    </svg>
  );
};

/* ----- atomic visuals -------------------------------------------------- */
const Cover = ({ b, w = 26, h = 36, fontSize = 9 }) => {
  // 2-3 char abbreviation from title
  const t = b.title || "";
  const short = /[\u4e00-\u9fff]/.test(t) ? t.slice(0, 2) : t.slice(0, 2).toUpperCase();
  return (
    <div className="cover" data-tone={b.cover ?? 0} style={{ width: w, height: h, fontSize }}>{short}</div>
  );
};

const Tag = ({ t, sys = false }) => (
  <span className={"tag" + (sys ? " tag--sys" : "")} data-c={t.c || "ink"}>{t.name}</span>
);

const MarkBadge = ({ k }) => {
  const map = {
    watch:    { ic: "eye",   kind: "watch", title: "价格关注" },
    priority: { ic: "bolt",  kind: "priority", title: "优先阅读" },
    bad:      { ic: "warn",  kind: "bad",   title: "数据质量警示" },
    purchase: { ic: "bookm", kind: "watch", title: "购买关注" },
    hide:     { ic: "eye",   kind: "muted", title: "隐藏" },
  };
  const m = map[k] || map.bad;
  return (
    <span className="title-mark" data-kind={m.kind} title={m.title}>
      <Icon n={m.ic} s={11} />
    </span>
  );
};

const MatchPill = ({ s }) => {
  const labels = {
    confirmed: "已确认", candidate: "候选", conflict: "冲突",
    missing: "缺失", imported: "导入", review: "待审核", rejected: "已拒",
  };
  return (
    <span className="match">
      <span className="match__d" data-s={s} />
      <span>{labels[s] || s}</span>
    </span>
  );
};

const PlatformBadges = ({ p }) => (
  <span className="plat">
    <span className="plat__b" data-on={p.w}  data-key="w">W</span>
    <span className="plat__b" data-on={p.d}  data-key="d">D</span>
    <span className="plat__b" data-on={p.j}  data-key="j">J</span>
    <span className="plat__b" data-on={p.z}  data-key="z">Z</span>
  </span>
);

const Price = ({ b }) => {
  if (b.bucket === "free") return <span className="price-cell"><span className="v v--bucket-free">免费</span></span>;
  return (
    <span className="price-cell">
      <span className="yuan">¥</span>
      <span className={"v v--bucket-" + b.bucket}>{b.price.toFixed(2)}</span>
    </span>
  );
};

const ReadState = ({ b }) => {
  if (b.readState === "finished") return <span className="state-cell"><span className="dot" style={{ background: "var(--ok)" }} /><span>已读</span></span>;
  if (b.readState === "reading")  return <span className="state-cell"><span className="dot" style={{ background: "var(--accent)" }} /><span className="mono" style={{ fontSize: 11 }}>{b.progress}%</span></span>;
  return <span className="state-cell" style={{ color: "var(--mid-2)" }}><span className="dot" style={{ background: "var(--faint)" }} /><span>未读</span></span>;
};

const PaidPill = ({ b }) => {
  if (b.payType === 3) return <span className="pill" style={{ color: "var(--ok)", borderColor: "color-mix(in oklab, var(--ok) 30%, transparent)" }}>会员可读</span>;
  if (b.paid) return <span className="pill" style={{ color: "var(--ok)", borderColor: "color-mix(in oklab, var(--ok) 30%, transparent)" }}>已购</span>;
  if (b.soldout) return <span className="pill" style={{ color: "var(--mid)" }}>下架</span>;
  return <span className="pill" style={{ color: "var(--mid)" }}>未购</span>;
};

const RatingCell = ({ b }) => (
  <span className="rating-cell">
    <span className="w">{b.weReadRating ? (b.weReadRating / 10).toFixed(1) : "—"}</span>
    <span className="d">{b.doubanRating ? b.doubanRating.toFixed(1) : "—"}</span>
    <span className="d-bar" style={{ "--p": ((b.doubanRating || 0) * 10) + "%" }} />
  </span>
);

const Checkbox = ({ on, indet, onChange }) => (
  <input
    type="checkbox"
    className={"cb" + (indet ? " cb--indet" : "")}
    checked={!!on}
    onChange={onChange}
    onClick={(e) => e.stopPropagation()}
  />
);

/* ----- expose globally for sibling JSX files -------------------------- */
Object.assign(window, {
  Icon, Cover, Tag, MarkBadge, MatchPill, PlatformBadges,
  Price, ReadState, PaidPill, RatingCell, Checkbox,
});
