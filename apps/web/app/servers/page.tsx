"use client";

import { FormEvent, useState } from "react";
import {
  API_BASE,
  Part,
  RegionPref,
  ServerOfferItem,
  ServerScene,
  ServerSuggestResponse,
  submitCorrection,
  suggestServers,
} from "@/lib/api";

const SCENE_LABEL: Record<ServerScene, string> = {
  website: "建站/博客",
  app: "应用/API",
  database: "数据库",
  ai: "AI/推理",
  overseas: "出海/境外",
  dev: "开发测试",
  budget: "极致省钱",
};

const SOURCE_LABEL: Record<string, string> = {
  verified: "权威价",
  live: "实时搜索",
  catalog: "目录参考价",
};

function SpecLine({ part }: { part: Part }) {
  const s = part.specs || {};
  const bits = [
    `${s.vcpu ?? "-"}核`,
    `${s.memory_gb ?? "-"}G`,
    s.disk_gb ? `${s.disk_gb}G盘` : null,
    s.bandwidth_mbps ? `${s.bandwidth_mbps}Mbps` : null,
    s.region_label ? String(s.region_label) : null,
    s.gpu ? String(s.gpu) : null,
  ].filter(Boolean);
  return <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{bits.join(" · ")}</div>;
}

export default function ServersPage() {
  const [budget, setBudget] = useState(100);
  const [scene, setScene] = useState<ServerScene>("website");
  const [regionPref, setRegionPref] = useState<RegionPref>("domestic");
  const [minVcpu, setMinVcpu] = useState(1);
  const [minMem, setMinMem] = useState(1);
  const [includeLive, setIncludeLive] = useState(false);
  const [result, setResult] = useState<ServerSuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [correctPart, setCorrectPart] = useState<Part | null>(null);
  const [correctPrice, setCorrectPrice] = useState("");
  const [correctPlatform, setCorrectPlatform] = useState("official");
  const [correctUrl, setCorrectUrl] = useState("");
  const [correctNote, setCorrectNote] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await suggestServers({
        monthly_budget: budget,
        scene,
        region_pref: regionPref,
        min_vcpu: minVcpu,
        min_memory_gb: minMem,
        include_live_prices: includeLive,
        limit: 5,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const data = await suggestServers({
      monthly_budget: budget,
      scene,
      region_pref: regionPref,
      min_vcpu: minVcpu,
      min_memory_gb: minMem,
      include_live_prices: includeLive,
      limit: 5,
    });
    setResult(data);
  }

  async function onCorrectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!correctPart) return;
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
        setOkMsg(`${correctPart.name} 月价纠价已入库（权威价 ¥${out.price}）`);
      } else if (out.status === "pending") {
        setOkMsg("纠价已提交，需人工审核后入库");
      } else {
        setOkMsg(`纠价被拒绝：${out.reject_reason || out.status}`);
      }
      setCorrectPart(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "纠价失败");
    }
  }

  const rows: ServerOfferItem[] = result
    ? [result.primary, ...result.alternatives].filter(Boolean) as ServerOfferItem[]
    : [];

  return (
    <main>
      <header className="hero">
        <h1>服务器 / VPS 选型</h1>
        <p>
          吸收 EC2 Instance Selector 的规格过滤、VPS 场景矩阵与云比价思路；复用本项目的多通道价格与纠价权威库。
          目录价为参考月费，活动价请纠价入库后供各端调用。
        </p>
      </header>

      <section className="card">
        <form onSubmit={onSubmit}>
          <div className="grid-form">
            <label>
              月预算（元）
              <input
                type="number"
                min={10}
                max={20000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                required
              />
            </label>
            <label>
              场景
              <select value={scene} onChange={(e) => setScene(e.target.value as ServerScene)}>
                {(Object.keys(SCENE_LABEL) as ServerScene[]).map((k) => (
                  <option key={k} value={k}>
                    {SCENE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              地域偏好
              <select
                value={regionPref}
                onChange={(e) => setRegionPref(e.target.value as RegionPref)}
              >
                <option value="any">不限</option>
                <option value="domestic">国内云优先</option>
                <option value="overseas">境外 VPS 优先</option>
              </select>
            </label>
            <label>
              最低 vCPU
              <input
                type="number"
                min={1}
                value={minVcpu}
                onChange={(e) => setMinVcpu(Number(e.target.value))}
              />
            </label>
            <label>
              最低内存 GB
              <input
                type="number"
                min={1}
                value={minMem}
                onChange={(e) => setMinMem(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="actions">
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={includeLive}
                onChange={(e) => setIncludeLive(e.target.checked)}
              />
              拉取 SerpApi 实时搜索价
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "选型中…" : "生成推荐"}
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
        {okMsg && <p className="ok-text">{okMsg}</p>}
      </section>

      {result && (
        <section className="card" style={{ marginTop: "1.25rem" }}>
          {result.notes.length > 0 && (
            <ul className="issues">
              {result.notes.map((n) => (
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
                  <th>#</th>
                  <th>套餐</th>
                  <th>有效月价</th>
                  <th>评分</th>
                  <th>价源</th>
                  <th>购买</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.part.id}>
                    <td>{item.rank}</td>
                    <td>
                      <div>{item.part.name}</div>
                      <SpecLine part={item.part} />
                      <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 4 }}>
                        {item.reasons.join("；")}
                      </div>
                    </td>
                    <td>
                      ¥{item.effective_price.toFixed(0)}
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                        {item.price_unit}
                      </div>
                    </td>
                    <td>{item.score}</td>
                    <td>
                      <span className={`badge ${item.price_source}`}>
                        {SOURCE_LABEL[item.price_source] || item.price_source}
                      </span>
                    </td>
                    <td>
                      <div className="links">
                        {item.buy_links.official && (
                          <a href={item.buy_links.official} target="_blank" rel="noreferrer">
                            官网
                          </a>
                        )}
                        {item.buy_links.jd && (
                          <a href={item.buy_links.jd} target="_blank" rel="noreferrer">
                            京东搜
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
                          setCorrectUrl(item.buy_links.official || "");
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

          {result.issues.length > 0 && (
            <ul className="issues">
              {result.issues.map((i) => (
                <li key={`${i.code}-${i.message}`} className={i.severity}>
                  [{i.severity}] {i.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="footer-note">
        API：{API_BASE}/api/servers/suggest · 与装机模块共用{" "}
        <code>/api/prices/corrections</code> 权威价库
      </p>

      {correctPart && (
        <div className="modal-backdrop" onClick={() => setCorrectPart(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>纠价 · {correctPart.name}</h3>
            <form onSubmit={onCorrectSubmit}>
              <div className="field">
                <label>
                  实际月费（元）
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
                    <option value="official">官网活动价</option>
                    <option value="aliyun">阿里云</option>
                    <option value="tencent">腾讯云</option>
                    <option value="other">其他</option>
                  </select>
                </label>
              </div>
              <div className="field">
                <label>
                  链接（可选）
                  <input value={correctUrl} onChange={(e) => setCorrectUrl(e.target.value)} />
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
