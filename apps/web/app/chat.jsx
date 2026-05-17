/* global React, Icon, Cover, MatchPill */

/* ----- Chat / LLM workspace ------------------------------------------- */
const QChip = ({ k, v }) => (
  <span className="msg__qchip"><span className="k">{k}</span><span>{v}</span></span>
);

const ResultList = ({ books }) => (
  <div className="msg__list">
    {books.map(b => (
      <div key={b.id} className="msg__lrow">
        <Cover b={b} w={24} h={34} fontSize={8} />
        <div className="t">{b.title} <span className="a">· {b.author}</span></div>
        <div className="p">{b.bucket === "free" ? "免费" : `¥${b.price.toFixed(2)}`}</div>
        <div className="r" style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <span style={{ color: "var(--mid)" }}>豆瓣 {b.doubanRating?.toFixed(1) || "—"}</span>
          <MatchPill s={b.match} />
        </div>
      </div>
    ))}
  </div>
);

const ChatPage = () => {
  const candidates = window.BOOKS
    .filter(b => b.paid && b.price <= 30 && b.readState !== "finished" && b.doubanRating >= 8.0)
    .slice(0, 6);

  return (
    <div className="page">
      <div className="page__hd">
        <div className="page__title">
          Chat <span style={{ fontSize: 12, color: "var(--mid-2)", fontWeight: 400 }}>· 自然语言搜索 / 批量建议 / 元数据补全</span>
        </div>
        <div className="page__sub">在书库上下文中操作 · 外部 fetch 先入 <span className="mono" style={{ background: "var(--canvas-2)", padding: "0 4px", borderRadius: 3 }}>source_records</span> · 任何破坏性变更需明确确认</div>
      </div>

      <div className="chat">
        <div className="chat__top">
          <span className="scope">
            <Icon n="shelf" s={11} /> 当前范围 · 整个书库 · 89,739 本
          </span>
          <span style={{ color: "var(--mid)" }}>切换：</span>
          <button className="btn btn--sm">选中书目 · 0</button>
          <button className="btn btn--sm">当前筛选结果</button>
          <button className="btn btn--sm" style={{ background: "var(--accent-2)", color: "var(--accent-ink)", borderColor: "var(--accent-3)" }}>整个书库</button>
          <span style={{ marginLeft: "auto", color: "var(--mid)", fontSize: 11.5 }}>
            会话 · 2025-05-17 14:02 · claude-haiku-4.5
          </span>
        </div>

        <div className="chat__bd">

          {/* user message */}
          <div className="msg msg--u">
            <div className="msg__av">C</div>
            <div className="msg__body">
              <div className="msg__txt">找 30 元以内、已购、豆瓣 8 分以上、还没读完的历史书。再帮我看看哪些可以挪到「便宜已购待读」视图里。</div>
              <div className="msg__meta">14:02 · scope: entire library</div>
            </div>
          </div>

          {/* assistant interpretation message */}
          <div className="msg msg--a">
            <div className="msg__av"><Icon n="sparkle" s={12} /></div>
            <div className="msg__body">
              <div className="msg__txt">理解成以下结构化查询，你可以再调整：</div>

              <div className="msg__card">
                <div className="msg__card__h">
                  <span className="ico"><Icon n="filter" s={12} /></span>
                  Proposed filters
                  <span className="c">→ 481 books</span>
                </div>
                <div className="msg__qbar">
                  <QChip k="价格" v="≤ ¥30" />
                  <QChip k="已购" v="true" />
                  <QChip k="豆瓣" v="≥ 8.0" />
                  <QChip k="阅读" v="≠ finished" />
                  <QChip k="分类" v="历史" />
                  <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button className="btn btn--sm"><Icon n="rows" s={11} /> 应用到 Shelf</button>
                    <button className="btn btn--sm"><Icon n="save" s={11} /> 保存为视图</button>
                  </span>
                </div>
                <ResultList books={candidates} />
                <div className="msg__card__ft">
                  <Icon n="dot" s={9} />
                  按豆瓣评分 ↓ 排序 · 显示前 6 本，<a href="#" style={{ color: "var(--accent)" }}>查看全部 481 →</a>
                </div>
              </div>

              <div className="msg__txt" style={{ marginTop: 12 }}>
                以下 <strong>4 本</strong> 当前还不在「便宜已购待读」中，建议加入：
              </div>

              <div className="msg__card">
                <div className="msg__card__h">
                  <span className="ico"><Icon n="folder" s={12} /></span>
                  Suggested collection update · 便宜已购待读
                  <span className="c">+4</span>
                </div>
                <ResultList books={candidates.slice(0, 4)} />
                <div className="msg__card__ft" style={{ display: "flex", alignItems: "center" }}>
                  <Icon n="warn" s={11} /> 批量变更，应用前需确认
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button className="btn btn--sm">逐本审阅</button>
                    <button className="btn btn--sm btn--prim">应用 4 项变更</button>
                  </span>
                </div>
              </div>

              <div className="msg__meta" style={{ marginTop: 8 }}>
                <span>14:02 · 0.6s · 用了 <span className="mono">/api/shelf</span>, <span className="mono">/api/collections/sv-cheap</span></span>
              </div>
            </div>
          </div>

          {/* user follow-up */}
          <div className="msg msg--u">
            <div className="msg__av">C</div>
            <div className="msg__body">
              <div className="msg__txt">那本《Designing Data-Intensive Applications》在 WeRead 上 128 元太贵，别的平台呢？</div>
              <div className="msg__meta">14:04</div>
            </div>
          </div>

          <div className="msg msg--a">
            <div className="msg__av"><Icon n="sparkle" s={12} /></div>
            <div className="msg__body">
              <div className="msg__txt">在跨平台数据里找到三条记录：</div>
              <div className="msg__card">
                <div className="msg__card__h">
                  <span className="ico"><Icon n="globe" s={12} /></span>
                  Cross-platform price · <span className="mono" style={{ color: "var(--mid)" }}>3300290981</span>
                </div>
                <div style={{ padding: 4 }}>
                  <div className="msg__lrow" style={{ gridTemplateColumns: "60px 1fr 90px 1fr" }}>
                    <span style={{ fontWeight: 500 }}>WeRead</span>
                    <span style={{ color: "var(--mid)" }}>电子版 · 中文</span>
                    <span className="num" style={{ textAlign: "right", color: "var(--bad)" }}>¥128.00</span>
                    <span style={{ color: "var(--mid)", textAlign: "right" }}>未购 · 当前列表</span>
                  </div>
                  <div className="msg__lrow" style={{ gridTemplateColumns: "60px 1fr 90px 1fr" }}>
                    <span style={{ fontWeight: 500 }}>JD Read</span>
                    <span style={{ color: "var(--mid)" }}>电子版 · 同一冯若航译本</span>
                    <span className="num" style={{ textAlign: "right", color: "var(--ok)" }}>¥68.00</span>
                    <span style={{ color: "var(--ok)", textAlign: "right" }}>便宜 ¥60</span>
                  </div>
                  <div className="msg__lrow" style={{ gridTemplateColumns: "60px 1fr 90px 1fr" }}>
                    <span style={{ fontWeight: 500 }}>豆瓣</span>
                    <span style={{ color: "var(--mid)" }}>评分 9.7 · 6,204 评价</span>
                    <span className="num" style={{ textAlign: "right" }}>—</span>
                    <span style={{ color: "var(--mid)", textAlign: "right" }}>无售卖</span>
                  </div>
                </div>
                <div className="msg__card__ft">
                  <Icon n="dot" s={9} />
                  raw evidence: <span className="mono">jd_read.detail.2025-05-12</span> · <span className="mono">douban.subject.36011311</span>
                </div>
              </div>
              <div className="msg__txt" style={{ marginTop: 10 }}>
                JD Read 价格便宜 47%。要给它加上 <span className="msg__qchip" style={{ background: "var(--accent-2)", color: "var(--accent-ink)", borderColor: "var(--accent-3)" }}><span className="k">mark</span>购买关注</span> 并加入「贵 + 高分 + 未购」视图吗？
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <button className="btn btn--prim btn--sm">加 mark + 加视图</button>
                <button className="btn btn--sm">只加 mark</button>
                <button className="btn btn--sm">跳到京东 →</button>
              </div>
            </div>
          </div>
        </div>

        <div className="chat__compose">
          <div className="chat__compose-box">
            <textarea rows={2} placeholder="问问书库 · 「AI 相关 + 豆瓣 8.5+」「批量补全这一组」「比较 WeRead 与豆瓣的译者」…"></textarea>
            <div className="chat__compose-tools">
              <button className="btn btn--ghost btn--sm"><Icon n="shelf" s={11} /> 范围：整库</button>
              <button className="btn btn--ghost btn--sm"><Icon n="wand" s={11} /> Skill: WeRead</button>
              <button className="btn btn--ghost btn--sm"><Icon n="wand" s={11} /> Skill: Douban</button>
              <div className="right">
                <span className="kbd">⌘</span><span className="kbd">↵</span>
                <button className="btn btn--prim btn--sm"><Icon n="sparkle" s={11} /> 发送</button>
              </div>
            </div>
          </div>
          <div className="chat__sugg">
            <button>找补全数据缺失的书</button>
            <button>「便宜已购待读」里哪本评分最高？</button>
            <button>给我所有匹配冲突的列表</button>
            <button>用一句话总结 AI / Agents 书单</button>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ChatPage });
