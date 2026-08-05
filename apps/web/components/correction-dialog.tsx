"use client";

import { FormEvent, useEffect, useState } from "react";
import { Part, submitCorrection } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BorderBeam } from "@/components/magicui/border-beam";

type PlatformOption = { value: string; label: string };

export function CorrectionDialog({
  part,
  initialPrice,
  initialUrl,
  platforms,
  priceLabel,
  open,
  onOpenChange,
  onDone,
}: {
  part: Part | null;
  initialPrice: string;
  initialUrl: string;
  platforms: PlatformOption[];
  priceLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (msg: string) => void;
}) {
  const defaultPlatform = platforms[0]?.value || "jd";
  const [price, setPrice] = useState(initialPrice);
  const [platform, setPlatform] = useState(defaultPlatform);
  const [url, setUrl] = useState(initialUrl);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrice(initialPrice);
    setUrl(initialUrl);
    setNote("");
    setPlatform(defaultPlatform);
    setError(null);
  }, [open, part?.id, initialPrice, initialUrl, defaultPlatform]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!part) return;
    setSubmitting(true);
    setError(null);
    try {
      const out = await submitCorrection({
        part_id: part.id,
        price: Number(price),
        source_platform: platform,
        product_url: url || undefined,
        note: note || undefined,
        submitter: "web-user",
      });
      if (out.status === "verified") {
        onDone(`${part.name} 纠价已校验入库（权威价 ¥${out.price}）`);
      } else if (out.status === "pending") {
        onDone("纠价已提交，偏离较大需人工审核后再入库");
      } else {
        onDone(`纠价被拒绝：${out.reject_reason || out.status}`);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "纠价失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden">
        <BorderBeam size={80} duration={8} colorFrom="#22d3ee" colorTo="#2dd4bf" />
        <DialogHeader>
          <DialogTitle>纠价 · {part?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="correct-price">{priceLabel}</Label>
            <Input
              id="correct-price"
              type="number"
              min={1}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correct-platform">平台</Label>
            <Select
              id="correct-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {platforms.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correct-url">商品链接（可选）</Label>
            <Input
              id="correct-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correct-note">备注</Label>
            <textarea
              id="correct-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? "提交中…" : "提交纠价"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
