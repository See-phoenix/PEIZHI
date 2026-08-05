"""No-budget balanced multi-build recommendations."""


def test_suggest_without_budget_returns_alternatives(client):
    r = client.post(
        "/api/builds/suggest",
        json={
            "budget": None,
            "use_case": "gaming_2k",
            "resolution": "1440p",
            "locks": {},
            "include_live_prices": False,
            "alternative_limit": 3,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["mode"] == "balanced"
    assert len(data["items"]) >= 5
    assert len(data["alternatives"]) >= 2
    labels = {a["label"] for a in data["alternatives"]}
    assert len(labels) >= 2
    # Each option should include CPU; gaming should usually include GPU
    for alt in data["alternatives"]:
        cats = {i["category"] for i in alt["items"]}
        assert "cpu" in cats
        assert alt["total_catalog"] > 0
        assert "score" in alt


def test_suggest_without_budget_with_locked_gpu(client):
    r = client.post(
        "/api/builds/suggest",
        json={
            "use_case": "gaming_2k",
            "resolution": "1440p",
            "locks": {"gpu": "gpu-rx-9070-gre"},
            "include_live_prices": False,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["mode"] == "balanced"
    for alt in data["alternatives"]:
        gpu = next(i for i in alt["items"] if i["category"] == "gpu")
        assert gpu["part"]["id"] == "gpu-rx-9070-gre"
        cpu = next(i for i in alt["items"] if i["category"] == "cpu")
        # Should not pair GRE with only a tiny unmatched APU if better exists —
        # at least ensure a CPU is present and build is valid.
        assert cpu["part"]["id"]


def test_suggest_omitted_budget_field_is_balanced(client):
    r = client.post(
        "/api/builds/suggest",
        json={
            "use_case": "office",
            "resolution": "1080p",
            "include_live_prices": False,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["mode"] == "balanced"
