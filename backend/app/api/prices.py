from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.domain.pricing import (
    aggregate_price,
    get_verified_price,
    list_corrections,
    review_correction,
    submit_correction,
)
from app.models import Part, PriceHistory
from app.schemas import (
    AggregatedPrice,
    CorrectionCreate,
    CorrectionOut,
    ReviewAction,
    VerifiedPriceOut,
)

router = APIRouter(prefix="/api/prices", tags=["prices"])


def _require_admin(x_admin_token: Optional[str]) -> None:
    settings = get_settings()
    if not x_admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(status_code=401, detail="需要有效的 X-Admin-Token")


@router.post("/corrections", response_model=CorrectionOut)
def create_correction(payload: CorrectionCreate, db: Session = Depends(get_db)):
    try:
        return submit_correction(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/corrections", response_model=list[CorrectionOut])
def get_corrections(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_token)
    return list_corrections(db, status=status, limit=limit)


@router.post("/corrections/{correction_id}/review", response_model=CorrectionOut)
def review(
    correction_id: int,
    body: ReviewAction,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_token)
    try:
        return review_correction(db, correction_id, body.action, body.reject_reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/verified/{part_id}", response_model=VerifiedPriceOut)
def get_verified(part_id: str, db: Session = Depends(get_db)):
    row = get_verified_price(db, part_id)
    if not row:
        raise HTTPException(status_code=404, detail="暂无权威价")
    return row


@router.get("/history/{part_id}")
def get_history(part_id: str, limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = (
        db.query(PriceHistory)
        .filter(PriceHistory.part_id == part_id)
        .order_by(PriceHistory.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "part_id": r.part_id,
            "price": r.price,
            "currency": r.currency,
            "source": r.source,
            "source_platform": r.source_platform,
            "product_url": r.product_url,
            "recorded_at": r.recorded_at,
        }
        for r in rows
    ]


@router.get("/{part_id}", response_model=AggregatedPrice)
async def get_part_prices(
    part_id: str,
    include_live: bool = Query(True),
    db: Session = Depends(get_db),
):
    part = db.get(Part, part_id)
    if not part:
        raise HTTPException(status_code=404, detail="配件不存在")
    return await aggregate_price(db, part, include_live=include_live)
