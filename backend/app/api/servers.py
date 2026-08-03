from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain.pricing import aggregate_price
from app.domain.servers import suggest_servers
from app.models import Part
from app.providers.catalog_links import buy_links_dict
from app.schemas import PartOut, ServerOfferItem, ServerSuggestRequest, ServerSuggestResponse

router = APIRouter(prefix="/api/servers", tags=["servers"])


@router.get("", response_model=list[PartOut])
def list_servers(
    scene: str | None = Query(None),
    provider: str | None = Query(None),
    db: Session = Depends(get_db),
):
    rows = db.query(Part).filter(Part.category == "server").order_by(Part.list_price).all()
    out: list[Part] = []
    for row in rows:
        specs = row.specs or {}
        if provider and specs.get("provider") != provider:
            continue
        if scene and scene not in (specs.get("scenes") or []):
            continue
        out.append(row)
    return out


@router.post("/suggest", response_model=ServerSuggestResponse)
async def suggest(req: ServerSuggestRequest, db: Session = Depends(get_db)):
    result = suggest_servers(db, req)

    async def to_item(rank: int, part: Part, score: float, reasons: list[str]) -> ServerOfferItem:
        agg = await aggregate_price(db, part, include_live=req.include_live_prices)
        return ServerOfferItem(
            rank=rank,
            score=round(score, 2),
            reasons=reasons,
            part=PartOut.model_validate(part),
            effective_price=agg.effective_price,
            price_source=agg.effective_source,
            price_unit=str((part.specs or {}).get("price_unit") or "CNY/月"),
            buy_links=buy_links_dict(part),
            live_offers=[o.model_dump(mode="json") for o in agg.live_offers],
        )

    primary_item = None
    alt_items: list[ServerOfferItem] = []
    for idx, scored in enumerate(result.scored, start=1):
        item = await to_item(idx, scored.part, scored.score, scored.reasons)
        if idx == 1:
            primary_item = item
        else:
            alt_items.append(item)

    return ServerSuggestResponse(
        primary=primary_item,
        alternatives=alt_items,
        issues=result.issues,
        notes=result.notes,
    )
