import argparse
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from statistics import mean

from .. import coc_api
from ..derive import pct, top_units_by_category
from .export_clan_snapshot import build_profile


def load_config(path: str):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def average_units(profiles, category):
    totals = defaultdict(list)
    for profile in profiles:
        for unit in profile.get("categories", {}).get(category, []):
            value = pct(unit.get("level"), unit.get("maxLevel"))
            if value is not None:
                totals[unit.get("name")].append(value)
    return {name: mean(values) for name, values in totals.items()}


def compute_gaps(clan_profiles, opponent_profiles, category, limit=10):
    clan_avg = average_units(clan_profiles, category)
    opponent_avg = average_units(opponent_profiles, category)
    units = set(clan_avg.keys()) | set(opponent_avg.keys())
    gaps = []
    for unit in units:
        clan_value = clan_avg.get(unit, 0)
        opponent_value = opponent_avg.get(unit, 0)
        gap = clan_value - opponent_value
        gaps.append({"unit": unit, "gapPct": round(gap, 4)})
    gaps.sort(key=lambda item: abs(item["gapPct"]), reverse=True)
    return gaps[:limit]


def build_team(team_json, side, token, sleep_seconds, cache_dir, cache_ttl):
    members = []
    for member in team_json.get("members", []):
        tag = member.get("tag")
        profile_json = coc_api.get_player(tag, token, sleep_seconds, cache_dir, cache_ttl)
        profile = build_profile(profile_json)
        members.append(
            {
                "tag": tag,
                "name": member.get("name"),
                "mapPosition": member.get("mapPosition"),
                "profile": profile,
                "warMember": {"attacks": member.get("attacks", [])},
            }
        )
    return {
        "side": side,
        "tag": team_json.get("tag"),
        "name": team_json.get("name"),
        "members": members,
    }


def build_threats(profiles):
    return {
        "troops": top_units_by_category(profiles, "troops"),
        "spells": top_units_by_category(profiles, "spells"),
        "heroes": top_units_by_category(profiles, "heroes"),
        "heroEquipment": top_units_by_category(profiles, "heroEquipment"),
    }


def main():
    parser = argparse.ArgumentParser(description="Export active war data")
    parser.add_argument(
        "--config",
        default=os.path.join(os.path.dirname(__file__), "..", "config.example.json"),
    )
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(__file__), "..", "outputs", "war_active.json"),
    )
    args = parser.parse_args()

    config = load_config(args.config)
    clan_tag = config.get("clanTag")
    if not clan_tag:
        raise RuntimeError("Config missing clanTag")

    token = coc_api.read_token(config.get("tokenEnvVar", "COC_API_TOKEN"))
    sleep_seconds = float(config.get("sleepSeconds", 0.25))
    cache_ttl = int(config.get("cacheTtlSeconds", 3600))
    cache_dir = os.path.join(os.path.dirname(__file__), "..", "cache")

    war_json = coc_api.get_current_war(clan_tag, token, sleep_seconds, cache_dir, cache_ttl)
    state = war_json.get("state") if war_json else None

    teams = []
    derived = {"topThreats": {}, "gaps": {}}

    if war_json and state not in (None, "notInWar"):
        clan_team = build_team(
            war_json.get("clan", {}),
            "clan",
            token,
            sleep_seconds,
            cache_dir,
            cache_ttl,
        )
        opponent_team = build_team(
            war_json.get("opponent", {}),
            "opponent",
            token,
            sleep_seconds,
            cache_dir,
            cache_ttl,
        )
        teams = [clan_team, opponent_team]

        clan_profiles = [member["profile"] for member in clan_team["members"]]
        opponent_profiles = [member["profile"] for member in opponent_team["members"]]

        derived["topThreats"] = {
            "clan": build_threats(clan_profiles),
            "opponent": build_threats(opponent_profiles),
        }
        derived["gaps"] = {
            "troops": compute_gaps(clan_profiles, opponent_profiles, "troops"),
            "spells": compute_gaps(clan_profiles, opponent_profiles, "spells"),
            "heroes": compute_gaps(clan_profiles, opponent_profiles, "heroes"),
            "heroEquipment": compute_gaps(clan_profiles, opponent_profiles, "heroEquipment"),
        }

    payload = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "state": state or "unknown",
        },
        "teams": teams,
        "derived": derived,
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
