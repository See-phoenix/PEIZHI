"""Effective price book: verified > catalog, with stale flags."""

from datetime import datetime, timedelta

from app.domain.pricebook import load_price_book
from app.models import Part, VerifiedPrice


def test_verified_price_drives_recommend_and_stale_flag(client, db_session):
    gpu = (
        db_session.query(Part)
        .filter(Part.category == "gpu")
        .order_by(Part.list_price.asc())
        .first()
    )
    assert gpu is not None

    verified_price = max(500.0, float(gpu.list_price) * 0.55)
    now = datetime.utcnow()
    row = VerifiedPrice(
        part_id=gpu.id,
        price=verified_price,
        currency="CNY",
        source_platform="test",
        verified_at=now,
        updated_at=now - timedelta(hours=100),
    )
    db_session.add(row)
    db_session.commit()

    book = load_price_book(db_session, stale_after_hours=72)
    assert book.of(gpu) == verified_price
    q = book.quote(gpu)
    assert q is not None
    assert q.source == "verified"
    assert q.stale is True

    r = client.post(
        "/api/builds/suggest",
        json={
            "budget": 12000,
            "use_case": "gaming_2k",
            "resolution": "1440p",
            "locks": {"gpu": gpu.id},
            "include_live_prices": False,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    item = next(i for i in data["items"] if i["part"]["id"] == gpu.id)
    assert item["effective_price"] == verified_price
    assert item["price_source"] == "verified"
    assert item["price_as_of"] is not None
    assert item["price_stale"] is True
    assert item["price_age_hours"] is not None and item["price_age_hours"] >= 72
    assert any("有效价" in n or "权威价" in n for n in data["notes"])


def test_aggregate_price_includes_as_of(client, db_session):
    part = db_session.query(Part).filter(Part.category == "cpu").first()
    assert part is not None
    r = client.get(f"/api/prices/{part.id}", params={"include_live": "false"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "price_stale" in data
    assert data["effective_source"] in {"verified", "catalog", "live"}
