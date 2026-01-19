from collections import defaultdict
from statistics import mean
from typing import Dict, List


def pct(level, max_level):
    if not level or not max_level:
        return None
    return level / max_level


def power_index(profile: Dict, category: str) -> float:
    values = []
    for unit in profile.get("categories", {}).get(category, []):
        value = pct(unit.get("level"), unit.get("maxLevel"))
        if value is not None:
            values.append(value)
    if not values:
        return 0.0
    return round(mean(values), 4)


def top_near_max(profile: Dict, category: str, k: int = 10, threshold: float = 0.9):
    items = []
    for unit in profile.get("categories", {}).get(category, []):
        value = pct(unit.get("level"), unit.get("maxLevel"))
        if value is None:
            continue
        if value >= threshold:
            items.append({"name": unit.get("name"), "pct": round(value, 4)})
    items.sort(key=lambda item: item["pct"], reverse=True)
    return items[:k]


def units_by_threshold(profile: Dict, category: str, threshold: float):
    items = []
    for unit in profile.get("categories", {}).get(category, []):
        level = unit.get("level")
        max_level = unit.get("maxLevel")
        value = pct(level, max_level)
        if value is None or value < threshold:
            continue
        items.append(
            {
                "name": unit.get("name"),
                "level": level,
                "maxLevel": max_level,
                "pct": round(value, 4),
            }
        )
    items.sort(key=lambda item: (item["pct"], item["level"]), reverse=True)
    return items


def top_units_by_threshold(
    profile: Dict, category: str, threshold: float, limit: int = 10
):
    return units_by_threshold(profile, category, threshold)[:limit]


def super_active_troops(profile: Dict):
    return [
        {"name": unit.get("name"), "level": unit.get("level")}
        for unit in profile.get("categories", {}).get("troops", [])
        if unit.get("superActive")
    ]


def super_active_count(profile: Dict) -> int:
    count = 0
    for unit in profile.get("categories", {}).get("troops", []):
        if unit.get("superActive"):
            count += 1
    return count


def _collect_unit_stats(profiles: List[Dict], category: str):
    totals = defaultdict(list)
    for profile in profiles:
        for unit in profile.get("categories", {}).get(category, []):
            value = pct(unit.get("level"), unit.get("maxLevel"))
            if value is not None:
                totals[unit.get("name")].append(value)
    return totals


def top_units_by_category(profiles: List[Dict], category: str):
    totals = _collect_unit_stats(profiles, category)
    results = []
    total_players = max(len(profiles), 1)
    for unit_name, values in totals.items():
        avg_pct = mean(values)
        availability = len(values) / total_players
        strength = avg_pct * availability
        results.append(
            {
                "unit": unit_name,
                "strength": round(strength, 4),
                "avgPct": round(avg_pct, 4),
                "availability": round(availability, 4),
            }
        )
    results.sort(key=lambda item: item["strength"], reverse=True)
    return results


def coverage(profiles: List[Dict], category: str):
    totals = _collect_unit_stats(profiles, category)
    results = []
    total_players = max(len(profiles), 1)
    for unit_name, values in totals.items():
        coverage90 = sum(1 for value in values if value >= 0.9)
        avg_pct = mean(values)
        results.append(
            {
                "unit": unit_name,
                "coverage90": coverage90,
                "coverageRate": round(coverage90 / total_players, 4),
                "avgPct": round(avg_pct, 4),
            }
        )
    results.sort(key=lambda item: (item["coverage90"], item["avgPct"]), reverse=True)
    return results


def top_donors_by_category(profiles: List[Dict], category: str, limit: int = 3):
    donors = defaultdict(list)
    for profile in profiles:
        for unit in profile.get("categories", {}).get(category, []):
            level = unit.get("level")
            max_level = unit.get("maxLevel")
            value = pct(level, max_level)
            if value is None:
                continue
            donors[unit.get("name")].append(
                {
                    "name": profile.get("name"),
                    "tag": profile.get("tag"),
                    "level": level,
                    "maxLevel": max_level,
                    "pct": round(value, 4),
                }
            )
    results = {}
    for unit_name, entries in donors.items():
        entries.sort(key=lambda item: (item["pct"], item["level"]), reverse=True)
        results[unit_name] = entries[:limit]
    return results


def coverage_gaps(coverage_rows: List[Dict], threshold: float = 0.2, limit: int = 20):
    gaps = [row for row in coverage_rows if row.get("coverageRate", 0) <= threshold]
    gaps.sort(key=lambda row: (row.get("coverageRate", 0), row.get("avgPct", 0)))
    return gaps[:limit]


def recommend_upgrades(
    profiles: List[Dict],
    coverage_map: Dict[str, Dict[str, float]],
    min_pct: float = 0.85,
    max_pct: float = 0.95,
    coverage_threshold: float = 0.2,
    max_per_player: int = 3,
):
    recommendations = []
    for profile in profiles:
        suggestions = []
        for category, units in profile.get("categories", {}).items():
            for unit in units:
                value = pct(unit.get("level"), unit.get("maxLevel"))
                if value is None or value < min_pct or value > max_pct:
                    continue
                coverage_rate = coverage_map.get(category, {}).get(unit.get("name"), 1)
                if coverage_rate > coverage_threshold:
                    continue
                suggestions.append(
                    {
                        "unit": unit.get("name"),
                        "category": category,
                        "pct": round(value, 4),
                        "coverageRate": round(coverage_rate, 4),
                    }
                )
        if suggestions:
            suggestions.sort(key=lambda item: (item["coverageRate"], -item["pct"]))
            recommendations.append(
                {
                    "player": {"name": profile.get("name"), "tag": profile.get("tag")},
                    "suggestions": suggestions[:max_per_player],
                }
            )
    return recommendations
