export type UseCase = "office" | "gaming_2k" | "content";
export type Resolution = "1080p" | "1440p" | "4k";

export interface Part {
  id: string;
  category: string;
  name: string;
  brand: string;
  list_price: number;
  search_keywords: string;
  specs: Record<string, unknown>;
}

export interface CompatIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface BuildPartItem {
  category: string;
  part: Part;
  effective_price: number;
  price_source: string;
  buy_links: Record<string, string>;
  live_offers: Array<Record<string, unknown>>;
}

export interface SuggestResponse {
  items: BuildPartItem[];
  total_catalog: number;
  total_effective: number;
  estimated_wattage: number;
  recommended_psu_wattage: number;
  issues: CompatIssue[];
  notes: string[];
}

export interface AggregatedPrice {
  part_id: string;
  part_name: string;
  catalog_price: number;
  verified_price: number | null;
  live_best_price: number | null;
  effective_price: number;
  effective_source: string;
  buy_links: Array<{ platform: string; label: string; url: string }>;
  live_offers: Array<{
    platform: string;
    title: string;
    price: number;
    currency: string;
    url: string;
    fetched_at: string;
  }>;
  live_available: boolean;
  live_error: string | null;
}

export interface CorrectionOut {
  id: number;
  part_id: string;
  price: number;
  status: string;
  needs_manual_review: boolean;
  reject_reason: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function listParts(category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : "";
  return request<Part[]>(`/api/parts${q}`);
}

export function suggestBuild(body: {
  budget: number;
  use_case: UseCase;
  resolution: Resolution;
  lock_gpu_id?: string | null;
  include_live_prices: boolean;
}) {
  return request<SuggestResponse>("/api/builds/suggest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getPartPrices(partId: string, includeLive = true) {
  return request<AggregatedPrice>(
    `/api/prices/${encodeURIComponent(partId)}?include_live=${includeLive}`
  );
}

export function submitCorrection(body: {
  part_id: string;
  price: number;
  source_platform?: string;
  product_url?: string;
  note?: string;
  submitter?: string;
}) {
  return request<CorrectionOut>("/api/prices/corrections", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { API_BASE };
