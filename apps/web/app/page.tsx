"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  Part,
  BuildOption,
  SuggestResponse,
  UseCase,
  Resolution,
  listParts,
  suggestBuild,
  submitCorrection,
} from "@/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  cpu: "CPU",
  motherboard: "主板",
  gpu: "显卡",
  memory: "内存",
  storage: "固态",
  cooler: "散热",
  psu: "电源",
  case: "机箱",
};

const LOCKABLE = ["gpu", "cpu", "motherboard", "memory", "storage", "cooler", "psu", "case"] as const;

const SOURCE_LABEL: Record<string, string> = {
  verified: "权威价",
  live: "实时搜索",
  catalog: "目录参考价",
};

type Locks = Record<string, string>;

export default function HomePage() {
  const [budget, setBudget] = useState(9000);
  const [noBudget, setNoBudget] = useState(false);
  const [useCase, setUseCase] = useState<UseCase>("gaming_2k");
  const [resolution, setResolution] = useState<Resolution>("1440p");
  const [locks, setLocks] = useState<Locks>({});
  const [includeLive, setIncludeLive] = useState(false);
  const [catalog, setCatalog] = useState<Part[]>([]);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [activeAlt, setActiveAlt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [correctPart, setCorrectPart] = useState<Part | null>(null);
  const [correctPrice, setCorrectPrice] = useState("");
  const [correctPlatform, setCorrectPlatform] = useState("jd");
  const [correctUrl, setCorrectUrl] = useState("");
  const [correctNote, setCorrectNote] = useState("");

  useEffect(() => {
    listParts()
      .then((rows) => setCatalog(rows.filter((p) => p.category !== "server")))
      .catch(() => setCatalog([]));
  }, []);

  const byCategory = useMemo(() => {
    const map: Record<string, Part[]> = {};
    for (const p of catalog) {
      (map[p.category] ||= []).push(p);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.list_price - b.list_price);
    }
    return map;
  }, [catalog]);

  const gpuCount = byCategory.gpu?.length || 0;

  function setLock(category: string, partId: string) {
    setLocks((prev) => {
      const next = { ...prev };
      if (!partId) delete next[category];
      else next[category] = partId;
      return next;
    });
  }

  function buildPayload() {
    return {
      budget: noBudget ? null : budget,
      use_case: useCase,
      resolution,
      locks,
      include_live_prices: includeLive,
      alternative_limit: 3,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await suggestBuild(buildPayload());
      setResult(data);
      setActiveAlt(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  async function onCorrectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!correctPart) return;
    setError(null);
    setOkMsg(null);
    try {
      const out = await submitCorrection({
        part_id: correctPart.id,
        price: Number(correctPrice),
        source_platform: correctPlatform,
        product_url: correctUrl || undefined,
        note: correctNote || undefined,
        submitter: "web-user",
      });
      if (out.status === "verified") {
        setOkMsg(`${correctPart.name} 纠价已校验入库（权威价 ¥${out.price}）`);
      } else if (out.status === "pending") {
        setOkMsg("纠价已提交，偏离较大需人工审核后再入库");
      } else {
        setOkMsg(`纠价被拒绝：${out.reject_reason || out.status}`);
      }
      setCorrectPart(null);
      setResult(await suggestBuild(buildPayload()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "纠价失败");
    }
  }

  return (
    <main>
      <header className="hero">
        <h1>PEIZHI 装机配智</h1>
        <p>
          可填预算智能分配，也可不填预算：按配件性能匹配与防拖后腿给出多套对比。
          自选 CPU / 显卡等后，其余自动补齐并做兼容校验。当前目录含 {gpuCount} 款显卡。
        </p>
      </header>

      <section className="card">
        <form onSubmit={onSubmit}>
          <div className="grid-form">
            <label>
              预算（元）
              <input
                type="number"
                min={2000}
                max={100000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                disabled={noBudget}
                required={!noBudget}
              />
            </label>
            <label>
              用途
              <select value={useCase} onChange={(e) => setUseCase(e.target.value as UseCase)}>
                <option value="office">办公学习</option>
                <option value="gaming_2k">2K 游戏</option>
                <option value="content">内容创作</option>
              </select>
            </label>
            <label>
              分辨率
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution)}
              >
                <option value="1080p">1080p</option>
                <option value="1440p">1440p / 2K</option>
                <option value="4k">4K</option>
              </select>
            </label>
          </div>

          <div className="actions" style={{ marginTop: "0.75rem" }}>
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={noBudget}
                onChange={(e) => setNoBudget(e.target.checked)}
              />
              不填预算 · 按性能匹配出多套对比（防严重拖后腿）
            </label>
          </div>

          <h3 className="section-title">自选配件（可选，未选则自动匹配）</h3>
          <div className="grid-form">
            {LOCKABLE.map((cat) => (
              <label key={cat}>
                {CATEGORY_LABEL[cat]}
                {cat === "gpu" ? `（${gpuCount}）` : ""}
                <select
                  value={locks[cat] || ""}
                  onChange={(e) => setLock(cat, e.target.value)}
                >
                  <option value="">自动选择</option>
                  {(byCategory[cat] || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}（¥{p.list_price}）
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="actions">
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={includeLive}
                onChange={(e) => setIncludeLive(e.target.checked)}
              />
              拉取 SerpApi 实时搜索价（需后端配置 KEY）
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => setLocks({})}
            >
              清空自选
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "生成中…" : "生成配置单"}
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
        {okMsg && <p className="ok-text">{okMsg}</p>}
      </section>

      {result && (() => {
        const alts = result.alternatives && result.alternatives.length > 0 ? result.alternatives : null;
        const view: BuildOption | null = alts
          ? alts[Math.min(activeAlt, alts.length - 1)]
          : {
              label: result.mode === "balanced" ? "主推" : "预算方案",
              score: 0,
              reasons: [],
              items: result.items,
              total_catalog: result.total_catalog,
              total_effective: result.total_effective,
              estimated_wattage: result.estimated_wattage,
              recommended_psu_wattage: result.recommended_psu_wattage,
              issues: result.issues,
              notes: result.notes,
            };
        if (!view) return null;
        return (
        <section className="card" style={{ marginTop: "1.25rem" }}>
          {alts && alts.length > 1 && (
            <div style={{ marginBottom: "1rem" }}>
              <h3 className="section-title" style={{ marginTop: 0 }}>
                多套对比（{result.mode === "balanced" ? "无预算·性能匹配" : "方案"}）
              </h3>
              <div className="actions" style={{ marginTop: "0.5rem" }}>
                {alts.map((alt, idx) => (
                  <button
                    key={`${alt.label}-${idx}`}
                    type="button"
                    className={idx === activeAlt ? undefined : "secondary"}
                    onClick={() => setActiveAlt(idx)}
                  >
                    {alt.label}
                    <span style={{ opacity: 0.8, fontWeight: 500 }}>
                      {" "}
                      · ¥{alt.total_catalog.toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>
              {view.reasons.length > 0 && (
                <ul className="issues" style={{ marginTop: "0.75rem" }}>
                  {view.reasons.map((r) => (
                    <li key={r} className="info">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="summary">
            <div className="stat">
              <span>有效总价</span>
              <strong>¥{view.total_effective.toFixed(0)}</strong>
            </div>
            <div className="stat">
              <span>目录总价</span>
              <strong>¥{view.total_catalog.toFixed(0)}</strong>
            </div>
            <div className="stat">
              <span>预估功耗</span>
              <strong>{view.estimated_wattage}W</strong>
            </div>
            <div className="stat">
              <span>建议电源</span>
              <strong>{view.recommended_psu_wattage}W</strong>
            </div>
          </div>

          {view.notes.length > 0 && (
            <ul className="issues">
              {view.notes.map((n) => (
                <li key={n} className="info">
                  {n}
                </li>
              ))}
            </ul>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>类别</th>
                  <th>配件</th>
                  <th>有效价</th>
                  <th>价源</th>
                  <th>购买</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((item) => (
                  <tr key={item.part.id}>
                    <td>
                      {CATEGORY_LABEL[item.category] || item.category}
                      {locks[item.category] === item.part.id ? (
                        <span className="badge verified" style={{ marginLeft: 6 }}>
                          自选
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div>{item.part.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                        目录 ¥{item.part.list_price}
                      </div>
                    </td>
                    <td>¥{item.effective_price.toFixed(0)}</td>
                    <td>
                      <span className={`badge ${item.price_source}`}>
                        {SOURCE_LABEL[item.price_source] || item.price_source}
                      </span>
                    </td>
                    <td>
                      <div className="links">
                        {item.buy_links.jd && (
                          <a href={item.buy_links.jd} target="_blank" rel="noreferrer">
                            京东
                          </a>
                        )}
                        {item.buy_links.tmall && (
                          <a href={item.buy_links.tmall} target="_blank" rel="noreferrer">
                            天猫
                          </a>
                        )}
                        {item.buy_links.pdd && (
                          <a href={item.buy_links.pdd} target="_blank" rel="noreferrer">
                            拼多多
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setCorrectPart(item.part);
                          setCorrectPrice(String(Math.round(item.effective_price)));
                          setCorrectUrl(item.buy_links.jd || "");
                          setCorrectNote("");
                        }}
                      >
                        纠价
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {view.issues.length > 0 && (
            <ul className="issues">
              {view.issues.map((i) => (
                <li key={`${i.code}-${i.message}`} className={i.severity}>
                  [{i.severity}] {i.message}
                </li>
              ))}
            </ul>
          )}
        </section>
        );
      })()}

      <p className="footer-note">
        API：{API_BASE} · 自选通过 <code>locks</code> 传入 · OpenAPI 见 /docs
      </p>

      {correctPart && (
        <div className="modal-backdrop" onClick={() => setCorrectPart(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>纠价 · {correctPart.name}</h3>
            <form onSubmit={onCorrectSubmit}>
              <div className="field">
                <label>
                  实际到手价（元）
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={correctPrice}
                    onChange={(e) => setCorrectPrice(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="field">
                <label>
                  平台
                  <select
                    value={correctPlatform}
                    onChange={(e) => setCorrectPlatform(e.target.value)}
                  >
                    <option value="jd">京东</option>
                    <option value="tmall">天猫</option>
                    <option value="pdd">拼多多</option>
                    <option value="other">其他</option>
                  </select>
                </label>
              </div>
              <div className="field">
                <label>
                  商品链接（可选）
                  <input
                    value={correctUrl}
                    onChange={(e) => setCorrectUrl(e.target.value)}
                    placeholder="https://"
                  />
                </label>
              </div>
              <div className="field">
                <label>
                  备注
                  <textarea
                    rows={2}
                    value={correctNote}
                    onChange={(e) => setCorrectNote(e.target.value)}
                  />
                </label>
              </div>
              <div className="actions">
                <button type="submit">提交纠价</button>
                <button type="button" className="secondary" onClick={() => setCorrectPart(null)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
