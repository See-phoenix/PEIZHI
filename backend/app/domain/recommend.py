from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.domain.compat import estimate_system_wattage, recommended_psu_wattage, validate_build
from app.models import Part
from app.schemas import CompatIssue, SuggestRequest


CATEGORIES = ["cpu", "motherboard", "gpu", "memory", "storage", "cooler", "psu", "case"]

BUDGET_WEIGHTS = {
    "office": {
        "cpu": 0.22,
        "motherboard": 0.12,
        "gpu": 0.18,
        "memory": 0.12,
        "storage": 0.12,
        "psu": 0.08,
        "cooler": 0.05,
        "case": 0.11,
    },
    "gaming_2k": {
        "cpu": 0.16,
        "motherboard": 0.12,
        "gpu": 0.38,
        "memory": 0.08,
        "storage": 0.07,
        "psu": 0.08,
        "cooler": 0.04,
        "case": 0.07,
    },
    "content": {
        "cpu": 0.24,
        "motherboard": 0.12,
        "gpu": 0.28,
        "memory": 0.12,
        "storage": 0.10,
        "psu": 0.06,
        "cooler": 0.04,
        "case": 0.04,
    },
}


@dataclass
class SuggestResult:
    parts: list[Part]
    issues: list[CompatIssue]
    notes: list[str]
    estimated_wattage: int
    recommended_psu_wattage: int


def _pick_best(candidates: list[Part], budget: float) -> Part | None:
    affordable = [p for p in candidates if p.list_price <= budget * 1.08]
    pool = affordable or candidates
    if not pool:
        return None
    under = [p for p in pool if p.list_price <= budget]
    if under:
        return max(
            under,
            key=lambda p: (
                p.list_price,
                p.specs.get("tier", 0) if isinstance(p.specs.get("tier"), int) else 0,
            ),
        )
    return min(pool, key=lambda p: p.list_price)


def _parts_by_category(db: Session, category: str) -> list[Part]:
    return db.query(Part).filter(Part.category == category).all()


def _resolve_locks(db: Session, req: SuggestRequest, notes: list[str]) -> dict[str, Part]:
    locks: dict[str, str] = dict(req.locks or {})
    if req.lock_gpu_id:
        locks.setdefault("gpu", req.lock_gpu_id)

    selected: dict[str, Part] = {}
    for category, part_id in locks.items():
        if not part_id or category not in CATEGORIES:
            continue
        part = db.get(Part, part_id)
        if not part:
            notes.append(f"自选配件无效：{category}/{part_id}")
            continue
        if part.category != category:
            notes.append(f"自选配件类别不匹配：期望 {category}，实为 {part.category}")
            continue
        selected[category] = part
        notes.append(f"已自选{category}：{part.name}")
    return selected


def suggest_build(db: Session, req: SuggestRequest) -> SuggestResult:
    notes: list[str] = []
    weights = BUDGET_WEIGHTS[req.use_case]
    budgets = {k: req.budget * v for k, v in weights.items()}

    selected = _resolve_locks(db, req, notes)
    locked_cats = set(selected.keys())

    # Reclaim leftover budget from locked parts into unlocked categories
    for cat, part in list(selected.items()):
        leftover = max(0.0, budgets.get(cat, 0) - part.list_price)
        if leftover <= 0:
            continue
        unlockable = [c for c in CATEGORIES if c not in locked_cats and c in budgets]
        if not unlockable:
            continue
        share = leftover / len(unlockable)
        for c in unlockable:
            budgets[c] += share

    # GPU
    if "gpu" not in selected:
        gpus = _parts_by_category(db, "gpu")
        if req.resolution == "4k":
            gpus = sorted(gpus, key=lambda p: int(p.specs.get("tier", 0)), reverse=True)
        elif req.use_case == "office" and req.budget < 4500:
            notes.append("办公低预算方案可考虑核显；当前仍尝试匹配入门独显")
        selected_gpu = _pick_best(gpus, budgets["gpu"])
        if selected_gpu:
            selected["gpu"] = selected_gpu

    # CPU
    if "cpu" not in selected:
        cpus = _parts_by_category(db, "cpu")
        if req.use_case == "gaming_2k" and req.budget >= 10000:
            x3d = next((c for c in cpus if "x3d" in c.id), None)
            if x3d and x3d.list_price <= budgets["cpu"] * 1.15:
                selected["cpu"] = x3d
                notes.append("预算充足，优先游戏向 X3D 处理器")
        if "cpu" not in selected:
            picked = _pick_best(cpus, budgets["cpu"])
            if picked:
                selected["cpu"] = picked

    cpu = selected.get("cpu")
    socket = cpu.specs.get("socket") if cpu else None
    mem_type = cpu.specs.get("memory") if cpu else "DDR5"

    # Motherboard
    if "motherboard" not in selected:
        mbs = _parts_by_category(db, "motherboard")
        if socket:
            mbs = [m for m in mbs if m.specs.get("socket") == socket]
        mb = _pick_best(mbs, budgets["motherboard"])
        if mb:
            selected["motherboard"] = mb

    mb = selected.get("motherboard")

    # Memory
    if "memory" not in selected:
        rams = _parts_by_category(db, "memory")
        rams = [r for r in rams if r.specs.get("type") == mem_type]
        if req.use_case == "content":
            rams = [r for r in rams if int(r.specs.get("capacity_gb", 0)) >= 32] or rams
        elif req.budget >= 5000:
            preferred = [r for r in rams if int(r.specs.get("capacity_gb", 0)) >= 32]
            if preferred:
                rams = preferred
        ram = _pick_best(rams, budgets["memory"])
        if ram:
            selected["memory"] = ram

    # Storage
    if "storage" not in selected:
        ssds = _parts_by_category(db, "storage")
        if req.use_case == "content":
            ssds = sorted(ssds, key=lambda p: int(p.specs.get("capacity_gb", 0)), reverse=True)
        ssd = _pick_best(ssds, budgets["storage"])
        if ssd:
            selected["storage"] = ssd

    # Case
    if "case" not in selected:
        cases = _parts_by_category(db, "case")
        if mb:
            ff = mb.specs.get("form_factor")
            cases = [c for c in cases if ff in (c.specs.get("form_factors") or [])] or cases
        gpu = selected.get("gpu")
        if gpu:
            cases = [
                c
                for c in cases
                if int(c.specs.get("gpu_max_mm", 9999)) >= int(gpu.specs.get("length_mm", 0))
            ] or cases
        case = _pick_best(cases, budgets["case"])
        if case:
            selected["case"] = case

    case = selected.get("case")
    gpu = selected.get("gpu")

    # Cooler
    if "cooler" not in selected:
        coolers = _parts_by_category(db, "cooler")
        if cpu:
            coolers = [c for c in coolers if cpu.specs.get("socket") in (c.specs.get("sockets") or [])]
            coolers = [
                c for c in coolers if int(c.specs.get("tdp_rating", 0)) >= int(cpu.specs.get("tdp", 0))
            ] or coolers
        if case:
            coolers = [
                c
                for c in coolers
                if c.specs.get("type") != "air"
                or int(c.specs.get("height_mm", 0)) <= int(case.specs.get("cooler_max_mm", 999))
            ] or coolers
        cooler = _pick_best(coolers, budgets["cooler"])
        if cooler:
            selected["cooler"] = cooler

    # PSU
    watt = estimate_system_wattage(selected.values())
    rec_w = recommended_psu_wattage(watt)
    if "psu" not in selected:
        psus = _parts_by_category(db, "psu")
        psus = [p for p in psus if int(p.specs.get("wattage", 0)) >= rec_w] or psus
        psu = _pick_best(psus, budgets["psu"])
        if psu:
            selected["psu"] = psu

    parts_list = list(selected.values())
    issues = validate_build(parts_list)
    for _ in range(3):
        errors = [i for i in issues if i.severity == "error"]
        if not errors:
            break
        codes = {e.code for e in errors}
        if ("gpu_too_long" in codes or "case_form_factor" in codes) and "case" not in locked_cats:
            alt_cases = _parts_by_category(db, "case")
            if gpu:
                alt_cases = [
                    c
                    for c in alt_cases
                    if int(c.specs.get("gpu_max_mm", 0)) >= int(gpu.specs.get("length_mm", 0))
                ]
            if mb:
                ff = mb.specs.get("form_factor")
                alt_cases = [c for c in alt_cases if ff in (c.specs.get("form_factors") or [])]
            if alt_cases:
                selected["case"] = max(alt_cases, key=lambda p: int(p.specs.get("gpu_max_mm", 0)))
                notes.append("已更换更大机箱以解决兼容问题")
        if "psu_insufficient" in codes and "psu" not in locked_cats:
            bigger = [
                p for p in _parts_by_category(db, "psu") if int(p.specs.get("wattage", 0)) >= rec_w
            ]
            if bigger:
                selected["psu"] = min(bigger, key=lambda p: p.list_price)
                notes.append("已升级电源以满足功耗")
        if (
            "cooler_socket" in codes or "cooler_tdp_low" in codes or "cooler_too_tall" in codes
        ) and "cooler" not in locked_cats:
            alts = _parts_by_category(db, "cooler")
            if cpu:
                alts = [c for c in alts if cpu.specs.get("socket") in (c.specs.get("sockets") or [])]
            if alts:
                selected["cooler"] = max(alts, key=lambda p: int(p.specs.get("tdp_rating", 0)))
                notes.append("已更换散热器以匹配 CPU/机箱")
        parts_list = list(selected.values())
        issues = validate_build(parts_list)
        watt = estimate_system_wattage(parts_list)
        rec_w = recommended_psu_wattage(watt)

    total = sum(p.list_price for p in parts_list)
    if total > req.budget * 1.05:
        notes.append(f"配置目录总价约 ¥{total:.0f}，略超预算，可优先降内存/机箱/固态档次")
    elif total < req.budget * 0.85:
        notes.append(f"配置目录总价约 ¥{total:.0f}，预算仍有余量，可考虑升级显卡或 X3D")

    return SuggestResult(
        parts=parts_list,
        issues=issues,
        notes=notes,
        estimated_wattage=watt,
        recommended_psu_wattage=rec_w,
    )
