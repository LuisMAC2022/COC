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
    for unit_name, values in totals.items():
        coverage90 = sum(1 for value in values if value >= 0.9)
        avg_pct = mean(values)
        results.append(
            {
                "unit": unit_name,
                "coverage90": coverage90,
                "avgPct": round(avg_pct, 4),
            }
        )
    results.sort(key=lambda item: (item["coverage90"], item["avgPct"]), reverse=True)
    return results
