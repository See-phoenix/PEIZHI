from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.domain.compat import estimate_system_wattage, recommended_psu_wattage, validate_build
from app.domain.recommend import (
    SuggestResult,
    _compat_ok,
    _filter_cases,
    _filter_coolers,
    _filter_gpus,
    _filter_mbs,
    _filter_psus,
    _filter_rams,
    _filter_ssds,
    _pick_cheapest,
    _parts_by_category,
    _repair_compat,
    _resolve_locks,
    _total,
    _unit,
)
from app.models import Part
from app.schemas import CompatIssue, SuggestRequest


@dataclass
class BalancedOption:
    label: str
    score: float
    reasons: list[str]
    result: SuggestResult
    part_ids: tuple[str, ...] = field(default_factory=tuple)


def _gpu_perf(part: Part | None) -> float:
    if not part:
        return 0.0
    tier = part.specs.get("tier")
    if isinstance(tier, int) and tier > 0:
        return float(tier)
    # price fallback (effective unit when PriceBook is active)
    price = _unit(part)
    if price < 2200:
        return 1.0
    if price < 3500:
        return 2.0
    if price < 4800:
        return 3.0
    if price < 7000:
        return 4.0
    if price < 12000:
        return 5.0
    return 6.0


def _cpu_perf(part: Part | None) -> float:
    if not part:
        return 0.0
    pid = part.id.lower()
    if "x3d" in pid:
        return 6.0
    # Named catalog ladder (prefer over coarse specs.tier)
    if "9800" in pid:
        return 6.0
    if "9700" in pid:
        return 4.6
    if "9600" in pid:
        return 3.4
    if "14600" in pid:
        return 3.6
    if "7700" in pid:
        return 3.5
    if "8600" in pid:
        return 2.6
    if "7500" in pid:
        return 2.5
    if "8300" in pid:
        return 1.4
    tier = part.specs.get("tier")
    if isinstance(tier, int) and tier > 0:
        return float(tier) + 0.3
    cores = int(part.specs.get("cores", 6) or 6)
    threads = int(part.specs.get("threads", cores) or cores)
    if cores <= 4:
        return 1.2
    base = 1.0 + cores * 0.35 + max(0, threads - cores) * 0.08
    return min(6.0, base)


def _ram_perf(part: Part | None) -> float:
    if not part:
        return 0.0
    cap = int(part.specs.get("capacity_gb", 16) or 16)
    speed = int(part.specs.get("speed_mhz", 5600) or 5600)
    return cap / 16.0 + (speed - 5600) / 2000.0


def _ssd_perf(part: Part | None) -> float:
    if not part:
        return 0.0
    return int(part.specs.get("capacity_gb", 512) or 512) / 512.0


def _match_score(cpu: Part | None, gpu: Part | None, use_case: str) -> tuple[float, list[str], float]:
    """Higher is better. Also returns bottleneck severity (0=ok, higher=worse)."""
    reasons: list[str] = []
    if not cpu:
        return -100.0, ["缺少 CPU"], 10.0

    cp = _cpu_perf(cpu)
    gp = _gpu_perf(gpu) if gpu else (1.5 if bool(cpu.specs.get("igpu")) else 0.0)

    if gpu is None:
        if bool(cpu.specs.get("igpu")):
            reasons.append(f"核显方案（{cpu.name}），适合办公/轻度用途")
            bottleneck = 0.0 if use_case == "office" else 1.5
            score = 40 + cp * 8 - (0 if use_case == "office" else 15)
            return score, reasons, bottleneck
        reasons.append("无独显且 CPU 无核显，显示能力不足")
        return -50.0, reasons, 8.0

    gap = gp - cp  # positive => GPU ahead of CPU
    bottleneck = 0.0
    if gap > 2.5:
        bottleneck = gap
        reasons.append(f"CPU 可能严重拖显卡后腿（GPU≈T{gp:.0f} / CPU≈{cp:.1f}）")
    elif gap > 1.5:
        bottleneck = gap * 0.7
        reasons.append(f"CPU 相对显卡偏弱，建议升处理器")
    elif gap < -2.0:
        bottleneck = abs(gap) * 0.4
        reasons.append("CPU 明显强于显卡，显卡可能成为瓶颈")
    else:
        reasons.append(f"CPU/显卡性能匹配良好（GPU≈T{gp:.0f} / CPU≈{cp:.1f}）")

    # Gaming likes CPU able to feed GPU (small positive gap ok, large gap bad)
    balance = 30 - abs(gap) * 10
    if use_case == "gaming_2k":
        perf = gp * 12 + cp * 8
        if "x3d" in cpu.id.lower() and gp >= 3:
            reasons.append("X3D + 中高端显卡，游戏帧数更稳")
            perf += 8
    elif use_case == "content":
        perf = cp * 14 + gp * 8
        reasons.append("创作向更看重 CPU/内存带宽")
    else:
        perf = cp * 10 + gp * 6

    score = balance + perf - bottleneck * 12
    return score, reasons, bottleneck


def _supporting_parts(
    db: Session,
    req: SuggestRequest,
    selected: dict[str, Part],
    locked: set[str],
    *,
    prefer_32_ram: bool,
    prefer_large_ssd: bool,
    quality: str,
) -> None:
    """Fill non-locked support parts. quality: value|balanced|performance."""
    cpu = selected.get("cpu")
    mb = selected.get("motherboard")
    gpu = selected.get("gpu")

    if "motherboard" not in selected:
        mbs = _filter_mbs(_parts_by_category(db, "motherboard"), cpu)
        if quality == "performance":
            selected["motherboard"] = max(mbs, key=_unit) if mbs else None  # type: ignore
        elif quality == "value":
            selected["motherboard"] = _pick_cheapest(mbs)  # type: ignore
        else:
            # mid
            ranked = sorted(mbs, key=_unit)
            selected["motherboard"] = ranked[len(ranked) // 2] if ranked else None  # type: ignore
        mb = selected.get("motherboard")

    if "memory" not in selected:
        rams = _filter_rams(
            _parts_by_category(db, "memory"), cpu, mb, prefer_32=prefer_32_ram
        )
        if quality == "performance":
            selected["memory"] = max(rams, key=lambda p: (int(p.specs.get("capacity_gb", 0)), _unit(p)))
        elif quality == "value":
            selected["memory"] = _pick_cheapest(rams)  # type: ignore
        else:
            ranked = sorted(rams, key=_unit)
            selected["memory"] = ranked[min(len(ranked) - 1, max(0, len(ranked) // 2))] if ranked else None  # type: ignore

    if "storage" not in selected:
        ssds = _filter_ssds(_parts_by_category(db, "storage"), prefer_large=prefer_large_ssd)
        if quality == "performance":
            selected["storage"] = max(ssds, key=lambda p: int(p.specs.get("capacity_gb", 0)))
        elif quality == "value":
            selected["storage"] = _pick_cheapest(ssds)  # type: ignore
        else:
            ranked = sorted(ssds, key=lambda p: int(p.specs.get("capacity_gb", 0)))
            selected["storage"] = ranked[min(len(ranked) - 1, len(ranked) // 2)] if ranked else None  # type: ignore

    if "case" not in selected:
        cases = _filter_cases(_parts_by_category(db, "case"), mb, gpu)
        if quality == "performance":
            selected["case"] = max(cases, key=_unit) if cases else None  # type: ignore
        else:
            selected["case"] = _pick_cheapest(cases)  # type: ignore

    if "cooler" not in selected:
        coolers = _filter_coolers(_parts_by_category(db, "cooler"), cpu, selected.get("case"))
        if quality == "performance":
            selected["cooler"] = max(coolers, key=lambda p: int(p.specs.get("tdp_rating", 0))) if coolers else None  # type: ignore
        else:
            selected["cooler"] = _pick_cheapest(coolers)  # type: ignore

    watt = estimate_system_wattage([p for p in selected.values() if p])
    rec_w = recommended_psu_wattage(watt)
    if "psu" not in selected:
        psus = _filter_psus(_parts_by_category(db, "psu"), rec_w)
        if quality == "performance":
            selected["psu"] = max(psus, key=lambda p: int(p.specs.get("wattage", 0))) if psus else None  # type: ignore
        else:
            # cheapest that still meets rec_w
            selected["psu"] = _pick_cheapest(psus)  # type: ignore

    # drop Nones
    for k in list(selected.keys()):
        if selected[k] is None:
            del selected[k]


def _target_cpu_for_gpu(gpus_perf: float, cpus: list[Part], use_case: str) -> list[Part]:
    """CPUs that won't severely bottleneck this GPU tier."""
    scored = []
    for c in cpus:
        # Gaming discrete GPU: skip tiny 4-core APUs — they drag mid+ cards.
        if use_case == "gaming_2k" and gpus_perf >= 2 and int(c.specs.get("cores", 0)) <= 4:
            continue
        cp = _cpu_perf(c)
        gap = gpus_perf - cp
        if gap > 2.5:
            continue  # severe bottleneck — exclude
        penalty = abs(gap)
        if use_case == "gaming_2k" and "x3d" in c.id.lower() and gpus_perf >= 3:
            penalty -= 0.8
        if use_case == "content" and int(c.specs.get("cores", 0)) >= 8:
            penalty -= 0.5
        scored.append((penalty, -cp, c))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [c for _, __, c in scored]


def _target_gpu_for_cpu(cpu_perf: float, gpus: list[Part], use_case: str) -> list[Part]:
    scored = []
    for g in gpus:
        gp = _gpu_perf(g)
        gap = gp - cpu_perf
        if gap > 2.5:
            continue
        if use_case == "office" and gp > 3:
            continue
        penalty = abs(gap)
        scored.append((penalty, -gp, g))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [g for _, __, g in scored]


def _finalize(
    db: Session,
    selected: dict[str, Part],
    locked: set[str],
    label: str,
    base_reasons: list[str],
) -> BalancedOption | None:
    """Deprecated wrapper — use _finalize_for_use_case."""
    return _finalize_for_use_case(db, selected, locked, label, base_reasons, "gaming_2k")


def _finalize_for_use_case(
    db: Session,
    selected: dict[str, Part],
    locked: set[str],
    label: str,
    base_reasons: list[str],
    use_case: str,
) -> BalancedOption | None:
    selected = {k: v for k, v in selected.items() if v is not None}
    if "cpu" not in selected:
        return None
    notes_buf: list[str] = []
    _repair_compat(db, selected, locked, notes_buf)
    errors = [i for i in validate_build(list(selected.values())) if i.severity == "error"]
    if errors:
        return None

    parts = list(selected.values())
    issues = validate_build(parts)
    watt = estimate_system_wattage(parts)
    rec_w = recommended_psu_wattage(watt)
    score, match_reasons, bottleneck = _match_score(
        selected.get("cpu"), selected.get("gpu"), use_case
    )
    if bottleneck > 2.5:
        return None

    notes = list(base_reasons) + match_reasons + notes_buf
    notes.append(f"有效总价约 ¥{_total(selected):.0f}（无预算·性能匹配，权威价优先）")
    result = SuggestResult(
        parts=parts,
        issues=issues,
        notes=notes,
        estimated_wattage=watt,
        recommended_psu_wattage=rec_w,
    )
    return BalancedOption(
        label=label,
        score=score - bottleneck * 5,
        reasons=match_reasons[:4],
        result=result,
        part_ids=tuple(sorted(p.id for p in parts)),
    )


def suggest_balanced_builds(db: Session, req: SuggestRequest, limit: int = 3) -> list[BalancedOption]:
    """No-budget recommender: match performance, avoid severe bottlenecks, return multiple options."""
    from app.domain.pricebook import load_price_book
    from app.domain.recommend import _PRICE_BOOK

    book = load_price_book(db)
    token = _PRICE_BOOK.set(book)
    try:
        return _suggest_balanced_inner(db, req, limit, book)
    finally:
        _PRICE_BOOK.reset(token)


def _suggest_balanced_inner(
    db: Session, req: SuggestRequest, limit: int, book
) -> list[BalancedOption]:
    notes: list[str] = []
    locked_parts = _resolve_locks(db, req, notes)
    locked = set(locked_parts.keys())

    cpus = _parts_by_category(db, "cpu")
    gpus = _filter_gpus(_parts_by_category(db, "gpu"), resolution=req.resolution)
    prefer_32 = req.use_case in {"content", "gaming_2k"}
    prefer_large = req.use_case == "content"

    profiles = [
        ("均衡匹配", "balanced"),
        ("性能优先", "performance"),
        ("性价比", "value"),
    ]

    options: list[BalancedOption] = []

    # --- Anchor selection per profile ---
    for label, quality in profiles:
        selected: dict[str, Part] = dict(locked_parts)
        reasons = [f"方案定位：{label}", "未填写预算，按性能匹配与防拖后腿生成"]

        if "gpu" in selected and "cpu" not in selected:
            gp = _gpu_perf(selected["gpu"])
            candidates = _target_cpu_for_gpu(gp, cpus, req.use_case)
            if not candidates:
                # fallback: least-bad CPU
                candidates = sorted(cpus, key=lambda c: abs(_gpu_perf(selected["gpu"]) - _cpu_perf(c)))
            if quality == "performance":
                pick = max(candidates[:5], key=_cpu_perf) if candidates else None
            elif quality == "value":
                pick = min(candidates[:5], key=_unit) if candidates else None
            else:
                pick = candidates[0] if candidates else None
            if pick:
                selected["cpu"] = pick
                reasons.append(f"围绕自选显卡匹配处理器：{pick.name}")

        elif "cpu" in selected and "gpu" not in selected:
            cp = _cpu_perf(selected["cpu"])
            if req.use_case == "office" and bool(selected["cpu"].specs.get("igpu")) and quality == "value":
                # iGPU office value build
                reasons.append("办公性价比优先使用核显")
            else:
                candidates = _target_gpu_for_cpu(cp, gpus, req.use_case)
                if req.use_case == "office" and quality != "performance":
                    # allow skipping GPU for office balanced/value
                    if quality == "value" and bool(selected["cpu"].specs.get("igpu")):
                        candidates = []
                if candidates:
                    if quality == "performance":
                        pick = max(candidates[:6], key=_gpu_perf)
                    elif quality == "value":
                        pick = min(candidates[:6], key=_unit)
                    else:
                        pick = candidates[0]
                    selected["gpu"] = pick
                    reasons.append(f"围绕自选 CPU 匹配显卡：{pick.name}")

        elif "gpu" not in selected and "cpu" not in selected:
            # Pick anchor GPU band by profile + use case
            if req.use_case == "office" and quality == "value":
                igpus = [c for c in cpus if bool(c.specs.get("igpu"))]
                selected["cpu"] = min(igpus or cpus, key=_unit)
                reasons.append("办公核显起步")
            else:
                if req.use_case == "office":
                    band = {"value": 1, "balanced": 2, "performance": 3}[quality]
                elif req.use_case == "content":
                    band = {"value": 2, "balanced": 3, "performance": 5}[quality]
                else:  # gaming
                    band = {"value": 2, "balanced": 3, "performance": 5}[quality]
                band_gpus = [g for g in gpus if abs(_gpu_perf(g) - band) <= 0.6] or gpus
                if quality == "value":
                    gpu = min(band_gpus, key=_unit)
                elif quality == "performance":
                    gpu = max(band_gpus, key=lambda p: (_gpu_perf(p), -_unit(p)))
                else:
                    gpu = sorted(band_gpus, key=_unit)[len(band_gpus) // 2]
                selected["gpu"] = gpu
                cpu_cands = _target_cpu_for_gpu(_gpu_perf(gpu), cpus, req.use_case)
                if not cpu_cands:
                    cpu_cands = sorted(cpus, key=lambda c: abs(_gpu_perf(gpu) - _cpu_perf(c)))
                if quality == "performance":
                    cpu = max(cpu_cands[:5], key=_cpu_perf)
                elif quality == "value":
                    cpu = min(cpu_cands[:5], key=_unit)
                else:
                    cpu = cpu_cands[0]
                selected["cpu"] = cpu
                reasons.append(f"锚点显卡 {gpu.name} + 匹配 CPU {cpu.name}")

        # If only other parts locked (ram etc.), still need cpu/gpu
        if "cpu" not in selected:
            selected["cpu"] = _pick_cheapest(cpus)  # type: ignore
        if "gpu" not in selected and req.use_case != "office":
            cp = _cpu_perf(selected["cpu"])
            cands = _target_gpu_for_cpu(cp, gpus, req.use_case)
            if cands:
                selected["gpu"] = cands[0] if quality != "performance" else max(cands[:5], key=_gpu_perf)

        _supporting_parts(
            db,
            req,
            selected,
            locked,
            prefer_32_ram=prefer_32 or quality != "value",
            prefer_large_ssd=prefer_large or quality == "performance",
            quality=quality,
        )

        opt = _finalize_for_use_case(db, selected, locked, label, reasons, req.use_case)
        if opt:
            options.append(opt)

    # Deduplicate by part set; keep higher score
    uniq: dict[tuple[str, ...], BalancedOption] = {}
    for opt in options:
        prev = uniq.get(opt.part_ids)
        if not prev or opt.score > prev.score:
            uniq[opt.part_ids] = opt

    ranked = sorted(uniq.values(), key=lambda o: o.score, reverse=True)

    # If fewer than limit due to dedupe, try extra GPU bands
    if len(ranked) < limit and "gpu" not in locked and "cpu" not in locked:
        for band in (1, 2, 3, 4, 5, 6):
            if len(ranked) >= limit:
                break
            band_gpus = [g for g in gpus if abs(_gpu_perf(g) - band) < 0.1]
            if not band_gpus:
                continue
            gpu = min(band_gpus, key=_unit)
            cands = _target_cpu_for_gpu(_gpu_perf(gpu), cpus, req.use_case)
            if not cands:
                continue
            selected = dict(locked_parts)
            selected["gpu"] = gpu
            selected["cpu"] = cands[0]
            _supporting_parts(
                db,
                req,
                selected,
                locked,
                prefer_32_ram=prefer_32,
                prefer_large_ssd=prefer_large,
                quality="balanced",
            )
            opt = _finalize_for_use_case(
                db,
                selected,
                locked,
                f"匹配档 T{band}",
                [f"补全对比：GPU 档位 {band}"],
                req.use_case,
            )
            if opt and opt.part_ids not in {r.part_ids for r in ranked}:
                ranked.append(opt)
        ranked = sorted(ranked, key=lambda o: o.score, reverse=True)

    # Attach lock notes to each
    for opt in ranked:
        opt.result.notes = notes + opt.result.notes

    return ranked[:limit]
