"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eraser, Lock, ShoppingCart, Sparkles } from "lucide-react";
import gsap from "gsap";
import {
  API_BASE,
  Part,
  BuildOption,
  SuggestResponse,
  UseCase,
  Resolution,
  listParts,
  suggestBuild,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CorrectionDialog } from "@/components/correction-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MotionStage } from "@/components/fx/motion-stage";
import { MascotBadge } from "@/components/fx/mascot";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

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

const SOURCE_VARIANT: Record<string, "verified" | "live" | "catalog" | "default"> = {
  verified: "verified",
  live: "live",
  catalog: "catalog",
};

const SOURCE_LABEL: Record<string, string> = {
  verified: "权威价",
  live: "实时搜索",
  catalog: "目录参考价",
};

type Locks = Record<string, string>;

function formatAsOf(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function triggerFlash() {
  if (prefersReducedMotion()) return;
  const el = document.getElementById("acg-flash");
  if (!el) return;
  el.classList.remove("is-on");
  // reflow
  void el.offsetWidth;
  el.classList.add("is-on");
}

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
  const [speedOn, setSpeedOn] = useState(false);

  const [correctPart, setCorrectPart] = useState<Part | null>(null);
  const [correctPrice, setCorrectPrice] = useState("");
  const [correctUrl, setCorrectUrl] = useState("");

  useEffect(() => {
    listParts()
      .then((rows) => setCatalog(rows.filter((p) => p.category !== "server")))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!result || prefersReducedMotion()) return;
    const items = document.querySelectorAll("[data-bom-row]");
    gsap.fromTo(
      items,
      { y: 22, opacity: 0, rotateX: 6 },
      { y: 0, opacity: 1, rotateX: 0, duration: 0.45, stagger: 0.05, ease: "power2.out" }
    );
  }, [result, activeAlt]);

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
  const lockCount = Object.keys(locks).length;

  const view: BuildOption | null = useMemo(() => {
    if (!result) return null;
    const alts = result.alternatives && result.alternatives.length > 0 ? result.alternatives : null;
    if (alts) return alts[Math.min(activeAlt, alts.length - 1)];
    return {
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
  }, [result, activeAlt]);

  const alts = result?.alternatives && result.alternatives.length > 1 ? result.alternatives : null;
  const staleCount = view?.items.filter((i) => i.price_stale).length ?? 0;

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

  async function runSuggest() {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    setSpeedOn(true);
    triggerFlash();
    try {
      const data = await suggestBuild(buildPayload());
      setResult(data);
      setActiveAlt(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
      window.setTimeout(() => setSpeedOn(false), 600);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await runSuggest();
  }

  return (
    <MotionStage className="mx-auto w-full max-w-[1380px] px-4 py-7 sm:px-6 sm:py-9">
      <div id="acg-flash" className="flash-overlay" />

      <section data-anim="hero" className="relative mb-8">
        <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff7eb3]">
          <Sparkles className="h-3.5 w-3.5 text-[#4de8ff]" />
          Neon Parts Stage · {gpuCount} GPU
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          <span className="bg-gradient-to-r from-[#ff4d9a] via-[#ff9ec8] to-[#4de8ff] bg-clip-text text-transparent neon-text">
            配智
          </span>
          <span className="text-white/40"> / </span>
          二次元装机台
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#b7a8c9]">
          预算智能分配，或不填预算按性能匹配多套对比。霓虹玻璃面板里锁定配件，权威有效价驱动选型。
        </p>
        <div className="neon-rule mt-6 max-w-xl" />
        <MascotBadge />
      </section>

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)_250px]">
        <aside data-anim="panel" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="preserve-3d">
            {speedOn && (
              <div className="speed-lines">
                <span style={{ top: "28%" }} />
                <span style={{ top: "48%", animationDelay: "40ms" }} />
                <span style={{ top: "68%", animationDelay: "80ms" }} />
              </div>
            )}
            <CardHeader>
              <CardTitle>需求参数</CardTitle>
              <CardDescription>预算 · 用途 · 锁定 · 霓虹出击</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5" data-anim="item">
                  <Label htmlFor="budget">预算（元）</Label>
                  <Input
                    id="budget"
                    type="number"
                    min={2000}
                    max={100000}
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    disabled={noBudget}
                    required={!noBudget}
                    className="price-mono"
                  />
                </div>

                <label
                  data-anim="item"
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <Checkbox
                    checked={noBudget}
                    onCheckedChange={(v) => setNoBudget(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-[#b7a8c9]">
                    不填预算 · 按性能匹配多套对比
                  </span>
                </label>

                <div className="space-y-1.5" data-anim="item">
                  <Label htmlFor="use-case">用途</Label>
                  <Select
                    id="use-case"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value as UseCase)}
                  >
                    <option value="office">办公学习</option>
                    <option value="gaming_2k">2K 游戏</option>
                    <option value="content">内容创作</option>
                  </Select>
                </div>

                <div className="space-y-1.5" data-anim="item">
                  <Label htmlFor="resolution">分辨率</Label>
                  <Select
                    id="resolution"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as Resolution)}
                  >
                    <option value="1080p">1080p</option>
                    <option value="1440p">1440p / 2K</option>
                    <option value="4k">4K</option>
                  </Select>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b7a8c9]">
                      <Lock className="h-3.5 w-3.5 text-[#4de8ff]" />
                      自选锁定
                    </p>
                    <Badge variant="muted">{lockCount} 项</Badge>
                  </div>
                  <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                    {LOCKABLE.map((cat) => (
                      <div key={cat} className="space-y-1.5" data-anim="item">
                        <Label htmlFor={`lock-${cat}`}>
                          {CATEGORY_LABEL[cat]}
                          {cat === "gpu" ? ` · ${gpuCount}` : ""}
                        </Label>
                        <Select
                          id={`lock-${cat}`}
                          value={locks[cat] || ""}
                          onChange={(e) => setLock(cat, e.target.value)}
                        >
                          <option value="">自动选择</option>
                          {(byCategory[cat] || []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}（¥{p.list_price}）
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <label
                  data-anim="item"
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <Checkbox
                    checked={includeLive}
                    onCheckedChange={(v) => setIncludeLive(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-[#b7a8c9]">
                    拉取实时搜索价（需配置 SerpApi）
                  </span>
                </label>

                <div className="flex flex-col gap-2">
                  <Button type="submit" size="lg" disabled={loading} className="w-full">
                    {loading ? "生成中…" : "生成配置单"}
                  </Button>
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setLocks({})}>
                    <Eraser className="h-3.5 w-3.5" />
                    清空自选
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </aside>

        <section data-anim="panel" className="min-w-0 space-y-4">
          {(error || okMsg) && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm backdrop-blur-md",
                error
                  ? "border-[#ff6b7a]/40 bg-[#ff6b7a]/10 text-[#ffb4bc]"
                  : "border-[#5dffc2]/35 bg-[#5dffc2]/10 text-[#b6ffe4]"
              )}
            >
              {error || okMsg}
            </div>
          )}

          {!result && !loading && (
            <div className="glass-panel relative flex flex-col items-start justify-center gap-4 overflow-hidden rounded-2xl px-6 py-16 sm:px-10">
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
                配置单还在次元裂缝里
              </p>
              <p className="max-w-md text-sm leading-relaxed text-[#b7a8c9]">
                左侧设定预算或开启无预算匹配，点「生成配置单」——闪白、速度线、BOM 清单会一起登场。
              </p>
              <div className="neon-rule w-40" />
            </div>
          )}

          {loading && (
            <Card>
              <CardContent className="space-y-3 py-8">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-gradient-to-r from-[#ff4d9a]/10 via-[#4de8ff]/10 to-transparent"
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {view && !loading && (
            <Card>
              <CardHeader className="space-y-3 border-b border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>配置清单 · BOM</CardTitle>
                    <CardDescription>
                      {view.items.length} 件 · {view.label}
                      {result?.mode === "balanced" ? " · 无预算匹配" : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="default">有效价</Badge>
                </div>
                {alts && (
                  <div className="flex flex-wrap gap-2">
                    {alts.map((alt, idx) => (
                      <Button
                        key={`${alt.label}-${idx}`}
                        type="button"
                        size="sm"
                        variant={idx === activeAlt ? "default" : "secondary"}
                        onClick={() => setActiveAlt(idx)}
                      >
                        {alt.label}
                        <span className="price-mono opacity-80">¥{Math.round(alt.total_effective)}</span>
                      </Button>
                    ))}
                  </div>
                )}
                {view.reasons.length > 0 && (
                  <ul className="space-y-1.5">
                    {view.reasons.map((r) => (
                      <li
                        key={r}
                        className="rounded-lg border border-[#4de8ff]/20 bg-[#4de8ff]/5 px-3 py-1.5 text-xs text-[#c8f7ff]"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <ul>
                  {view.items.map((item) => {
                    const locked = locks[item.category] === item.part.id;
                    const asOf = formatAsOf(item.price_as_of);
                    return (
                      <li
                        key={item.part.id}
                        data-bom-row
                        className="group flex flex-col gap-3 border-b border-white/8 px-5 py-4 transition hover:-translate-y-0.5 hover:bg-white/[0.04] hover:shadow-[0_0_24px_rgba(255,77,154,0.12)] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="price-mono text-[11px] font-semibold uppercase tracking-wider text-[#b7a8c9]">
                              {CATEGORY_LABEL[item.category] || item.category}
                            </span>
                            {locked && <Badge variant="locked">自选</Badge>}
                            <Badge variant={SOURCE_VARIANT[item.price_source] || "default"}>
                              {SOURCE_LABEL[item.price_source] || item.price_source}
                            </Badge>
                            {item.price_stale && (
                              <Badge variant="stale">
                                价已过期
                                {item.price_age_hours != null
                                  ? ` · ${Math.round(item.price_age_hours)}h`
                                  : ""}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate font-medium text-white">{item.part.name}</p>
                          <p className="mt-0.5 text-xs text-[#b7a8c9]">
                            目录 ¥{item.part.list_price}
                            {asOf ? ` · 更新于 ${asOf}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <p className="price-mono text-lg font-semibold text-[#4de8ff]">
                            ¥
                            <NumberTicker
                              value={Math.round(item.effective_price)}
                              className="text-[#4de8ff]"
                            />
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(["jd", "tmall", "pdd"] as const).map((key) =>
                              item.buy_links[key] ? (
                                <a
                                  key={key}
                                  href={item.buy_links[key]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#d8cef0] no-underline hover:border-[#ff4d9a]/40 hover:text-white"
                                >
                                  {key === "jd" && <ShoppingCart className="h-3 w-3" />}
                                  {key === "jd" ? "京东" : key === "tmall" ? "天猫" : "拼多多"}
                                </a>
                              ) : null
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCorrectPart(item.part);
                              setCorrectPrice(String(Math.round(item.effective_price)));
                              setCorrectUrl(item.buy_links.jd || item.buy_links.pdd || "");
                            }}
                          >
                            纠价
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {view?.notes && view.notes.length > 0 && !loading && (
            <ul className="space-y-2">
              {view.notes.map((n) => (
                <li
                  key={n}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#d8cef0] backdrop-blur-md"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside data-anim="panel" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-[#ff4d9a]/25 shadow-[0_0_40px_rgba(255,77,154,0.15)]">
            <CardHeader>
              <CardTitle className="text-[#ff9ec8]">总览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#b7a8c9]">有效总价</p>
                <p className="price-mono mt-1 text-3xl font-bold text-white">
                  ¥
                  {view ? (
                    <NumberTicker value={Math.round(view.total_effective)} className="text-3xl font-bold" />
                  ) : (
                    "—"
                  )}
                </p>
                <p className="mt-1 text-xs text-[#b7a8c9]">
                  目录合计 ¥{view ? Math.round(view.total_catalog) : "—"}
                </p>
                {staleCount > 0 && (
                  <p className="mt-2 text-xs text-[#ffb454]">
                    {staleCount} 项权威价超过 72 小时，建议纠价
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-[#0b0614]/45 p-3">
                  <p className="text-[11px] text-[#b7a8c9]">预估功耗</p>
                  <p className="price-mono mt-1 text-base font-semibold">
                    {view ? (
                      <>
                        <NumberTicker value={view.estimated_wattage} />W
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0b0614]/45 p-3">
                  <p className="text-[11px] text-[#b7a8c9]">建议电源</p>
                  <p className="price-mono mt-1 text-base font-semibold">
                    {view ? (
                      <>
                        <NumberTicker value={view.recommended_psu_wattage} />W
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              </div>
              {result && (
                <Button variant="secondary" className="w-full" onClick={() => runSuggest()} disabled={loading}>
                  刷新配置
                </Button>
              )}
              <p className="text-[10px] tracking-wide text-[#b7a8c9]/80">
                API {API_BASE.replace(/^https?:\/\//, "")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-[#ffb454]" />
                兼容与提示
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!view && <p className="text-sm text-[#b7a8c9]">生成后显示插座、供电、机箱等兼容问题。</p>}
              {view && view.issues.length === 0 && (
                <p className="rounded-lg bg-[#5dffc2]/10 px-3 py-2 text-sm text-[#5dffc2]">
                  未发现严重兼容问题
                </p>
              )}
              {view && view.issues.length > 0 && (
                <ul className="space-y-2">
                  {view.issues.map((i) => (
                    <li
                      key={`${i.code}-${i.message}`}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs leading-relaxed",
                        i.severity === "error" && "bg-[#ff6b7a]/15 text-[#ffb4bc]",
                        i.severity === "warning" && "bg-[#ffb454]/15 text-[#ffe0b0]",
                        i.severity === "info" && "bg-[#4de8ff]/10 text-[#c8f7ff]"
                      )}
                    >
                      <span className="font-semibold uppercase">[{i.severity}]</span> {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <CorrectionDialog
        part={correctPart}
        open={!!correctPart}
        onOpenChange={(open) => {
          if (!open) setCorrectPart(null);
        }}
        initialPrice={correctPrice}
        initialUrl={correctUrl}
        priceLabel="实际到手价（元）"
        platforms={[
          { value: "jd", label: "京东" },
          { value: "tmall", label: "天猫" },
          { value: "pdd", label: "拼多多" },
          { value: "other", label: "其他" },
        ]}
        onDone={async (msg) => {
          setOkMsg(msg);
          setCorrectPart(null);
          try {
            setResult(await suggestBuild(buildPayload()));
          } catch {
            /* keep */
          }
        }}
      />
    </MotionStage>
  );
}
