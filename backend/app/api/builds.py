from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain.compat import estimate_system_wattage, recommended_psu_wattage, validate_build
from app.domain.pricing import aggregate_price
from app.domain.recommend import suggest_build
from app.models import Part
from app.providers.catalog_links import buy_links_dict
from app.schemas import (
    BuildPartItem,
    PartOut,
    SuggestRequest,
    SuggestResponse,
    ValidateRequest,
    ValidateResponse,
)

router = APIRouter(prefix="/api/builds", tags=["builds"])


@router.post("/suggest", response_model=SuggestResponse)
async def suggest(req: SuggestRequest, db: Session = Depends(get_db)):
    result = suggest_build(db, req)
    items: list[BuildPartItem] = []
    total_catalog = 0.0
    total_effective = 0.0

    for part in result.parts:
        agg = await aggregate_price(db, part, include_live=req.include_live_prices)
        total_catalog += part.list_price
        total_effective += agg.effective_price
        items.append(
            BuildPartItem(
                category=part.category,
                part=PartOut.model_validate(part),
                effective_price=agg.effective_price,
                price_source=agg.effective_source,
                buy_links=buy_links_dict(part),
                live_offers=[o.model_dump(mode="json") for o in agg.live_offers],
            )
        )

    # stable category order
    order = ["cpu", "motherboard", "gpu", "memory", "storage", "cooler", "psu", "case"]
    items.sort(key=lambda x: order.index(x.category) if x.category in order else 99)

    return SuggestResponse(
        items=items,
        total_catalog=round(total_catalog, 2),
        total_effective=round(total_effective, 2),
        estimated_wattage=result.estimated_wattage,
        recommended_psu_wattage=result.recommended_psu_wattage,
        issues=result.issues,
        notes=result.notes,
    )


@router.post("/validate", response_model=ValidateResponse)
def validate(req: ValidateRequest, db: Session = Depends(get_db)):
    parts: list[Part] = []
    for pid in req.part_ids:
        part = db.get(Part, pid)
        if not part:
            raise HTTPException(status_code=404, detail=f"配件不存在: {pid}")
        parts.append(part)

    issues = validate_build(parts)
    watt = estimate_system_wattage(parts)
    ok = not any(i.severity == "error" for i in issues)
    return ValidateResponse(
        ok=ok,
        issues=issues,
        estimated_wattage=watt,
        recommended_psu_wattage=recommended_psu_wattage(watt),
        parts=[PartOut.model_validate(p) for p in parts],
    )
