from __future__ import annotations

from urllib.parse import quote

from app.models import Part
from app.schemas import SearchLink


PLATFORM_TEMPLATES = {
    "jd": ("京东", "https://search.jd.com/Search?keyword={q}"),
    "tmall": ("天猫", "https://s.taobao.com/search?q={q}"),
    "pdd": ("拼多多", "https://mobile.yangkeduo.com/search_result.html?search_key={q}"),
}

PROVIDER_LABELS = {
    "aliyun": "阿里云官网",
    "tencent": "腾讯云官网",
    "huawei": "华为云官网",
    "vultr": "Vultr",
    "digitalocean": "DigitalOcean",
    "hetzner": "Hetzner",
    "bandwagon": "搬瓦工",
}


def build_search_links(part: Part) -> list[SearchLink]:
    links: list[SearchLink] = []
    specs = part.specs or {}

    # Official / vendor buy link (servers & any part with buy_url)
    buy_url = specs.get("buy_url")
    provider = str(specs.get("provider") or "")
    if buy_url:
        label = PROVIDER_LABELS.get(provider, "官网购买")
        links.append(SearchLink(platform="official", label=label, url=str(buy_url)))

    q = quote(part.search_keywords or part.name)
    # PC parts: shopping search; servers: still useful for reseller/活动检索
    for key, (label, tmpl) in PLATFORM_TEMPLATES.items():
        links.append(SearchLink(platform=key, label=label, url=tmpl.format(q=q)))
    return links


def buy_links_dict(part: Part) -> dict[str, str]:
    return {link.platform: link.url for link in build_search_links(part)}
