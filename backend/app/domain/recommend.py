from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.domain.compat import estimate_system_wattage, recommended_psu_wattage, validate_build
from app.models import Part
from contextvars import ContextVar

from app.domain.pricebook import PriceBook, load_price_book, summarize_price_book
from app.schemas import CompatIssue, SuggestRequest

_PRICE_BOOK: ContextVar[PriceBook | None] = ContextVar("price_book", default=None)


CATEGORIES = ["cpu", "motherboard", "gpu", "memory", "storage", "cooler", "psu", "case"]

# Initial slice hints only — leftover is spent via upgrade passes against total budget.
BUDGET_WEIGHTS = {
    "office": {
        "cpu": 0.24,
        "motherboard": 0.14,
        "gpu": 0.12,
        "memory": 0.14,
        "storage": 0.12,
        "psu": 0.08,
        "cooler": 0.05,
        "case": 0.11,
    },
    "gaming_2k": {
        "cpu": 0.16,
        "motherboard": 0.10,
        "gpu": 0.42,
        "memory": 0.08,
        "storage": 0.07,
        "psu": 0.07,
        "cooler": 0.04,
        "case": 0.06,
    },
    "content": {
        "cpu": 0.24,
        "motherboard": 0.11,
        "gpu": 0.28,
        "memory": 0.14,
        "storage": 0.10,
        "psu": 0.05,
        "cooler": 0.04,
        "case": 0.04,
    },
}

# Where leftover budget should go first after a valid floor build.
UPGRADE_PRIORITY = {
    "office": ["cpu", "memory", "storage", "motherboard", "gpu", "case", "psu", "cooler"],
    "gaming_2k": ["gpu", "cpu", "memory", "storage", "psu", "motherboard", "cooler", "case"],
    "content": ["cpu", "memory", "gpu", "storage", "motherboard", "psu", "cooler", "case"],
}


@dataclass
class SuggestResult:
    parts: list[Part]
    issues: list[CompatIssue]
    notes: list[str]
    estimated_wattage: int
    recommended_psu_wattage: int


def _tier(part: Part) -> int:
    t = part.specs.get("tier", 0)
    return int(t) if isinstance(t, int) else 0


def _unit(part: Part | None) -> float:
    """Effective unit price from PriceBook context (verified > catalog)."""
    if not part:
        return 0.0
    book = _PRICE_BOOK.get()
    if book is not None:
        return book.of(part)
    return float(part.list_price)


def _price(part: Part | None) -> float:
    return _unit(part)


def _total(selected: dict[str, Part]) -> float:
    return sum(_unit(p) for p in selected.values())


def _parts_by_category(db: Session, category: str) -> list[Part]:
    return db.query(Part).filter(Part.category == category).all()


def _pick_under(candidates: list[Part], budget: float, *, allow_cheapest_fallback: bool = True) -> Part | None:
    """Prefer the most expensive part that still fits the slice."""
    if not candidates:
        return None
    under = [p for p in candidates if _unit(p) <= budget]
    if under:
        return max(under, key=lambda p: (_unit(p), _tier(p)))
    if allow_cheapest_fallback:
        return min(candidates, key=lambda p: _unit(p))
    return None


def _pick_cheapest(candidates: list[Part]) -> Part | None:
    if not candidates:
        return None
    return min(candidates, key=lambda p: (_unit(p), -_tier(p)))


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


def _filter_cpus(cpus: list[Part], *, prefer_igpu: bool, use_case: str) -> list[Part]:
    pool = list(cpus)
    if prefer_igpu:
        with_igpu = [c for c in pool if bool(c.specs.get("igpu"))]
        # Keep iGPU-only pool so floor/downgrade never strand a no-display CPU.
        if with_igpu:
            pool = with_igpu
    elif use_case == "gaming_2k":
        # Discrete-GPU builds: avoid tiny APUs as the main CPU.
        discrete = [
            c
            for c in pool
            if (not bool(c.specs.get("igpu"))) or int(c.specs.get("cores", 0)) >= 6
        ]
        if discrete:
            pool = discrete
    if use_case == "content":
        rich = [c for c in pool if int(c.specs.get("cores", 0)) >= 8]
        return rich or pool
    return pool


def _filter_mbs(mbs: list[Part], cpu: Part | None) -> list[Part]:
    if not cpu:
        return mbs
    socket = cpu.specs.get("socket")
    mem = cpu.specs.get("memory")
    matched = [
        m
        for m in mbs
        if (not socket or m.specs.get("socket") == socket)
        and (not mem or m.specs.get("memory") == mem)
    ]
    return matched or mbs


def _filter_rams(rams: list[Part], cpu: Part | None, mb: Part | None, *, prefer_32: bool) -> list[Part]:
    mem_type = None
    if cpu and cpu.specs.get("memory"):
        mem_type = cpu.specs.get("memory")
    elif mb and mb.specs.get("memory"):
        mem_type = mb.specs.get("memory")
    pool = [r for r in rams if not mem_type or r.specs.get("type") == mem_type] or list(rams)
    if prefer_32:
        big = [r for r in pool if int(r.specs.get("capacity_gb", 0)) >= 32]
        if big:
            return big
    return pool


def _filter_ssds(ssds: list[Part], *, prefer_large: bool) -> list[Part]:
    if prefer_large:
        return sorted(ssds, key=lambda p: int(p.specs.get("capacity_gb", 0)), reverse=True)
    return list(ssds)


def _filter_cases(cases: list[Part], mb: Part | None, gpu: Part | None) -> list[Part]:
    pool = list(cases)
    if mb:
        ff = mb.specs.get("form_factor")
        matched = [c for c in pool if ff in (c.specs.get("form_factors") or [])]
        if matched:
            pool = matched
    if gpu:
        matched = [
            c
            for c in pool
            if int(c.specs.get("gpu_max_mm", 9999)) >= int(gpu.specs.get("length_mm", 0))
        ]
        if matched:
            pool = matched
    return pool


def _filter_coolers(coolers: list[Part], cpu: Part | None, case: Part | None) -> list[Part]:
    pool = list(coolers)
    if cpu:
        socketed = [c for c in pool if cpu.specs.get("socket") in (c.specs.get("sockets") or [])]
        if socketed:
            pool = socketed
        cooled = [
            c for c in pool if int(c.specs.get("tdp_rating", 0)) >= int(cpu.specs.get("tdp", 0))
        ]
        if cooled:
            pool = cooled
    if case:
        fitted = [
            c
            for c in pool
            if c.specs.get("type") != "air"
            or int(c.specs.get("height_mm", 0)) <= int(case.specs.get("cooler_max_mm", 999))
        ]
        if fitted:
            pool = fitted
    return pool


def _filter_psus(psus: list[Part], rec_w: int) -> list[Part]:
    enough = [p for p in psus if int(p.specs.get("wattage", 0)) >= rec_w]
    return enough or list(psus)


def _filter_gpus(gpus: list[Part], *, resolution: str) -> list[Part]:
    pool = list(gpus)
    if resolution == "4k":
        pool = sorted(pool, key=lambda p: _tier(p), reverse=True)
    return pool


def _wants_discrete_gpu(req: SuggestRequest, locked: dict[str, Part], floor_no_gpu: float) -> bool:
    if "gpu" in locked:
        return True
    # Gaming / content default to dGPU when budget can roughly cover platform + entry GPU.
    cheapest_gpu_hint = 1899.0
    if req.use_case == "office":
        # Office only adds dGPU when clearly affordable after a platform floor.
        return req.budget >= max(4500.0, floor_no_gpu + cheapest_gpu_hint * 0.85)
    return req.budget >= floor_no_gpu + cheapest_gpu_hint * 0.75


def _assemble_platform(
    db: Session,
    req: SuggestRequest,
    selected: dict[str, Part],
    locked: set[str],
    budgets: dict[str, float],
    *,
    prefer_igpu: bool,
    floor_mode: bool,
) -> None:
    """Fill non-GPU categories. floor_mode picks cheapest compatible parts."""

    def choose(cat: str, candidates: list[Part]) -> None:
        if cat in selected or not candidates:
            return
        if floor_mode:
            picked = _pick_cheapest(candidates)
        else:
            picked = _pick_under(candidates, budgets.get(cat, req.budget))
        if picked:
            selected[cat] = picked

    cpus = _filter_cpus(
        _parts_by_category(db, "cpu"),
        prefer_igpu=prefer_igpu,
        use_case=req.use_case,
    )
    # Soft preference for X3D on gaming when CPU slice can afford it (non-floor).
    if (
        not floor_mode
        and "cpu" not in selected
        and req.use_case == "gaming_2k"
        and req.budget >= 10000
    ):
        x3d = next((c for c in _parts_by_category(db, "cpu") if "x3d" in c.id), None)
        if x3d and _unit(x3d) <= budgets.get("cpu", 0) * 1.15:
            selected["cpu"] = x3d
    choose("cpu", cpus)

    cpu = selected.get("cpu")
    choose("motherboard", _filter_mbs(_parts_by_category(db, "motherboard"), cpu))
    mb = selected.get("motherboard")

    prefer_32 = req.use_case == "content" or (not floor_mode and req.budget >= 5000)
    choose(
        "memory",
        _filter_rams(_parts_by_category(db, "memory"), cpu, mb, prefer_32=prefer_32),
    )
    choose(
        "storage",
        _filter_ssds(_parts_by_category(db, "storage"), prefer_large=req.use_case == "content"),
    )
    choose("case", _filter_cases(_parts_by_category(db, "case"), mb, selected.get("gpu")))
    choose(
        "cooler",
        _filter_coolers(_parts_by_category(db, "cooler"), cpu, selected.get("case")),
    )

    watt = estimate_system_wattage(selected.values())
    rec_w = recommended_psu_wattage(watt)
    choose("psu", _filter_psus(_parts_by_category(db, "psu"), rec_w))


def _compat_ok(selected: dict[str, Part]) -> bool:
    return not any(i.severity == "error" for i in validate_build(list(selected.values())))


def _candidate_upgrades(
    db: Session,
    selected: dict[str, Part],
    category: str,
) -> list[Part]:
    current = selected.get(category)
    if not current:
        return []
    all_parts = _parts_by_category(db, category)
    cpu = selected.get("cpu")
    mb = selected.get("motherboard")
    gpu = selected.get("gpu")
    case = selected.get("case")

    if category == "cpu":
        pool = all_parts
        # Without a discrete GPU, never upgrade onto a CPU that has no iGPU.
        if "gpu" not in selected:
            pool = [p for p in pool if bool(p.specs.get("igpu"))]
    elif category == "motherboard":
        pool = _filter_mbs(all_parts, cpu)
    elif category == "memory":
        pool = _filter_rams(all_parts, cpu, mb, prefer_32=False)
    elif category == "storage":
        pool = all_parts
    elif category == "case":
        pool = _filter_cases(all_parts, mb, gpu)
    elif category == "cooler":
        pool = _filter_coolers(all_parts, cpu, case)
    elif category == "psu":
        watt = estimate_system_wattage(selected.values())
        pool = _filter_psus(all_parts, recommended_psu_wattage(watt))
    elif category == "gpu":
        pool = all_parts
    else:
        pool = all_parts

    return [p for p in pool if p.id != current.id and _unit(p) > _unit(current)]


def _spend_leftover(
    db: Session,
    selected: dict[str, Part],
    locked: set[str],
    budget: float,
    use_case: str,
    notes: list[str],
) -> None:
    priority = UPGRADE_PRIORITY[use_case]
    upgraded: list[str] = []
    # Multiple passes so GPU can rise several steps as leftover allows.
    for _ in range(24):
        progressed = False
        remaining = budget - _total(selected)
        if remaining < 1:
            break
        for cat in priority:
            if cat in locked or cat not in selected:
                continue
            options = _candidate_upgrades(db, selected, cat)
            affordable = []
            for part in options:
                delta = _unit(part) - _unit(selected[cat])
                if delta <= remaining + 0.01:
                    trial = dict(selected)
                    trial[cat] = part
                    # Keep socket/form-factor valid after CPU/MB/case swaps.
                    if cat == "cpu":
                        # Force MB re-check: skip upgrade if current MB incompatible.
                        mb = trial.get("motherboard")
                        if mb and mb.specs.get("socket") != part.specs.get("socket"):
                            continue
                    if cat in {"cpu", "motherboard", "gpu", "case", "cooler", "psu", "memory"}:
                        if not _compat_ok(trial):
                            continue
                    affordable.append(part)
            if not affordable:
                continue
            best = max(affordable, key=lambda p: (_unit(p), _tier(p)))
            selected[cat] = best
            upgraded.append(cat)
            progressed = True
            break
        if not progressed:
            break
    if upgraded:
        uniq = list(dict.fromkeys(upgraded))
        notes.append("预算余量已自动加到：" + "、".join(uniq))


def _downgrade_to_fit(
    db: Session,
    selected: dict[str, Part],
    locked: set[str],
    budget: float,
    notes: list[str],
) -> None:
    """If over budget (usually due to locks), cheapen unlocked parts."""
    if _total(selected) <= budget * 1.02:
        return
    # Downgrade less critical categories first. Keep CPU last so iGPU platforms survive longer.
    order = ["case", "cooler", "storage", "memory", "motherboard", "gpu", "psu", "cpu"]
    need_igpu = "gpu" not in selected
    changed = False
    for cat in order:
        if cat in locked or cat not in selected:
            continue
        skipped: set[str] = set()
        guard = 0
        while _total(selected) > budget * 1.02 and guard < 40:
            guard += 1
            cheaper = [
                p
                for p in _parts_by_category(db, cat)
                if _unit(p) < _unit(selected[cat]) and p.id not in skipped
            ]
            if cat == "cpu" and need_igpu:
                cheaper = [p for p in cheaper if bool(p.specs.get("igpu"))]
            elif cat == "motherboard":
                cheaper = _filter_mbs(cheaper, selected.get("cpu"))
            elif cat == "memory":
                cheaper = _filter_rams(
                    cheaper, selected.get("cpu"), selected.get("motherboard"), prefer_32=False
                )
            elif cat == "case":
                cheaper = _filter_cases(cheaper, selected.get("motherboard"), selected.get("gpu"))
            elif cat == "cooler":
                cheaper = _filter_coolers(cheaper, selected.get("cpu"), selected.get("case"))
            elif cat == "psu":
                watt = estimate_system_wattage(selected.values())
                cheaper = _filter_psus(cheaper, recommended_psu_wattage(watt))
            if not cheaper:
                break
            candidate = max(cheaper, key=lambda p: _unit(p))
            trial = dict(selected)
            trial[cat] = candidate
            if cat in {"cpu", "motherboard", "gpu", "case", "cooler", "psu", "memory"} and not _compat_ok(
                trial
            ):
                skipped.add(candidate.id)
                continue
            selected[cat] = candidate
            changed = True
            if _total(selected) <= budget * 1.02:
                break
        if _total(selected) <= budget * 1.02:
            break
    if changed:
        notes.append("为贴近总预算，已下调部分未锁定配件档次")


def _repair_compat(db: Session, selected: dict[str, Part], locked: set[str], notes: list[str]) -> None:
    for _ in range(3):
        issues = validate_build(list(selected.values()))
        errors = [i for i in issues if i.severity == "error"]
        if not errors:
            break
        codes = {e.code for e in errors}
        gpu = selected.get("gpu")
        mb = selected.get("motherboard")
        cpu = selected.get("cpu")
        watt = estimate_system_wattage(selected.values())
        rec_w = recommended_psu_wattage(watt)

        if ("gpu_too_long" in codes or "case_form_factor" in codes) and "case" not in locked:
            alt_cases = _filter_cases(_parts_by_category(db, "case"), mb, gpu)
            if alt_cases:
                selected["case"] = max(alt_cases, key=lambda p: int(p.specs.get("gpu_max_mm", 0)))
                notes.append("已更换更大机箱以解决兼容问题")
        if "psu_insufficient" in codes and "psu" not in locked:
            bigger = _filter_psus(_parts_by_category(db, "psu"), rec_w)
            if bigger:
                selected["psu"] = min(bigger, key=lambda p: _unit(p))
                notes.append("已升级电源以满足功耗")
        if (
            "cooler_socket" in codes or "cooler_tdp_low" in codes or "cooler_too_tall" in codes
        ) and "cooler" not in locked:
            alts = _filter_coolers(_parts_by_category(db, "cooler"), cpu, selected.get("case"))
            if alts:
                selected["cooler"] = max(alts, key=lambda p: int(p.specs.get("tdp_rating", 0)))
                notes.append("已更换散热器以匹配 CPU/机箱")
        if "socket_mismatch" in codes and "motherboard" not in locked and cpu:
            mbs = _filter_mbs(_parts_by_category(db, "motherboard"), cpu)
            if mbs:
                selected["motherboard"] = _pick_cheapest(mbs)  # type: ignore[assignment]
                notes.append("已更换主板以匹配 CPU 插座")


def suggest_build(db: Session, req: SuggestRequest) -> SuggestResult:
    notes: list[str] = []
    book = load_price_book(db)
    token = _PRICE_BOOK.set(book)
    try:
        return _suggest_build_inner(db, req, notes, book)
    finally:
        _PRICE_BOOK.reset(token)


def _suggest_build_inner(
    db: Session, req: SuggestRequest, notes: list[str], book: PriceBook
) -> SuggestResult:
    weights = BUDGET_WEIGHTS[req.use_case]
    budgets = {k: req.budget * v for k, v in weights.items()}

    selected = _resolve_locks(db, req, notes)
    locked_cats = set(selected.keys())

    # Reclaim leftover from locked parts into unlocked category slices (initial hint only).
    for cat, part in list(selected.items()):
        leftover = max(0.0, budgets.get(cat, 0) - _unit(part))
        if leftover <= 0:
            continue
        unlockable = [c for c in CATEGORIES if c not in locked_cats and c in budgets]
        if not unlockable:
            continue
        share = leftover / len(unlockable)
        for c in unlockable:
            budgets[c] += share

    # Estimate a no-GPU floor to decide discrete GPU vs iGPU path.
    probe: dict[str, Part] = {k: v for k, v in selected.items() if k != "gpu"}
    _assemble_platform(
        db,
        req,
        probe,
        locked_cats,
        budgets,
        prefer_igpu=True,
        floor_mode=True,
    )
    floor_no_gpu = _total({k: v for k, v in probe.items() if k != "gpu"})
    want_gpu = _wants_discrete_gpu(req, selected, floor_no_gpu)

    # Build a cheap compatible floor first so any budget can start from a feasible base.
    selected_floor: dict[str, Part] = {k: v for k, v in selected.items()}
    # When a discrete GPU is planned, start from a non-APU gaming CPU floor.
    prefer_igpu = not want_gpu
    if prefer_igpu and "gpu" not in locked_cats:
        notes.append("预算更适合核显/整机平台优先，已跳过独显或仅在有余量时再考虑")
    _assemble_platform(
        db,
        req,
        selected_floor,
        locked_cats,
        budgets,
        prefer_igpu=prefer_igpu,
        floor_mode=True,
    )

    # Attach GPU on floor if desired and affordable vs remaining budget.
    if want_gpu and "gpu" not in selected_floor:
        gpus = _filter_gpus(_parts_by_category(db, "gpu"), resolution=req.resolution)
        remaining = req.budget - _total(selected_floor)
        # Keep a tiny reserve for rounding; prefer fitting under remaining.
        gpu = _pick_under(gpus, max(remaining, budgets.get("gpu", 0)), allow_cheapest_fallback=False)
        if gpu is None and remaining >= min((_unit(p) for p in gpus), default=remaining + 1):
            gpu = _pick_cheapest(gpus)
        if gpu and _total(selected_floor) + _unit(gpu) <= req.budget * 1.08:
            selected_floor["gpu"] = gpu
            # Case/PSU may need a quick refresh for the new GPU.
            if "case" not in locked_cats:
                cases = _filter_cases(
                    _parts_by_category(db, "case"),
                    selected_floor.get("motherboard"),
                    gpu,
                )
                if cases:
                    selected_floor["case"] = _pick_cheapest(cases)  # type: ignore[assignment]
            watt = estimate_system_wattage(selected_floor.values())
            if "psu" not in locked_cats:
                psus = _filter_psus(_parts_by_category(db, "psu"), recommended_psu_wattage(watt))
                if psus:
                    selected_floor["psu"] = _pick_cheapest(psus)  # type: ignore[assignment]
        elif req.use_case != "office":
            notes.append("当前预算难以同时覆盖平台与独显，已优先保证可开机平台（核显/最低配置）")

    selected = selected_floor
    _repair_compat(db, selected, locked_cats, notes)

    # If still over budget, downgrade unlocked parts.
    _downgrade_to_fit(db, selected, locked_cats, req.budget, notes)
    _repair_compat(db, selected, locked_cats, notes)

    # Gaming with dGPU: avoid leaving an ultra-cheap APU before pouring leftover into GPU.
    if (
        req.use_case == "gaming_2k"
        and "gpu" in selected
        and "cpu" not in locked_cats
        and selected.get("cpu")
    ):
        cpu = selected["cpu"]
        if bool(cpu.specs.get("igpu")) and int(cpu.specs.get("cores", 0)) <= 4:
            better_cpus = [
                p
                for p in _parts_by_category(db, "cpu")
                if _unit(p) > _unit(cpu)
                and (not bool(p.specs.get("igpu")) or int(p.specs.get("cores", 0)) >= 6)
                and _unit(p) - _unit(cpu) <= (req.budget - _total(selected)) + 0.01
            ]
            mb = selected.get("motherboard")
            better_cpus = [
                p
                for p in better_cpus
                if not mb or mb.specs.get("socket") == p.specs.get("socket")
            ]
            if better_cpus:
                pick = min(better_cpus, key=lambda p: _unit(p))
                trial = dict(selected)
                trial["cpu"] = pick
                if _compat_ok(trial):
                    selected = trial
                    notes.append(f"游戏向已预留更合适的处理器：{pick.name}")

    # Spend remaining budget by upgrading priority parts (continuous, not fixed brackets).
    _spend_leftover(db, selected, locked_cats, req.budget, req.use_case, notes)
    _repair_compat(db, selected, locked_cats, notes)

    # Optional late GPU add for office when leftover suddenly appears after cheap platform.
    if "gpu" not in selected and "gpu" not in locked_cats and req.use_case == "office":
        remaining = req.budget - _total(selected)
        gpus = _filter_gpus(_parts_by_category(db, "gpu"), resolution=req.resolution)
        gpu = _pick_under(gpus, remaining, allow_cheapest_fallback=False)
        if gpu:
            trial = dict(selected)
            trial["gpu"] = gpu
            if _total(trial) <= req.budget * 1.02 and _compat_ok(trial):
                selected = trial
                notes.append(f"预算有余，已加装独显：{gpu.name}")

    parts_list = list(selected.values())
    issues = validate_build(parts_list)
    watt = estimate_system_wattage(parts_list)
    rec_w = recommended_psu_wattage(watt)
    total = _total(selected)
    summary = summarize_price_book(book)
    if summary["verified"]:
        notes.append(
            f"选型按有效价计算（权威价 {summary['verified']} 项，目录价 {summary['catalog']} 项）"
        )
    if summary["stale_verified"]:
        notes.append(
            f"其中 {summary['stale_verified']} 项权威价超过 {book.stale_after_hours:.0f} 小时，建议重新核对纠价"
        )
    if total > req.budget * 1.05:
        notes.append(
            f"配置有效总价约 ¥{total:.0f}，仍略超预算 "
            f"（最低可组装平台约 ¥{floor_no_gpu:.0f}）；可降低自选锁定或提高预算"
        )
    elif total < req.budget * 0.85:
        notes.append(f"配置有效总价约 ¥{total:.0f}，预算仍有余量；目录高端件可能已到顶")
    else:
        notes.append(f"配置有效总价约 ¥{total:.0f}，约占用预算 {total / req.budget * 100:.0f}%")

    if "gpu" not in selected:
        cpu = selected.get("cpu")
        if cpu and bool(cpu.specs.get("igpu")):
            notes.append(f"当前方案使用核显（{cpu.name}），适合办公/轻度娱乐")
        else:
            notes.append("当前方案未包含独显，外接显示需自备核显 CPU 或单独加装显卡")

    return SuggestResult(
        parts=parts_list,
        issues=issues,
        notes=notes,
        estimated_wattage=watt,
        recommended_psu_wattage=rec_w,
    )
