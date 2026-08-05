"use client";

import { FormEvent, useState } from "react";
import { Cloud, Gauge, Server } from "lucide-react";
import {
  API_BASE,
  Part,
  RegionPref,
  ServerOfferItem,
  ServerScene,
  ServerSuggestResponse,
  suggestServers,
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

const SCENE_LABEL: Record<ServerScene, string> = {
  website: "建站/博客",
  app: "应用/API",
  database: "数据库",
  ai: "AI/推理",
  overseas: "出海/境外",
  dev: "开发测试",
  budget: "极致省钱",
};

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
  return <p className="mt-1 text-xs text-slate-500">{bits.join(" · ")}</p>;
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
  const [correctUrl, setCorrectUrl] = useState("");

  async function runSuggest() {
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await runSuggest();
  }

  const rows: ServerOfferItem[] = result
    ? ([result.primary, ...result.alternatives].filter(Boolean) as ServerOfferItem[])
    : [];

  const primary = result?.primary;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <BlurFade delay={0.05} className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/80">
            <AnimatedShinyText className="!inline tracking-[0.22em]">Cloud / VPS Desk</AnimatedShinyText>
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            服务器选型台
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            按月预算与场景过滤规格；目录价为参考月费，活动价纠价入库后供各端复用。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex h-2 w-2 rounded-full bg-teal-400 animate-pulse-soft" />
          {API_BASE.replace(/^https?:\/\//, "")}/api/servers
        </div>
      </BlurFade>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)_260px]">
        <BlurFade delay={0.1} className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <ShineBorder shineColor={["#2dd4bf", "#22d3ee", "#5eead4"]} duration={14} />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-teal-300" />
                筛选条件
              </CardTitle>
              <CardDescription>场景矩阵 + 规格下限</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="monthly-budget">月预算（元）</Label>
                  <Input
                    id="monthly-budget"
                    type="number"
                    min={10}
                    max={20000}
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scene">场景</Label>
                  <Select
                    id="scene"
                    value={scene}
                    onChange={(e) => setScene(e.target.value as ServerScene)}
                  >
                    {(Object.keys(SCENE_LABEL) as ServerScene[]).map((k) => (
                      <option key={k} value={k}>
                        {SCENE_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="region">地域偏好</Label>
                  <Select
                    id="region"
                    value={regionPref}
                    onChange={(e) => setRegionPref(e.target.value as RegionPref)}
                  >
                    <option value="any">不限</option>
                    <option value="domestic">国内云优先</option>
                    <option value="overseas">境外 VPS 优先</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="min-vcpu">最低 vCPU</Label>
                    <Input
                      id="min-vcpu"
                      type="number"
                      min={1}
                      value={minVcpu}
                      onChange={(e) => setMinVcpu(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="min-mem">最低内存 GB</Label>
                    <Input
                      id="min-mem"
                      type="number"
                      min={1}
                      value={minMem}
                      onChange={(e) => setMinMem(Number(e.target.value))}
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/5 bg-slate-950/40 p-3">
                  <Checkbox
                    checked={includeLive}
                    onCheckedChange={(v) => setIncludeLive(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-slate-400">拉取 SerpApi 实时搜索价</span>
                </label>
                <Button type="submit" size="lg" className="relative w-full overflow-hidden" disabled={loading}>
                  {loading ? "选型中…" : "生成推荐"}
                  {!loading && (
                    <BorderBeam size={60} duration={5} colorFrom="#ccfbf1" colorTo="#2dd4bf" />
                  )}
                </Button>
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400/10 text-teal-300">
                  <Server className="h-7 w-7" />
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">等待选型结果</h2>
                <p className="max-w-sm text-sm text-slate-400">
                  左侧设好月预算与场景后，这里会列出主推套餐与备选方案。
                </p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="space-y-3 py-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
                ))}
              </CardContent>
            </Card>
          )}

          {result && !loading && (
            <Card>
              <BorderBeam size={120} duration={10} colorFrom="#2dd4bf" colorTo="#99f6e4" />
              <CardHeader className="border-b border-white/5">
                <CardTitle>推荐套餐</CardTitle>
                <CardDescription>{rows.length} 个候选 · 按评分排序</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-white/5">
                  {rows.map((item, idx) => (
                    <BlurFade key={item.part.id} delay={0.05 + idx * 0.05} inView>
                      <li
                        className={cn(
                          "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
                          idx === 0 && "bg-teal-400/[0.04]"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant={idx === 0 ? "verified" : "muted"}>#{item.rank}</Badge>
                            <Badge variant={SOURCE_VARIANT[item.price_source] || "default"}>
                              {SOURCE_LABEL[item.price_source] || item.price_source}
                            </Badge>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Gauge className="h-3 w-3" />
                              评分 {item.score}
                            </span>
                          </div>
                          <p className="font-medium text-slate-100">{item.part.name}</p>
                          <SpecLine part={item.part} />
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                            {item.reasons.join("；")}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <div className="text-right">
                            <p className="price-mono text-lg font-semibold text-teal-200">
                              ¥
                              <NumberTicker
                                value={Math.round(item.effective_price)}
                                className="text-teal-200"
                              />
                            </p>
                            <p className="text-[11px] text-slate-500">{item.price_unit}</p>
                          </div>
                          <div className="flex gap-1.5">
                            {item.buy_links.official && (
                              <a
                                href={item.buy_links.official}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 no-underline hover:bg-white/10"
                              >
                                官网
                              </a>
                            )}
                            {item.buy_links.jd && (
                              <a
                                href={item.buy_links.jd}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 no-underline hover:bg-white/10"
                              >
                                京东搜
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
                              setCorrectUrl(item.buy_links.official || "");
                            }}
                          >
                            纠价
                          </Button>
                        </div>
                      </li>
                    </BlurFade>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result?.notes && result.notes.length > 0 && (
            <ul className="space-y-2">
              {result.notes.map((n) => (
                <li
                  key={n}
                  className="rounded-xl border border-teal-400/20 bg-teal-400/5 px-4 py-2.5 text-sm text-teal-100/90"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </BlurFade>

        <BlurFade delay={0.26} className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="border-teal-400/20 bg-gradient-to-b from-teal-950/40 to-slate-900/70">
            <BorderBeam size={100} duration={8} colorFrom="#2dd4bf" colorTo="#5eead4" />
            <CardHeader>
              <CardTitle>主推方案</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {primary ? (
                <>
                  <p className="text-sm font-medium leading-snug text-slate-100">{primary.part.name}</p>
                  <p className="price-mono text-3xl font-bold text-slate-50">
                    ¥
                    <NumberTicker
                      value={Math.round(primary.effective_price)}
                      className="text-3xl font-bold"
                    />
                    <span className="ml-1 text-sm font-normal text-slate-500">/月</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    评分 <NumberTicker value={primary.score} />
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => runSuggest()}
                    disabled={loading}
                  >
                    刷新推荐
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-500">生成后显示最优套餐摘要。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">提示</CardTitle>
            </CardHeader>
            <CardContent>
              {!result && <p className="text-sm text-slate-500">选型后显示告警与说明。</p>}
              {result && result.issues.length === 0 && (
                <p className="rounded-lg bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">无严重问题</p>
              )}
              {result && result.issues.length > 0 && (
                <ul className="space-y-2">
                  {result.issues.map((i) => (
                    <li
                      key={`${i.code}-${i.message}`}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        i.severity === "error" && "bg-rose-500/15 text-rose-200",
                        i.severity === "warning" && "bg-amber-500/15 text-amber-100",
                        i.severity === "info" && "bg-teal-500/10 text-teal-100"
                      )}
                    >
                      [{i.severity}] {i.message}
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
        priceLabel="实际月费（元）"
        platforms={[
          { value: "official", label: "官网活动价" },
          { value: "aliyun", label: "阿里云" },
          { value: "tencent", label: "腾讯云" },
          { value: "other", label: "其他" },
        ]}
        onDone={async (msg) => {
          setOkMsg(msg);
          setCorrectPart(null);
          try {
            await runSuggest();
          } catch {
            /* keep previous */
          }
        }}
      />
    </main>
  );
}
