from __future__ import annotations

from typing import Iterable

from app.models import Part
from app.schemas import CompatIssue


def estimate_system_wattage(parts: Iterable[Part]) -> int:
    by_cat = {p.category: p for p in parts}
    cpu_tdp = int(by_cat.get("cpu").specs.get("tdp", 65)) if "cpu" in by_cat else 65
    gpu_tdp = int(by_cat.get("gpu").specs.get("tdp", 0)) if "gpu" in by_cat else 0
    # board + ram + storage + fans overhead
    overhead = 80
    return cpu_tdp + gpu_tdp + overhead


def recommended_psu_wattage(estimated: int) -> int:
    target = int(estimated * 1.4)
    for w in (450, 550, 650, 750, 850, 1000, 1200):
        if w >= target:
            return w
    return 1200


def validate_build(parts: list[Part]) -> list[CompatIssue]:
    issues: list[CompatIssue] = []
    by_cat: dict[str, Part] = {}
    for p in parts:
        if p.category in by_cat:
            issues.append(
                CompatIssue(
                    severity="warning",
                    code="duplicate_category",
                    message=f"类别 {p.category} 存在多个配件，仅保留最后选中的一件参与校验",
                )
            )
        by_cat[p.category] = p

    cpu = by_cat.get("cpu")
    mb = by_cat.get("motherboard")
    ram = by_cat.get("memory")
    gpu = by_cat.get("gpu")
    psu = by_cat.get("psu")
    cooler = by_cat.get("cooler")
    case = by_cat.get("case")

    if cpu and mb:
        if cpu.specs.get("socket") != mb.specs.get("socket"):
            issues.append(
                CompatIssue(
                    severity="error",
                    code="socket_mismatch",
                    message=f"CPU 插座 {cpu.specs.get('socket')} 与主板 {mb.specs.get('socket')} 不匹配",
                )
            )
        if cpu.specs.get("memory") and mb.specs.get("memory") and cpu.specs.get("memory") != mb.specs.get("memory"):
            issues.append(
                CompatIssue(
                    severity="error",
                    code="memory_gen_cpu_mb",
                    message="CPU 与主板内存代数不一致",
                )
            )

    if ram and mb:
        if ram.specs.get("type") != mb.specs.get("memory"):
            issues.append(
                CompatIssue(
                    severity="error",
                    code="memory_type_mismatch",
                    message=f"内存 {ram.specs.get('type')} 与主板 {mb.specs.get('memory')} 不匹配",
                )
            )
        mb_max = mb.specs.get("max_memory_mhz")
        ram_speed = ram.specs.get("speed_mhz")
        if mb_max and ram_speed and int(ram_speed) > int(mb_max) + 400:
            issues.append(
                CompatIssue(
                    severity="warning",
                    code="memory_speed_high",
                    message=f"内存标称 {ram_speed}MHz，可能超出主板官方支持上限 {mb_max}MHz",
                )
            )

    if cooler and cpu:
        sockets = cooler.specs.get("sockets") or []
        if sockets and cpu.specs.get("socket") not in sockets:
            issues.append(
                CompatIssue(
                    severity="error",
                    code="cooler_socket",
                    message=f"散热器不支持 CPU 插座 {cpu.specs.get('socket')}",
                )
            )
        rating = cooler.specs.get("tdp_rating")
        cpu_tdp = cpu.specs.get("tdp")
        if rating and cpu_tdp and int(rating) < int(cpu_tdp):
            issues.append(
                CompatIssue(
                    severity="warning",
                    code="cooler_tdp_low",
                    message=f"散热器额定 {rating}W 低于 CPU TDP {cpu_tdp}W，建议升级散热",
                )
            )

    if case and mb:
        forms = case.specs.get("form_factors") or []
        ff = mb.specs.get("form_factor")
        if forms and ff and ff not in forms:
            issues.append(
                CompatIssue(
                    severity="error",
                    code="case_form_factor",
                    message=f"机箱不支持主板板型 {ff}",
                )
            )

    if case and gpu:
        gpu_len = gpu.specs.get("length_mm")
        max_len = case.specs.get("gpu_max_mm")
        if gpu_len and max_len and int(gpu_len) > int(max_len):
            issues.append(
                CompatIssue(
                    severity="error",
                    code="gpu_too_long",
                    message=f"显卡长度 {gpu_len}mm 超过机箱限长 {max_len}mm",
                )
            )

    if case and cooler and cooler.specs.get("type") == "air":
        h = cooler.specs.get("height_mm")
        max_h = case.specs.get("cooler_max_mm")
        if h and max_h and int(h) > int(max_h):
            issues.append(
                CompatIssue(
                    severity="error",
                    code="cooler_too_tall",
                    message=f"风冷高度 {h}mm 超过机箱限高 {max_h}mm",
                )
            )

    watt = estimate_system_wattage(by_cat.values())
    rec = recommended_psu_wattage(watt)
    if psu:
        psu_w = int(psu.specs.get("wattage", 0))
        if psu_w < watt:
            issues.append(
                CompatIssue(
                    severity="error",
                    code="psu_insufficient",
                    message=f"电源 {psu_w}W 低于预估整机功耗 {watt}W",
                )
            )
        elif psu_w < rec:
            issues.append(
                CompatIssue(
                    severity="warning",
                    code="psu_headroom_low",
                    message=f"电源 {psu_w}W 余量偏小，建议不低于 {rec}W",
                )
            )
    else:
        issues.append(
            CompatIssue(
                severity="warning",
                code="psu_missing",
                message=f"未选择电源，按功耗建议约 {rec}W",
            )
        )

    required = ["cpu", "motherboard", "memory", "storage", "psu", "case"]
    for cat in required:
        if cat not in by_cat:
            issues.append(
                CompatIssue(
                    severity="warning",
                    code="missing_part",
                    message=f"缺少配件类别: {cat}",
                )
            )

    return issues
