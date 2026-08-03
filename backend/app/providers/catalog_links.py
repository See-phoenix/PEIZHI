from __future__ import annotations

from urllib.parse import quote

from app.models import Part
from app.schemas import SearchLink


PLATFORM_TEMPLATES = {
    "jd": ("京东", "https://search.jd.com/Search?keyword={q}"),
    "tmall": ("天猫", "https://s.taobao.com/search?q={q}"),
    "pdd": ("拼多多", "https://mobile.yangkeduo.com/search_result.html?search_key={q}"),
}


def build_search_links(part: Part) -> list[SearchLink]:
    q = quote(part.search_keywords or part.name)
    links: list[SearchLink] = []
    for key, (label, tmpl) in PLATFORM_TEMPLATES.items():
        links.append(SearchLink(platform=key, label=label, url=tmpl.format(q=q)))
    return links


def buy_links_dict(part: Part) -> dict[str, str]:
    return {link.platform: link.url for link in build_search_links(part)}
