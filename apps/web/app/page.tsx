"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cpu,
  Eraser,
  Lock,
  ShoppingCart,
  Sparkles,
  Zap,
} from "lucide-react";
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
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { BlurFade } from "@/components/magicui/blur-fade";
import { BorderBeam } from "@/components/magicui/border-beam";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { ShineBorder } from "@/components/magicui/shine-border";
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
    if (alts) {
      return alts[Math.min(activeAlt, alts.length - 1)];
    }
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
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <BlurFade delay={0.05} className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400/80">
            <AnimatedShinyText className="!inline tracking-[0.22em]">PC Builder Desk</AnimatedShinyText>
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            装机工作台
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            可填预算智能分配，也可不填预算按性能匹配出多套对比。自选锁定后自动补齐并兼容校验。目录含{" "}
            <span className="text-cyan-300">{gpuCount}</span> 款显卡；选型使用权威价优先的有效价。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
          API {API_BASE.replace(/^https?:\/\//, "")}
        </div>
      </BlurFade>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)_260px]">
        <BlurFade delay={0.1} className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <ShineBorder shineColor={["#22d3ee", "#2dd4bf", "#67e8f9"]} duration={14} />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                需求参数
              </CardTitle>
              <CardDescription>预算、用途、分辨率决定自动选型权重</CardDescription>
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
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/5 bg-slate-950/40 p-3">
                  <Checkbox
                    checked={noBudget}
                    onCheckedChange={(v) => setNoBudget(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-slate-400">
                    不填预算 · 按性能匹配出多套对比（防严重拖后腿）
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

                <div className="border-t border-white/5 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      <Lock className="h-3.5 w-3.5" />
                      自选锁定
                    </p>
                    <Badge variant="muted">{lockCount} 项</Badge>
                  </div>
                  <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
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

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/5 bg-slate-950/40 p-3">
                  <Checkbox
                    checked={includeLive}
                    onCheckedChange={(v) => setIncludeLive(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-slate-400">
                    拉取 SerpApi 实时搜索价（需后端配置 KEY）
                  </span>
                </label>

                <div className="flex flex-col gap-2">
                  <Button type="submit" size="lg" disabled={loading} className="relative w-full overflow-hidden">
                    {loading ? "生成中…" : "生成配置单"}
                    {!loading && (
                      <BorderBeam size={60} duration={5} colorFrom="#ecfeff" colorTo="#22d3ee" borderWidth={1.5} />
                    )}
                  </Button>
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setLocks({})}>
                    <Eraser className="h-3.5 w-3.5" />
                    清空自选
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </BlurFade>

        <BlurFade delay={0.18} className="min-w-0 space-y-4">
          {(error || okMsg) && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                error
                  ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                  : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              )}
            >
              {error || okMsg}
            </div>
          )}

          {!result && !loading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                  <Cpu className="h-7 w-7" />
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-100">
                  还没有配置单
                </h2>
                <p className="max-w-sm text-sm text-slate-400">
                  在左侧设定预算或开启无预算匹配，点击「生成配置单」后，这里会列出完整 BOM。
                </p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="space-y-3 py-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
                ))}
              </CardContent>
            </Card>
          )}

          {view && !loading && (
            <Card>
              <BorderBeam size={120} duration={10} delay={2} colorFrom="#22d3ee" colorTo="#67e8f9" />
              <CardHeader className="space-y-3 border-b border-white/5">
                <div className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>配置清单</CardTitle>
                    <CardDescription>
                      {view.items.length} 个配件 · {view.label}
                      {result?.mode === "balanced" ? " · 无预算匹配" : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="default">BOM</Badge>
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
                        <span className="opacity-80">· ¥{Math.round(alt.total_effective)}</span>
                      </Button>
                    ))}
                  </div>
                )}
                {view.reasons.length > 0 && (
                  <ul className="space-y-1.5">
                    {view.reasons.map((r) => (
                      <li key={r} className="rounded-lg bg-cyan-400/5 px-3 py-1.5 text-xs text-cyan-100/90">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-white/5">
                  {view.items.map((item, idx) => {
                    const locked = locks[item.category] === item.part.id;
                    const asOf = formatAsOf(item.price_as_of);
                    return (
                      <BlurFade key={item.part.id} delay={0.05 + idx * 0.04} inView>
                        <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {CATEGORY_LABEL[item.category] || item.category}
                              </span>
                              {locked && <Badge variant="locked">自选锁定</Badge>}
                              <Badge variant={SOURCE_VARIANT[item.price_source] || "default"}>
                                {SOURCE_LABEL[item.price_source] || item.price_source}
                              </Badge>
                              {item.price_stale && (
                                <Badge variant="stale">
                                  价已过期
                                  {item.price_age_hours != null ? ` · ${Math.round(item.price_age_hours)}h` : ""}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate font-medium text-slate-100">{item.part.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              目录参考 ¥{item.part.list_price}
                              {asOf ? ` · 更新于 ${asOf}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                            <p className="price-mono text-lg font-semibold text-cyan-200">
                              ¥
                              <NumberTicker value={Math.round(item.effective_price)} className="text-cyan-200" />
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.buy_links.jd && (
                                <a
                                  href={item.buy_links.jd}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 no-underline hover:bg-white/10 hover:text-white"
                                >
                                  <ShoppingCart className="h-3 w-3" />
                                  京东
                                </a>
                              )}
                              {item.buy_links.tmall && (
                                <a
                                  href={item.buy_links.tmall}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 no-underline hover:bg-white/10 hover:text-white"
                                >
                                  天猫
                                </a>
                              )}
                              {item.buy_links.pdd && (
                                <a
                                  href={item.buy_links.pdd}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 no-underline hover:bg-white/10 hover:text-white"
                                >
                                  拼多多
                                </a>
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
                      </BlurFade>
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
                  className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-sm text-cyan-100/90"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </BlurFade>

        <BlurFade delay={0.26} className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="border-cyan-400/20 bg-gradient-to-b from-cyan-950/40 to-slate-900/70">
            <BorderBeam size={100} duration={8} colorFrom="#22d3ee" colorTo="#2dd4bf" />
            <BorderBeam
              size={100}
              duration={8}
              delay={4}
              reverse
              colorFrom="#67e8f9"
              colorTo="#a5f3fc"
            />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-300" />
                总览
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">有效总价</p>
                <p className="price-mono mt-1 text-3xl font-bold text-slate-50">
                  ¥
                  {view ? (
                    <NumberTicker value={Math.round(view.total_effective)} className="text-3xl font-bold" />
                  ) : (
                    "—"
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  目录合计 ¥{view ? Math.round(view.total_catalog) : "—"}
                </p>
                {staleCount > 0 && (
                  <p className="mt-2 text-xs text-orange-300">
                    {staleCount} 项权威价超过 72 小时，建议纠价更新
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-950/50 p-3">
                  <p className="text-[11px] text-slate-500">预估功耗</p>
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
                <div className="rounded-xl bg-slate-950/50 p-3">
                  <p className="text-[11px] text-slate-500">建议电源</p>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                兼容与提示
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!view && (
                <p className="text-sm text-slate-500">生成后显示插座、供电、机箱等兼容问题。</p>
              )}
              {view && view.issues.length === 0 && (
                <p className="rounded-lg bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
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
                        i.severity === "error" && "bg-rose-500/15 text-rose-200",
                        i.severity === "warning" && "bg-amber-500/15 text-amber-100",
                        i.severity === "info" && "bg-cyan-500/10 text-cyan-100"
                      )}
                    >
                      <span className="font-semibold uppercase">[{i.severity}]</span> {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </BlurFade>
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
            const data = await suggestBuild(buildPayload());
            setResult(data);
          } catch {
            /* keep previous result */
          }
        }}
      />
    </main>
  );
}
