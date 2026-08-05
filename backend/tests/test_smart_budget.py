"""Smart budget recommender: continuous allocation, not fixed price brackets."""


def _suggest(client, budget: float, use_case: str = "gaming_2k", **extra):
    payload = {
        "budget": budget,
        "use_case": use_case,
        "resolution": "1440p",
        "include_live_prices": False,
        **extra,
    }
    r = client.post("/api/builds/suggest", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def _catalog_total(data: dict) -> float:
    return sum(i["part"]["list_price"] for i in data["items"])


def test_low_budget_stays_near_floor(client):
    """Very low budgets should get a bootable floor, not a random mid-range overshoot."""
    data = _suggest(client, 2800, use_case="office")
    total = _catalog_total(data)
    assert total <= 2800 * 1.12
    cats = {i["category"] for i in data["items"]}
    assert {"cpu", "motherboard", "memory", "storage", "psu", "case"} <= cats
    gpu = next((i for i in data["items"] if i["category"] == "gpu"), None)
    cpu = next(i for i in data["items"] if i["category"] == "cpu")
    if gpu is None:
        assert cpu["part"]["specs"].get("igpu") is True
    else:
        assert gpu["part"]["list_price"] <= 2200


def test_mid_budget_scales_not_bucketed(client):
    """Nearby budgets should produce different totals (continuous), not the same preset."""
    a = _suggest(client, 7777, use_case="gaming_2k")
    b = _suggest(client, 9800, use_case="gaming_2k")
    ta, tb = _catalog_total(a), _catalog_total(b)
    assert ta <= 7777 * 1.05
    assert tb <= 9800 * 1.05
    assert tb >= ta  # higher budget should not recommend a cheaper total
    # Not stuck on identical BOM for different budgets.
    ids_a = {i["part"]["id"] for i in a["items"]}
    ids_b = {i["part"]["id"] for i in b["items"]}
    assert ids_a != ids_b or abs(tb - ta) > 100


def test_high_budget_spends_leftover_on_gpu_or_cpu(client):
    data = _suggest(client, 18000, use_case="gaming_2k")
    total = _catalog_total(data)
    assert total >= 18000 * 0.70
    assert total <= 18000 * 1.05
    gpu = next(i for i in data["items"] if i["category"] == "gpu")
    assert gpu["part"]["list_price"] >= 3000
    assert any("余量" in n or "占用预算" in n for n in data["notes"])


def test_odd_budget_accepted(client):
    data = _suggest(client, 6543, use_case="gaming_2k")
    total = _catalog_total(data)
    assert 6543 * 0.55 <= total <= 6543 * 1.08


def test_gaming_includes_gpu_when_affordable(client):
    data = _suggest(client, 9000, use_case="gaming_2k")
    cats = {i["category"] for i in data["items"]}
    assert "gpu" in cats
    assert _catalog_total(data) <= 9000 * 1.05
