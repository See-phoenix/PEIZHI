from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain.balanced import BalancedOption, suggest_balanced_builds
from app.domain.compat import estimate_system_wattage, recommended_psu_wattage, validate_build
from app.domain.pricing import aggregate_price
from app.domain.recommend import SuggestResult, suggest_build
from app.models import Part
from app.providers.catalog_links import buy_links_dict
from app.schemas import (
    BuildOption,
    BuildPartItem,
    PartOut,
    SuggestRequest,
    SuggestResponse,
    ValidateRequest,
    ValidateResponse,
)

router = APIRouter(prefix="/api/builds", tags=["builds"])

_CATEGORY_ORDER = ["cpu", "motherboard", "gpu", "memory", "storage", "cooler", "psu", "case"]


async def _serialize_parts(
    db: Session,
    parts: list[Part],
    include_live: bool,
) -> tuple[list[BuildPartItem], float, float]:
    items: list[BuildPartItem] = []
    total_catalog = 0.0
    total_effective = 0.0
    for part in parts:
        agg = await aggregate_price(db, part, include_live=include_live)
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
    items.sort(key=lambda x: _CATEGORY_ORDER.index(x.category) if x.category in _CATEGORY_ORDER else 99)
    return items, total_catalog, total_effective


async def _option_from_balanced(
    db: Session,
    opt: BalancedOption,
    include_live: bool,
) -> BuildOption:
    items, total_catalog, total_effective = await _serialize_parts(
        db, opt.result.parts, include_live
    )
    return BuildOption(
        label=opt.label,
        score=round(opt.score, 2),
        reasons=opt.reasons,
        items=items,
        total_catalog=round(total_catalog, 2),
        total_effective=round(total_effective, 2),
        estimated_wattage=opt.result.estimated_wattage,
        recommended_psu_wattage=opt.result.recommended_psu_wattage,
        issues=opt.result.issues,
        notes=opt.result.notes,
    )


@router.post("/suggest", response_model=SuggestResponse)
async def suggest(req: SuggestRequest, db: Session = Depends(get_db)):
    # No budget → performance-matched multi-build comparison
    if req.budget is None:
        balanced = suggest_balanced_builds(db, req, limit=req.alternative_limit)
        if not balanced:
            raise HTTPException(status_code=400, detail="无法生成匹配方案，请调整自选配件或用途")
        primary = await _option_from_balanced(db, balanced[0], req.include_live_prices)
        alts = [
            await _option_from_balanced(db, opt, req.include_live_prices) for opt in balanced[1:]
        ]
        return SuggestResponse(
            mode="balanced",
            items=primary.items,
            total_catalog=primary.total_catalog,
            total_effective=primary.total_effective,
            estimated_wattage=primary.estimated_wattage,
            recommended_psu_wattage=primary.recommended_psu_wattage,
            issues=primary.issues,
            notes=[f"主推方案：{primary.label}"] + primary.notes,
            # Full comparison set (primary first) for UI side-by-side
            alternatives=[primary, *alts],
        )

    result: SuggestResult = suggest_build(db, req)
    items, total_catalog, total_effective = await _serialize_parts(
        db, result.parts, req.include_live_prices
    )
    return SuggestResponse(
        mode="budget",
        items=items,
        total_catalog=round(total_catalog, 2),
        total_effective=round(total_effective, 2),
        estimated_wattage=result.estimated_wattage,
        recommended_psu_wattage=result.recommended_psu_wattage,
        issues=result.issues,
        notes=result.notes,
        alternatives=[],
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
