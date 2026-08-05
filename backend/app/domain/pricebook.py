from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Part, VerifiedPrice


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@dataclass
class PriceQuote:
    part_id: str
    price: float
    source: str  # verified | catalog
    as_of: Optional[datetime] = None
    stale: bool = False
    age_hours: Optional[float] = None


@dataclass
class PriceBook:
    """Effective unit prices for recommendation (verified > catalog). Live is async and applied at display time."""

    quotes: dict[str, PriceQuote] = field(default_factory=dict)
    stale_after_hours: float = 72.0

    def of(self, part: Part | None) -> float:
        if not part:
            return 0.0
        q = self.quotes.get(part.id)
        if q:
            return float(q.price)
        return float(part.list_price)

    def quote(self, part: Part | None) -> Optional[PriceQuote]:
        if not part:
            return None
        return self.quotes.get(part.id)


def load_price_book(db: Session, *, stale_after_hours: float = 72.0) -> PriceBook:
    verified_rows = {v.part_id: v for v in db.query(VerifiedPrice).all()}
    parts = db.query(Part).filter(Part.category != "server").all()
    now = _utc_now()
    book = PriceBook(stale_after_hours=stale_after_hours)
    for part in parts:
        verified = verified_rows.get(part.id)
        if verified is not None:
            as_of = verified.updated_at or verified.verified_at
            age_h = None
            stale = False
            if as_of:
                age_h = max(0.0, (now - as_of).total_seconds() / 3600.0)
                stale = age_h > stale_after_hours
            book.quotes[part.id] = PriceQuote(
                part_id=part.id,
                price=float(verified.price),
                source="verified",
                as_of=as_of,
                stale=stale,
                age_hours=age_h,
            )
        else:
            # Catalog seed has created_at; treat as reference without hard stale flag
            book.quotes[part.id] = PriceQuote(
                part_id=part.id,
                price=float(part.list_price),
                source="catalog",
                as_of=getattr(part, "created_at", None),
                stale=False,
                age_hours=None,
            )
    return book


def summarize_price_book(book: PriceBook) -> dict:
    verified = sum(1 for q in book.quotes.values() if q.source == "verified")
    stale = sum(1 for q in book.quotes.values() if q.stale)
    return {
        "parts": len(book.quotes),
        "verified": verified,
        "catalog": len(book.quotes) - verified,
        "stale_verified": stale,
        "stale_after_hours": book.stale_after_hours,
    }
