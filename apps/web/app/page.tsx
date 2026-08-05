"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eraser, Lock, ShoppingCart } from "lucide-react";
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
import { NumberTicker } from "@/components/magicui/number-ticker";
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
  const [correctUrl, setCorrectUrl] = useState("");

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await runSuggest();
  }

  return (
    <main className="mx-auto w-full max-w-[1380px] px-4 py-7 sm:px-6 sm:py-9">
      <section className="animate-bay-in mb-8">
        <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-mute)]">
          <span className="led-dot" />
          DIY Parts Bay · {gpuCount} GPU in catalog
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          <span className="text-[var(--color-copper-bright)]">配智</span>
          <span className="text-[var(--color-mute)]"> / </span>
          装机配件台
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-mute)]">
          填预算智能分配，或不填预算按性能匹配多套对比。自选锁定后自动补齐，选型优先权威有效价。
        </p>
        <div className="copper-rule mt-6 max-w-xl" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)_250px]">
        <aside className="animate-bay-in space-y-4 [animation-delay:60ms] lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>需求参数</CardTitle>
              <CardDescription>预算 · 用途 · 分辨率 · 锁定</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
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

                <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-[var(--color-edge)] bg-[var(--color-bay)]/50 p-3">
                  <Checkbox
                    checked={noBudget}
                    onCheckedChange={(v) => setNoBudget(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-[var(--color-mute)]">
                    不填预算 · 按性能匹配多套对比
                  </span>
                </label>

                <div className="space-y-1.5">
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

                <div className="space-y-1.5">
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

                <div className="border-t border-[var(--color-edge)] pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-mute)]">
                      <Lock className="h-3.5 w-3.5" />
                      自选锁定
                    </p>
                    <Badge variant="muted">{lockCount} 项</Badge>
                  </div>
                  <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                    {LOCKABLE.map((cat) => (
                      <div key={cat} className="space-y-1.5">
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

                <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-[var(--color-edge)] bg-[var(--color-bay)]/50 p-3">
                  <Checkbox
                    checked={includeLive}
                    onCheckedChange={(v) => setIncludeLive(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-[var(--color-mute)]">
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

        <section className="animate-bay-in min-w-0 space-y-4 [animation-delay:120ms]">
          {(error || okMsg) && (
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                error
                  ? "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-[#f0b4ae]"
                  : "border-[var(--color-solder)]/35 bg-[var(--color-solder)]/10 text-[#9fd9ce]"
              )}
            >
              {error || okMsg}
            </div>
          )}

          {!result && !loading && (
            <div className="bay-panel bay-sheet flex flex-col items-start justify-center gap-4 rounded-xl px-6 py-16 sm:px-10">
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
                配置单还是空的
              </p>
              <p className="max-w-md text-sm leading-relaxed text-[var(--color-mute)]">
                左侧设定预算或开启无预算匹配，点「生成配置单」后，这里会列出完整 BOM 与购买链接。
              </p>
              <div className="copper-rule w-40" />
            </div>
          )}

          {loading && (
            <Card>
              <CardContent className="space-y-3 py-8">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-md bg-[var(--color-edge)]/40"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {view && !loading && (
            <Card className="overflow-hidden">
              <CardHeader className="space-y-3 border-b border-[var(--color-edge)]">
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
                        className="rounded-md border border-[var(--color-copper)]/15 bg-[var(--color-copper)]/5 px-3 py-1.5 text-xs text-[var(--color-aluminum)]"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </CardHeader>
              <CardContent className="bay-sheet p-0">
                <ul>
                  {view.items.map((item, idx) => {
                    const locked = locks[item.category] === item.part.id;
                    const asOf = formatAsOf(item.price_as_of);
                    return (
                      <li
                        key={item.part.id}
                        className="animate-bay-in flex flex-col gap-3 border-b border-[var(--color-edge)]/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                        style={{ animationDelay: `${80 + idx * 40}ms` }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="price-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
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
                          <p className="truncate font-medium text-[var(--color-ink)]">{item.part.name}</p>
                          <p className="mt-0.5 text-xs text-[var(--color-mute)]">
                            目录 ¥{item.part.list_price}
                            {asOf ? ` · 更新于 ${asOf}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <p className="price-mono text-lg font-semibold text-[var(--color-voltage)]">
                            ¥
                            <NumberTicker
                              value={Math.round(item.effective_price)}
                              className="text-[var(--color-voltage)]"
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
                                  className="inline-flex items-center gap-1 rounded border border-[var(--color-edge)] bg-[var(--color-rail)] px-2 py-1 text-xs text-[var(--color-aluminum)] no-underline hover:border-[var(--color-copper)]/40 hover:text-[var(--color-ink)]"
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
                  className="rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)]/80 px-4 py-2.5 text-sm text-[var(--color-aluminum)]"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="animate-bay-in space-y-4 [animation-delay:180ms] lg:sticky lg:top-24 lg:self-start">
          <Card className="border-[var(--color-copper)]/25">
            <CardHeader>
              <CardTitle className="text-[var(--color-voltage)]">总览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-mute)]">有效总价</p>
                <p className="price-mono mt-1 text-3xl font-bold text-[var(--color-ink)]">
                  ¥
                  {view ? (
                    <NumberTicker value={Math.round(view.total_effective)} className="text-3xl font-bold" />
                  ) : (
                    "—"
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--color-mute)]">
                  目录合计 ¥{view ? Math.round(view.total_catalog) : "—"}
                </p>
                {staleCount > 0 && (
                  <p className="mt-2 text-xs text-[var(--color-warn)]">
                    {staleCount} 项权威价超过 72 小时，建议纠价
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-[var(--color-edge)] bg-[var(--color-bay)]/60 p-3">
                  <p className="text-[11px] text-[var(--color-mute)]">预估功耗</p>
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
                <div className="rounded-md border border-[var(--color-edge)] bg-[var(--color-bay)]/60 p-3">
                  <p className="text-[11px] text-[var(--color-mute)]">建议电源</p>
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
              <p className="text-[10px] tracking-wide text-[var(--color-mute)]">
                API {API_BASE.replace(/^https?:\/\//, "")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-[var(--color-voltage)]" />
                兼容与提示
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!view && (
                <p className="text-sm text-[var(--color-mute)]">生成后显示插座、供电、机箱等兼容问题。</p>
              )}
              {view && view.issues.length === 0 && (
                <p className="rounded-md bg-[var(--color-solder)]/10 px-3 py-2 text-sm text-[var(--color-solder)]">
                  未发现严重兼容问题
                </p>
              )}
              {view && view.issues.length > 0 && (
                <ul className="space-y-2">
                  {view.issues.map((i) => (
                    <li
                      key={`${i.code}-${i.message}`}
                      className={cn(
                        "rounded-md px-3 py-2 text-xs leading-relaxed",
                        i.severity === "error" && "bg-[var(--color-danger)]/15 text-[#f0b4ae]",
                        i.severity === "warning" && "bg-[var(--color-warn)]/15 text-[#f0c4a8]",
                        i.severity === "info" && "bg-[var(--color-solder)]/10 text-[#9fd9ce]"
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
            /* keep previous */
          }
        }}
      />
    </main>
  );
}
