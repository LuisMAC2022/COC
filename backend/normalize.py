from typing import Dict, List


def _dedupe_units(units: List[dict]) -> List[dict]:
    seen = {}
    for unit in units:
        name = unit.get("name")
        if not name:
            continue
        current = seen.get(name)
        if not current or unit.get("maxLevel", 0) > current.get("maxLevel", 0):
            seen[name] = unit
    return list(seen.values())


def _extract_units(player_json: dict, key: str) -> List[dict]:
    units = []
    for unit in player_json.get(key, []):
        if unit.get("village") != "home":
            continue
        units.append(
            {
                "name": unit.get("name"),
                "level": unit.get("level"),
                "maxLevel": unit.get("maxLevel"),
                "superActive": unit.get("superTroopIsActive", False),
            }
        )
    return _dedupe_units(units)


def normalize_player(player_json: dict) -> Dict:
    return {
        "tag": player_json.get("tag"),
        "name": player_json.get("name"),
        "th": player_json.get("townHallLevel"),
        "expLevel": player_json.get("expLevel"),
        "clanTag": (player_json.get("clan") or {}).get("tag"),
        "categories": {
            "troops": _extract_units(player_json, "troops"),
            "spells": _extract_units(player_json, "spells"),
            "heroes": _extract_units(player_json, "heroes"),
            "heroEquipment": _extract_units(player_json, "heroEquipment"),
        },
        "derived": {},
    }
