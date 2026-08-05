from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


Category = Literal["cpu", "motherboard", "gpu", "memory", "storage", "psu", "cooler", "case", "server"]
UseCase = Literal["office", "gaming_2k", "content"]
Resolution = Literal["1080p", "1440p", "4k"]
ServerScene = Literal["website", "app", "database", "ai", "overseas", "dev", "budget"]
RegionPref = Literal["any", "domestic", "overseas"]


class PartOut(BaseModel):
    id: str
    category: str
    name: str
    brand: str
    list_price: float
    search_keywords: str
    specs: dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class SuggestRequest(BaseModel):
    budget: Optional[float] = Field(
        default=None,
        description="总预算（元）。不传或 null 则进入无预算性能匹配模式，返回多套对比方案",
    )
    use_case: UseCase = "gaming_2k"
    resolution: Resolution = "1440p"
    locks: dict[str, str] = Field(
        default_factory=dict,
        description="自选配件：类别->配件ID，如 {\"gpu\":\"gpu-rx-9070-gre\",\"cpu\":\"cpu-r5-9600x\"}",
    )
    lock_gpu_id: Optional[str] = Field(
        default=None,
        description="兼容旧字段，等价于 locks.gpu",
    )
    include_live_prices: bool = True
    alternative_limit: int = Field(default=3, ge=1, le=5, description="无预算模式下对比方案数量")

    @field_validator("budget")
    @classmethod
    def _budget_range(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if v < 2000 or v > 100000:
            raise ValueError("budget 须在 2000–100000 之间，或不传以启用无预算匹配")
        return v


class BuildPartItem(BaseModel):
    category: str
    part: PartOut
    effective_price: float
    price_source: str  # verified / live / catalog
    price_as_of: Optional[datetime] = None
    price_stale: bool = False
    price_age_hours: Optional[float] = None
    buy_links: dict[str, str] = Field(default_factory=dict)
    live_offers: list[dict[str, Any]] = Field(default_factory=list)


class CompatIssue(BaseModel):
    severity: Literal["error", "warning", "info"]
    code: str
    message: str


class BuildOption(BaseModel):
    label: str
    score: float
    reasons: list[str] = Field(default_factory=list)
    items: list[BuildPartItem]
    total_catalog: float
    total_effective: float
    estimated_wattage: int
    recommended_psu_wattage: int
    issues: list[CompatIssue] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class SuggestResponse(BaseModel):
    mode: Literal["budget", "balanced"] = "budget"
    items: list[BuildPartItem]
    total_catalog: float
    total_effective: float
    estimated_wattage: int
    recommended_psu_wattage: int
    issues: list[CompatIssue]
    notes: list[str] = Field(default_factory=list)
    alternatives: list[BuildOption] = Field(
        default_factory=list,
        description="对比方案列表；无预算模式下降主推外的其它套，有预算时通常为空",
    )


class ValidateRequest(BaseModel):
    part_ids: list[str] = Field(min_length=1)


class ValidateResponse(BaseModel):
    ok: bool
    issues: list[CompatIssue]
    estimated_wattage: int
    recommended_psu_wattage: int
    parts: list[PartOut]


class SearchLink(BaseModel):
    platform: str
    label: str
    url: str


class LiveOffer(BaseModel):
    platform: str
    title: str
    price: float
    currency: str = "CNY"
    url: str
    fetched_at: datetime


class AggregatedPrice(BaseModel):
    part_id: str
    part_name: str
    catalog_price: float
    verified_price: Optional[float] = None
    live_best_price: Optional[float] = None
    effective_price: float
    effective_source: str
    price_as_of: Optional[datetime] = None
    price_stale: bool = False
    price_age_hours: Optional[float] = None
    buy_links: list[SearchLink]
    live_offers: list[LiveOffer] = Field(default_factory=list)
    live_available: bool = False
    live_error: Optional[str] = None


class CorrectionCreate(BaseModel):
    part_id: str
    price: float = Field(gt=0)
    currency: str = "CNY"
    source_platform: Optional[str] = None
    product_url: Optional[str] = None
    note: Optional[str] = None
    submitter: str = "anonymous"
    force_review: bool = False


class CorrectionOut(BaseModel):
    id: int
    part_id: str
    price: float
    currency: str
    source_platform: Optional[str]
    product_url: Optional[str]
    note: Optional[str]
    submitter: str
    status: str
    reject_reason: Optional[str]
    needs_manual_review: bool
    created_at: datetime
    reviewed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ReviewAction(BaseModel):
    action: Literal["verify", "reject"]
    reject_reason: Optional[str] = None


class VerifiedPriceOut(BaseModel):
    part_id: str
    price: float
    currency: str
    source_platform: Optional[str]
    product_url: Optional[str]
    note: Optional[str]
    verified_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HealthOut(BaseModel):
    status: str
    version: str
    serpapi_configured: bool


class ServerSuggestRequest(BaseModel):
    monthly_budget: float = Field(ge=10, le=20000, description="月预算（元）")
    scene: ServerScene = "website"
    region_pref: RegionPref = "any"
    min_vcpu: Optional[int] = Field(default=None, ge=1)
    min_memory_gb: Optional[int] = Field(default=None, ge=1)
    providers: Optional[list[str]] = None
    limit: int = Field(default=5, ge=1, le=20)
    include_live_prices: bool = False


class ServerOfferItem(BaseModel):
    rank: int
    score: float
    reasons: list[str] = Field(default_factory=list)
    part: PartOut
    effective_price: float
    price_source: str
    price_unit: str = "CNY/月"
    buy_links: dict[str, str] = Field(default_factory=dict)
    live_offers: list[dict[str, Any]] = Field(default_factory=list)


class ServerSuggestResponse(BaseModel):
    primary: Optional[ServerOfferItem] = None
    alternatives: list[ServerOfferItem] = Field(default_factory=list)
    issues: list[CompatIssue] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
