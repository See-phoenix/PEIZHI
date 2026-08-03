from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Part, PriceCorrection, PriceHistory, VerifiedPrice
from app.providers.catalog_links import build_search_links
from app.providers.serpapi import SerpApiShoppingProvider
from app.schemas import AggregatedPrice, CorrectionCreate, CorrectionOut


def get_verified_price(db: Session, part_id: str) -> Optional[VerifiedPrice]:
    return db.query(VerifiedPrice).filter(VerifiedPrice.part_id == part_id).one_or_none()


async def aggregate_price(
    db: Session,
    part: Part,
    include_live: bool = True,
    provider: Optional[SerpApiShoppingProvider] = None,
) -> AggregatedPrice:
    verified = get_verified_price(db, part.id)
    buy_links = build_search_links(part)
    live_offers = []
    live_error = None
    live_available = False

    if include_live:
        provider = provider or SerpApiShoppingProvider()
        live_offers, live_error = await provider.search(part.search_keywords or part.name)
        live_available = bool(live_offers)

    live_best = min((o.price for o in live_offers), default=None)

    if verified is not None:
        effective = verified.price
        source = "verified"
    elif live_best is not None:
        effective = live_best
        source = "live"
    else:
        effective = part.list_price
        source = "catalog"

    return AggregatedPrice(
        part_id=part.id,
        part_name=part.name,
        catalog_price=part.list_price,
        verified_price=verified.price if verified else None,
        live_best_price=live_best,
        effective_price=effective,
        effective_source=source,
        buy_links=buy_links,
        live_offers=live_offers,
        live_available=live_available,
        live_error=live_error,
    )


def _deviation(price: float, reference: float) -> float:
    if reference <= 0:
        return 1.0
    return abs(price - reference) / reference


def submit_correction(db: Session, payload: CorrectionCreate) -> CorrectionOut:
    settings = get_settings()
    part = db.get(Part, payload.part_id)
    if not part:
        raise ValueError("配件不存在")

    if payload.price <= 0:
        raise ValueError("价格必须大于 0")

    # Dedupe: same part+price+submitter within 24h
    since = datetime.utcnow() - timedelta(hours=24)
    existing = (
        db.query(PriceCorrection)
        .filter(
            PriceCorrection.part_id == payload.part_id,
            PriceCorrection.price == payload.price,
            PriceCorrection.submitter == payload.submitter,
            PriceCorrection.created_at >= since,
        )
        .order_by(PriceCorrection.created_at.desc())
        .first()
    )
    if existing:
        return CorrectionOut(
            id=existing.id,
            part_id=existing.part_id,
            price=existing.price,
            currency=existing.currency,
            source_platform=existing.source_platform,
            product_url=existing.product_url,
            note=existing.note,
            submitter=existing.submitter,
            status=existing.status,
            reject_reason=existing.reject_reason,
            needs_manual_review=bool(existing.needs_manual_review),
            created_at=existing.created_at,
            reviewed_at=existing.reviewed_at,
        )

    verified = get_verified_price(db, part.id)
    reference = verified.price if verified else part.list_price
    deviation = _deviation(payload.price, reference)
    threshold = settings.price_auto_verify_threshold

    needs_manual = 1 if (payload.force_review or deviation > threshold) else 0
    # Hard reject absurd outliers (> 3x or < 0.2x catalog)
    if payload.price > part.list_price * 3 or payload.price < part.list_price * 0.2:
        row = PriceCorrection(
            part_id=payload.part_id,
            price=payload.price,
            currency=payload.currency,
            source_platform=payload.source_platform,
            product_url=payload.product_url,
            note=payload.note,
            submitter=payload.submitter,
            status="rejected",
            reject_reason="价格相对目录价偏离过大，已自动拒绝",
            needs_manual_review=1,
            reviewed_at=datetime.utcnow(),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _to_out(row)

    row = PriceCorrection(
        part_id=payload.part_id,
        price=payload.price,
        currency=payload.currency,
        source_platform=payload.source_platform,
        product_url=payload.product_url,
        note=payload.note,
        submitter=payload.submitter,
        status="pending",
        needs_manual_review=needs_manual,
    )
    db.add(row)
    db.flush()

    if needs_manual == 0:
        _apply_verified(db, row)
    else:
        db.commit()
        db.refresh(row)

    return _to_out(row)


def _apply_verified(db: Session, correction: PriceCorrection) -> None:
    now = datetime.utcnow()
    correction.status = "verified"
    correction.reviewed_at = now
    correction.needs_manual_review = 0

    existing = get_verified_price(db, correction.part_id)
    if existing:
        existing.price = correction.price
        existing.currency = correction.currency
        existing.source_platform = correction.source_platform
        existing.product_url = correction.product_url
        existing.note = correction.note
        existing.updated_at = now
    else:
        db.add(
            VerifiedPrice(
                part_id=correction.part_id,
                price=correction.price,
                currency=correction.currency,
                source_platform=correction.source_platform,
                product_url=correction.product_url,
                note=correction.note,
                verified_at=now,
                updated_at=now,
            )
        )

    db.add(
        PriceHistory(
            part_id=correction.part_id,
            price=correction.price,
            currency=correction.currency,
            source="correction",
            source_platform=correction.source_platform,
            product_url=correction.product_url,
            recorded_at=now,
        )
    )
    db.commit()
    db.refresh(correction)


def review_correction(
    db: Session,
    correction_id: int,
    action: str,
    reject_reason: Optional[str] = None,
) -> CorrectionOut:
    row = db.get(PriceCorrection, correction_id)
    if not row:
        raise ValueError("纠价记录不存在")
    if row.status != "pending":
        raise ValueError("仅待审记录可审核")

    if action == "reject":
        row.status = "rejected"
        row.reject_reason = reject_reason or "管理员拒绝"
        row.reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
        return _to_out(row)

    if action == "verify":
        _apply_verified(db, row)
        return _to_out(row)

    raise ValueError("未知审核动作")


def _to_out(row: PriceCorrection) -> CorrectionOut:
    return CorrectionOut(
        id=row.id,
        part_id=row.part_id,
        price=row.price,
        currency=row.currency,
        source_platform=row.source_platform,
        product_url=row.product_url,
        note=row.note,
        submitter=row.submitter,
        status=row.status,
        reject_reason=row.reject_reason,
        needs_manual_review=bool(row.needs_manual_review),
        created_at=row.created_at,
        reviewed_at=row.reviewed_at,
    )


def list_corrections(
    db: Session,
    status: Optional[str] = None,
    limit: int = 50,
) -> list[CorrectionOut]:
    q = db.query(PriceCorrection).order_by(PriceCorrection.created_at.desc())
    if status:
        q = q.filter(PriceCorrection.status == status)
    rows = q.limit(limit).all()
    return [_to_out(r) for r in rows]
