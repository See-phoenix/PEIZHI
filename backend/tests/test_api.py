def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["serpapi_configured"] is False


def test_list_parts(client):
    r = client.get("/api/parts")
    assert r.status_code == 200
    parts = r.json()
    assert len(parts) >= 10
    assert any(p["id"] == "gpu-rx-9070-gre" for p in parts)


def test_suggest_with_locked_gpu(client):
    r = client.post(
        "/api/builds/suggest",
        json={
            "budget": 9000,
            "use_case": "gaming_2k",
            "resolution": "1440p",
            "locks": {"gpu": "gpu-rx-9070-gre"},
            "include_live_prices": False,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_effective"] > 0
    gpu = next(i for i in data["items"] if i["category"] == "gpu")
    assert gpu["part"]["id"] == "gpu-rx-9070-gre"
    assert not any(i["severity"] == "error" for i in data["issues"])


def test_gpu_catalog_expanded(client):
    r = client.get("/api/parts?category=gpu")
    assert r.status_code == 200
    gpus = r.json()
    assert len(gpus) >= 20


def test_suggest_with_multi_locks(client):
    r = client.post(
        "/api/builds/suggest",
        json={
            "budget": 12000,
            "use_case": "gaming_2k",
            "resolution": "1440p",
            "locks": {
                "cpu": "cpu-r7-9800x3d",
                "gpu": "gpu-rtx-5070",
                "memory": "ram-32g-6000",
            },
            "include_live_prices": False,
        },
    )
    assert r.status_code == 200
    data = r.json()
    by_cat = {i["category"]: i["part"]["id"] for i in data["items"]}
    assert by_cat["cpu"] == "cpu-r7-9800x3d"
    assert by_cat["gpu"] == "gpu-rtx-5070"
    assert by_cat["memory"] == "ram-32g-6000"
    assert any("已自选" in n for n in data["notes"])


def test_validate_socket_mismatch(client):
    r = client.post(
        "/api/builds/validate",
        json={"part_ids": ["cpu-r5-9600x", "mb-b760m-mortar"]},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is False
    assert any(i["code"] == "socket_mismatch" for i in data["issues"])


def test_price_correction_auto_verify(client):
    # Within 40% of catalog 3199 -> 3000 should auto-verify
    r = client.post(
        "/api/prices/corrections",
        json={
            "part_id": "gpu-rx-9070-gre",
            "price": 3000,
            "source_platform": "jd",
            "product_url": "https://item.jd.com/example.html",
            "note": "自营到手价",
            "submitter": "tester",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "verified"

    verified = client.get("/api/prices/verified/gpu-rx-9070-gre")
    assert verified.status_code == 200
    assert verified.json()["price"] == 3000

    agg = client.get("/api/prices/gpu-rx-9070-gre?include_live=false")
    assert agg.status_code == 200
    body = agg.json()
    assert body["effective_source"] == "verified"
    assert body["effective_price"] == 3000
    assert len(body["buy_links"]) >= 3


def test_price_correction_needs_review(client):
    # Large but not absurd deviation -> pending + needs_manual_review
    r = client.post(
        "/api/prices/corrections",
        json={
            "part_id": "cpu-r5-9600x",
            "price": 900,
            "submitter": "tester2",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "pending"
    assert data["needs_manual_review"] is True

    # Admin verifies
    rev = client.post(
        f"/api/prices/corrections/{data['id']}/review",
        json={"action": "verify"},
        headers={"X-Admin-Token": "test-admin"},
    )
    assert rev.status_code == 200
    assert rev.json()["status"] == "verified"


def test_price_correction_reject_outlier(client):
    r = client.post(
        "/api/prices/corrections",
        json={"part_id": "gpu-rx-9070-gre", "price": 50, "submitter": "bot"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


def test_list_servers(client):
    r = client.get("/api/servers")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 5
    assert all(p["category"] == "server" for p in rows)


def test_suggest_servers_website_domestic(client):
    r = client.post(
        "/api/servers/suggest",
        json={
            "monthly_budget": 100,
            "scene": "website",
            "region_pref": "domestic",
            "include_live_prices": False,
            "limit": 5,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["primary"] is not None
    assert data["primary"]["part"]["category"] == "server"
    assert data["primary"]["effective_price"] <= 100 * 1.05
    provider = data["primary"]["part"]["specs"]["provider"]
    assert provider in {"aliyun", "tencent", "huawei"}
    assert "official" in data["primary"]["buy_links"]


def test_suggest_servers_ai_warns_without_gpu_budget(client):
    r = client.post(
        "/api/servers/suggest",
        json={
            "monthly_budget": 300,
            "scene": "ai",
            "region_pref": "domestic",
            "include_live_prices": False,
        },
    )
    assert r.status_code == 200
    data = r.json()
    # low budget AI may match CPU CVM and warn
    assert data["primary"] is not None or any(i["code"] == "no_server_match" for i in data["issues"])
