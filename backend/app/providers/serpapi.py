from __future__ import annotations

from datetime import datetime
from typing import Optional

import httpx

from app.config import get_settings
from app.schemas import LiveOffer


class SerpApiShoppingProvider:
    """B channel: Google Shopping via SerpApi. Degrades gracefully without key."""

    name = "serpapi"

    def __init__(self, api_key: Optional[str] = None, timeout: float = 8.0):
        settings = get_settings()
        self.api_key = (api_key if api_key is not None else settings.serpapi_api_key) or ""
        self.timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self.api_key.strip())

    async def search(self, query: str, num: int = 5) -> tuple[list[LiveOffer], Optional[str]]:
        if not self.configured:
            return [], "SERPAPI_API_KEY 未配置，已跳过实时搜索价"

        params = {
            "engine": "google_shopping",
            "q": query,
            "hl": "zh-CN",
            "gl": "cn",
            "api_key": self.api_key,
            "num": num,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get("https://serpapi.com/search.json", params=params)
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            return [], "实时搜索超时"
        except Exception as exc:  # noqa: BLE001
            return [], f"实时搜索失败: {exc}"

        offers: list[LiveOffer] = []
        now = datetime.utcnow()
        for item in data.get("shopping_results") or []:
            price_raw = item.get("extracted_price")
            if price_raw is None:
                continue
            try:
                price = float(price_raw)
            except (TypeError, ValueError):
                continue
            if price <= 0:
                continue
            offers.append(
                LiveOffer(
                    platform=str(item.get("source") or "shopping"),
                    title=str(item.get("title") or query),
                    price=price,
                    currency="CNY",
                    url=str(item.get("product_link") or item.get("link") or ""),
                    fetched_at=now,
                )
            )
        if not offers:
            return [], "未找到匹配的购物结果"
        return offers, None
