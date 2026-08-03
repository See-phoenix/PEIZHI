from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Part
from app.schemas import CompatIssue, ServerSuggestRequest


# Inspired by VPS use-case matrices + EC2 instance-selector filters
SCENE_REQUIREMENTS = {
    "website": {"min_vcpu": 1, "min_memory_gb": 1, "prefer_types": ["lighthouse", "vps"]},
    "app": {"min_vcpu": 2, "min_memory_gb": 2, "prefer_types": ["lighthouse", "cvm", "vps"]},
    "database": {"min_vcpu": 2, "min_memory_gb": 4, "prefer_types": ["cvm", "vps"]},
    "ai": {"min_vcpu": 4, "min_memory_gb": 8, "prefer_types": ["gpu", "cvm"]},
    "overseas": {"min_vcpu": 1, "min_memory_gb": 1, "prefer_types": ["vps"]},
    "dev": {"min_vcpu": 1, "min_memory_gb": 1, "prefer_types": ["lighthouse", "vps"]},
    "budget": {"min_vcpu": 1, "min_memory_gb": 1, "prefer_types": ["lighthouse", "vps"]},
}


@dataclass
class ScoredServer:
    part: Part
    score: float
    reasons: list[str]


@dataclass
class ServerSuggestResult:
    primary: Part | None
    alternatives: list[Part]
    scored: list[ScoredServer]
    issues: list[CompatIssue]
    notes: list[str]


def _score(part: Part, req: ServerSuggestRequest, base_req: dict) -> ScoredServer | None:
    s = part.specs or {}
    vcpu = int(s.get("vcpu") or 0)
    mem = int(s.get("memory_gb") or 0)
    scenes = list(s.get("scenes") or [])
    product_type = str(s.get("product_type") or "")
    price = float(part.list_price)

    reasons: list[str] = []
    if req.scene not in scenes and req.scene != "budget":
        # allow budget to match anything cheap
        if not (req.scene == "overseas" and product_type == "vps"):
            return None

    min_vcpu = max(req.min_vcpu or 0, int(base_req["min_vcpu"]))
    min_mem = max(req.min_memory_gb or 0, int(base_req["min_memory_gb"]))
    if vcpu < min_vcpu or mem < min_mem:
        return None

    if price > req.monthly_budget * 1.05:
        return None

    if req.region_pref == "domestic" and s.get("provider") in {"vultr", "digitalocean", "hetzner", "bandwagon"}:
        return None
    if req.region_pref == "overseas" and s.get("provider") in {"aliyun", "tencent", "huawei"}:
        return None

    if req.providers and s.get("provider") not in req.providers:
        return None

    # value score inspired by instance-selector density
    compute = vcpu * 1.0 + mem * 0.6 + int(s.get("disk_gb") or 0) * 0.01
    value = compute / max(price, 1.0)
    score = value * 100

    prefer = base_req.get("prefer_types") or []
    if product_type in prefer:
        score += 8
        reasons.append(f"产品形态 {product_type} 适合该场景")

    if req.scene in scenes:
        score += 12
        reasons.append(f"覆盖场景：{req.scene}")

    if price <= req.monthly_budget * 0.7:
        score += 5
        reasons.append("预算余量充足")

    if s.get("gpu") and req.scene == "ai":
        score += 20
        reasons.append(f"带 GPU：{s.get('gpu')}")

    if not reasons:
        reasons.append("满足最低规格与预算")

    return ScoredServer(part=part, score=score, reasons=reasons)


def suggest_servers(db: Session, req: ServerSuggestRequest) -> ServerSuggestResult:
    notes: list[str] = []
    issues: list[CompatIssue] = []
    base = SCENE_REQUIREMENTS.get(req.scene, SCENE_REQUIREMENTS["dev"])
    servers = db.query(Part).filter(Part.category == "server").all()

    scored: list[ScoredServer] = []
    for part in servers:
        item = _score(part, req, base)
        if item:
            scored.append(item)

    scored.sort(key=lambda x: x.score, reverse=True)

    if not scored:
        # relax: ignore scene tag, only specs+budget
        notes.append("严格场景匹配无结果，已放宽为仅按规格与预算筛选")
        for part in servers:
            s = part.specs or {}
            if float(part.list_price) > req.monthly_budget * 1.05:
                continue
            if int(s.get("vcpu") or 0) < max(req.min_vcpu or 0, int(base["min_vcpu"])):
                continue
            if int(s.get("memory_gb") or 0) < max(req.min_memory_gb or 0, int(base["min_memory_gb"])):
                continue
            if req.region_pref == "domestic" and s.get("provider") in {"vultr", "digitalocean", "hetzner", "bandwagon"}:
                continue
            if req.region_pref == "overseas" and s.get("provider") in {"aliyun", "tencent", "huawei"}:
                continue
            compute = int(s.get("vcpu") or 0) + int(s.get("memory_gb") or 0) * 0.6
            scored.append(
                ScoredServer(
                    part=part,
                    score=compute / max(float(part.list_price), 1.0) * 100,
                    reasons=["放宽匹配"],
                )
            )
        scored.sort(key=lambda x: x.score, reverse=True)

    if not scored:
        issues.append(
            CompatIssue(
                severity="error",
                code="no_server_match",
                message="没有找到满足预算与规格的服务器套餐，请提高月预算或降低最低配置",
            )
        )
        return ServerSuggestResult(primary=None, alternatives=[], scored=[], issues=issues, notes=notes)

    primary = scored[0].part
    alternatives = [x.part for x in scored[1 : req.limit]]
    notes.append(
        f"选型逻辑参考 EC2 Instance Selector（规格过滤）与 VPS 场景矩阵；主推 {primary.name}"
    )
    notes.append(f"匹配评分最高理由：{'；'.join(scored[0].reasons)}")
    if len(scored) > 1:
        notes.append(f"另提供 {min(len(alternatives), req.limit - 1)} 个备选套餐便于横向对比")

    # soft warnings
    ps = primary.specs or {}
    if req.scene == "ai" and not ps.get("gpu"):
        issues.append(
            CompatIssue(
                severity="warning",
                code="ai_no_gpu",
                message="AI 场景主推方案未含 GPU，仅适合轻量推理/CPU 任务；重度训练请提高预算选 GPU 机型",
            )
        )
    if req.scene in {"website", "app"} and ps.get("provider") in {"vultr", "hetzner", "bandwagon"}:
        issues.append(
            CompatIssue(
                severity="info",
                code="overseas_latency",
                message="境外机房访问中国大陆可能延迟偏高，国内用户建站优先考虑阿里云/腾讯云（需备案场景）",
            )
        )

    return ServerSuggestResult(
        primary=primary,
        alternatives=alternatives,
        scored=scored[: req.limit],
        issues=issues,
        notes=notes,
    )
