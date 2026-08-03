from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Part


SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "parts_seed.json"


def seed_parts(db: Session, force: bool = False) -> int:
    if not force and db.query(Part).count() > 0:
        return 0

    raw = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    count = 0
    for item in raw:
        existing = db.get(Part, item["id"])
        if existing:
            existing.category = item["category"]
            existing.name = item["name"]
            existing.brand = item.get("brand", "")
            existing.list_price = float(item["list_price"])
            existing.search_keywords = item.get("search_keywords", item["name"])
            existing.specs = item.get("specs") or {}
        else:
            db.add(
                Part(
                    id=item["id"],
                    category=item["category"],
                    name=item["name"],
                    brand=item.get("brand", ""),
                    list_price=float(item["list_price"]),
                    search_keywords=item.get("search_keywords", item["name"]),
                    specs=item.get("specs") or {},
                )
            )
            count += 1
    db.commit()
    return count
