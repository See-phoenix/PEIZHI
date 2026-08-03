"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  API_BASE,
  Part,
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

const SOURCE_LABEL: Record<string, string> = {
  verified: "权威价",
  live: "实时搜索",
  catalog: "目录参考价",
};

export default function HomePage() {
  const [budget, setBudget] = useState(9000);
  const [useCase, setUseCase] = useState<UseCase>("gaming_2k");
  const [resolution, setResolution] = useState<Resolution>("1440p");
  const [lockGpu, setLockGpu] = useState("gpu-rx-9070-gre");
  const [includeLive, setIncludeLive] = useState(false);
  const [gpus, setGpus] = useState<Part[]>([]);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [correctPart, setCorrectPart] = useState<Part | null>(null);
  const [correctPrice, setCorrectPrice] = useState("");
  const [correctPlatform, setCorrectPlatform] = useState("jd");
  const [correctUrl, setCorrectUrl] = useState("");
  const [correctNote, setCorrectNote] = useState("");

  useEffect(() => {
    listParts("gpu")
      .then(setGpus)
      .catch(() => setGpus([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await suggestBuild({
        budget,
        use_case: useCase,
        resolution,
        lock_gpu_id: lockGpu || null,
        include_live_prices: includeLive,
      });
      setResult(data);
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
        setOkMsg(`${correctPart.name} 纠价已校验入库（权威价 ¥${out.price}），可供其他模块调用`);
      } else if (out.status === "pending") {
        setOkMsg("纠价已提交，偏离较大需人工审核后再入库");
      } else {
        setOkMsg(`纠价被拒绝：${out.reject_reason || out.status}`);
      }
      setCorrectPart(null);
      // refresh build without live to pick up verified prices quickly
      const data = await suggestBuild({
        budget,
        use_case: useCase,
        resolution,
        lock_gpu_id: lockGpu || null,
        include_live_prices: includeLive,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "纠价失败");
    }
  }

  return (
    <main>
      <header className="hero">
        <h1>PEIZHI 装机配智</h1>
        <p>
          按预算与用途生成国内主机配置；价格支持目录参考价 + 购物搜索实时价，并可手动纠价，经系统校验后写入权威价库供 Web / 手机 /
          客户端共用。
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
                required
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
            <label>
              锁定显卡（可选）
              <select value={lockGpu} onChange={(e) => setLockGpu(e.target.value)}>
                <option value="">自动选择</option>
                {gpus.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}（¥{g.list_price}）
                  </option>
                ))}
              </select>
            </label>
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
            <button type="submit" disabled={loading}>
              {loading ? "生成中…" : "生成配置单"}
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
        {okMsg && <p className="ok-text">{okMsg}</p>}
      </section>

      {result && (
        <section className="card" style={{ marginTop: "1.25rem" }}>
          <div className="summary">
            <div className="stat">
              <span>有效总价</span>
              <strong>¥{result.total_effective.toFixed(0)}</strong>
            </div>
            <div className="stat">
              <span>目录总价</span>
              <strong>¥{result.total_catalog.toFixed(0)}</strong>
            </div>
            <div className="stat">
              <span>预估功耗</span>
              <strong>{result.estimated_wattage}W</strong>
            </div>
            <div className="stat">
              <span>建议电源</span>
              <strong>{result.recommended_psu_wattage}W</strong>
            </div>
          </div>

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
                  <th>类别</th>
                  <th>配件</th>
                  <th>有效价</th>
                  <th>价源</th>
                  <th>购买</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.part.id}>
                    <td>{CATEGORY_LABEL[item.category] || item.category}</td>
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
        API：{API_BASE} · OpenAPI 文档见后端 /docs · 权威价入库后可被各端通过{" "}
        <code>/api/prices/verified/&#123;part_id&#125;</code> 读取
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
