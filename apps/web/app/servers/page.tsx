"use client";

import { FormEvent, useEffect, useState } from "react";
import { Gauge, Sparkles } from "lucide-react";
import gsap from "gsap";
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
import { MotionStage } from "@/components/fx/motion-stage";
import { MascotBadge } from "@/components/fx/mascot";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { prefersReducedMotion } from "@/lib/motion";
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
  return <p className="mt-1 text-xs text-[#b7a8c9]">{bits.join(" · ")}</p>;
}

function triggerFlash() {
  if (prefersReducedMotion()) return;
  const el = document.getElementById("acg-flash");
  if (!el) return;
  el.classList.remove("is-on");
  void el.offsetWidth;
  el.classList.add("is-on");
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
  const [speedOn, setSpeedOn] = useState(false);

  const [correctPart, setCorrectPart] = useState<Part | null>(null);
  const [correctPrice, setCorrectPrice] = useState("");
  const [correctUrl, setCorrectUrl] = useState("");

  useEffect(() => {
    if (!result || prefersReducedMotion()) return;
    gsap.fromTo(
      "[data-offer-row]",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: "power2.out" }
    );
  }, [result]);

  async function runSuggest() {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    setSpeedOn(true);
    triggerFlash();
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
      window.setTimeout(() => setSpeedOn(false), 600);
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
    <MotionStage className="mx-auto w-full max-w-[1380px] px-4 py-7 sm:px-6 sm:py-9">
      <div id="acg-flash" className="flash-overlay" />

      <section data-anim="hero" className="relative mb-8">
        <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4de8ff]">
          <Sparkles className="h-3.5 w-3.5 text-[#ff4d9a]" />
          Cloud Neon Rack
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          <span className="bg-gradient-to-r from-[#4de8ff] via-[#a78bfa] to-[#ff4d9a] bg-clip-text text-transparent neon-text">
            配智
          </span>
          <span className="text-white/40"> / </span>
          云主机选型
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#b7a8c9]">
          月预算 × 场景过滤规格；霓虹玻璃卡片展示主推与备选，活动价纠价后各端共用。
        </p>
        <div className="neon-rule mt-6 max-w-xl" />
        <MascotBadge />
      </section>

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)_250px]">
        <aside data-anim="panel" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="preserve-3d">
            {speedOn && (
              <div className="speed-lines">
                <span style={{ top: "30%" }} />
                <span style={{ top: "55%", animationDelay: "50ms" }} />
              </div>
            )}
            <CardHeader>
              <CardTitle>筛选条件</CardTitle>
              <CardDescription>场景 · 地域 · 规格下限</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5" data-anim="item">
                  <Label htmlFor="monthly-budget">月预算（元）</Label>
                  <Input
                    id="monthly-budget"
                    type="number"
                    min={10}
                    max={20000}
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    required
                    className="price-mono"
                  />
                </div>
                <div className="space-y-1.5" data-anim="item">
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
                <div className="space-y-1.5" data-anim="item">
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
                  <div className="space-y-1.5" data-anim="item">
                    <Label htmlFor="min-vcpu">最低 vCPU</Label>
                    <Input
                      id="min-vcpu"
                      type="number"
                      min={1}
                      value={minVcpu}
                      onChange={(e) => setMinVcpu(Number(e.target.value))}
                      className="price-mono"
                    />
                  </div>
                  <div className="space-y-1.5" data-anim="item">
                    <Label htmlFor="min-mem">最低内存 GB</Label>
                    <Input
                      id="min-mem"
                      type="number"
                      min={1}
                      value={minMem}
                      onChange={(e) => setMinMem(Number(e.target.value))}
                      className="price-mono"
                    />
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
                  <span className="text-xs leading-relaxed text-[#b7a8c9]">拉取实时搜索价</span>
                </label>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? "选型中…" : "生成推荐"}
                </Button>
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
            <div className="glass-panel flex flex-col items-start justify-center gap-4 rounded-2xl px-6 py-16 sm:px-10">
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
                机房还在待机
              </p>
              <p className="max-w-md text-sm leading-relaxed text-[#b7a8c9]">
                左侧设好月预算与场景，闪白一击后主推套餐会从星尘里浮现。
              </p>
              <div className="neon-rule w-40" />
            </div>
          )}

          {loading && (
            <Card>
              <CardContent className="space-y-3 py-8">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl bg-gradient-to-r from-[#4de8ff]/10 via-[#a78bfa]/10 to-transparent"
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {result && !loading && (
            <Card>
              <CardHeader className="border-b border-white/10">
                <CardTitle>推荐套餐</CardTitle>
                <CardDescription>{rows.length} 个候选 · 按评分排序</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul>
                  {rows.map((item, idx) => (
                    <li
                      key={item.part.id}
                      data-offer-row
                      className={cn(
                        "flex flex-col gap-3 border-b border-white/8 px-5 py-4 transition hover:-translate-y-0.5 hover:bg-white/[0.04] hover:shadow-[0_0_24px_rgba(77,232,255,0.12)] sm:flex-row sm:items-center sm:justify-between",
                        idx === 0 && "bg-[#ff4d9a]/[0.06]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant={idx === 0 ? "default" : "muted"}>#{item.rank}</Badge>
                          <Badge variant={SOURCE_VARIANT[item.price_source] || "default"}>
                            {SOURCE_LABEL[item.price_source] || item.price_source}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-[#b7a8c9]">
                            <Gauge className="h-3 w-3" />
                            评分 {item.score}
                          </span>
                        </div>
                        <p className="font-medium text-white">{item.part.name}</p>
                        <SpecLine part={item.part} />
                        <p className="mt-1.5 text-xs leading-relaxed text-[#b7a8c9]">
                          {item.reasons.join("；")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <div className="text-right">
                          <p className="price-mono text-lg font-semibold text-[#4de8ff]">
                            ¥
                            <NumberTicker
                              value={Math.round(item.effective_price)}
                              className="text-[#4de8ff]"
                            />
                          </p>
                          <p className="text-[11px] text-[#b7a8c9]">{item.price_unit}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {item.buy_links.official && (
                            <a
                              href={item.buy_links.official}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#d8cef0] no-underline hover:border-[#4de8ff]/40"
                            >
                              官网
                            </a>
                          )}
                          {item.buy_links.jd && (
                            <a
                              href={item.buy_links.jd}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#d8cef0] no-underline hover:border-[#ff4d9a]/40"
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
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#d8cef0]"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside data-anim="panel" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-[#4de8ff]/25 shadow-[0_0_40px_rgba(77,232,255,0.15)]">
            <CardHeader>
              <CardTitle className="text-[#4de8ff]">主推方案</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {primary ? (
                <>
                  <p className="text-sm font-medium leading-snug text-white">{primary.part.name}</p>
                  <p className="price-mono text-3xl font-bold text-white">
                    ¥
                    <NumberTicker
                      value={Math.round(primary.effective_price)}
                      className="text-3xl font-bold"
                    />
                    <span className="ml-1 text-sm font-normal text-[#b7a8c9]">/月</span>
                  </p>
                  <p className="text-xs text-[#b7a8c9]">
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
                <p className="text-sm text-[#b7a8c9]">生成后显示最优套餐摘要。</p>
              )}
              <p className="text-[10px] tracking-wide text-[#b7a8c9]/80">
                {API_BASE.replace(/^https?:\/\//, "")}/api/servers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">提示</CardTitle>
            </CardHeader>
            <CardContent>
              {!result && <p className="text-sm text-[#b7a8c9]">选型后显示告警与说明。</p>}
              {result && result.issues.length === 0 && (
                <p className="rounded-lg bg-[#5dffc2]/10 px-3 py-2 text-sm text-[#5dffc2]">无严重问题</p>
              )}
              {result && result.issues.length > 0 && (
                <ul className="space-y-2">
                  {result.issues.map((i) => (
                    <li
                      key={`${i.code}-${i.message}`}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        i.severity === "error" && "bg-[#ff6b7a]/15 text-[#ffb4bc]",
                        i.severity === "warning" && "bg-[#ffb454]/15 text-[#ffe0b0]",
                        i.severity === "info" && "bg-[#4de8ff]/10 text-[#c8f7ff]"
                      )}
                    >
                      [{i.severity}] {i.message}
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
            /* keep */
          }
        }}
      />
    </MotionStage>
  );
}
