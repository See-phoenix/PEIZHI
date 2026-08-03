from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Part


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SEED_FILES = [
    DATA_DIR / "parts_seed.json",
    DATA_DIR / "servers_seed.json",
]


def _upsert_items(db: Session, raw: list[dict]) -> int:
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
    return count


def seed_parts(db: Session, force: bool = False) -> int:
    """Seed PC parts + server plans. force=True refreshes all known seed IDs."""
    if not force and db.query(Part).count() > 0:
        # Still merge newly added seed IDs (e.g. servers added later)
        inserted = 0
        for path in SEED_FILES:
            if not path.exists():
                continue
            raw = json.loads(path.read_text(encoding="utf-8"))
            for item in raw:
                if db.get(Part, item["id"]) is None:
                    inserted += _upsert_items(db, [item])
        if inserted:
            db.commit()
        return inserted

    inserted = 0
    for path in SEED_FILES:
        if not path.exists():
            continue
        raw = json.loads(path.read_text(encoding="utf-8"))
        inserted += _upsert_items(db, raw)
    db.commit()
    return inserted
