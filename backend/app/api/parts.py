from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Part
from app.schemas import PartOut

router = APIRouter(prefix="/api/parts", tags=["parts"])


@router.get("", response_model=list[PartOut])
def list_parts(
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Part)
    if category:
        query = query.filter(Part.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter((Part.name.like(like)) | (Part.search_keywords.like(like)))
    return query.order_by(Part.category, Part.list_price).all()


@router.get("/{part_id}", response_model=PartOut)
def get_part(part_id: str, db: Session = Depends(get_db)):
    part = db.get(Part, part_id)
    if not part:
        raise HTTPException(status_code=404, detail="配件不存在")
    return part
