import argparse
import json
import os
from datetime import datetime, timezone

from .. import coc_api
from ..derive import (
    coverage,
    coverage_gaps,
    power_index,
    recommend_upgrades,
    super_active_count,
    super_active_troops,
    top_donors_by_category,
    top_near_max,
    top_units_by_category,
    top_units_by_threshold,
    units_by_threshold,
)
from ..normalize import normalize_player


def load_config(path: str):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def build_profile(player_json: dict):
    profile = normalize_player(player_json)
    top_near_max_by_cat = {
        "troops": top_near_max(profile, "troops"),
        "spells": top_near_max(profile, "spells"),
        "pets": top_near_max(profile, "pets"),
        "heroes": top_near_max(profile, "heroes"),
        "heroEquipment": top_near_max(profile, "heroEquipment"),
    }
    top_research_by_cat = {
        "troops": top_units_by_threshold(profile, "troops", 0.8),
        "pets": top_units_by_threshold(profile, "pets", 0.8),
        "spells": top_units_by_threshold(profile, "spells", 0.8),
    }
    super_active_troops_count = super_active_count(profile)
    # Contract note: keep legacy keys (topNearMax, superActiveCount) for backward
    # compatibility while exposing the preferred names (topNearMaxByCat,
    # superActiveTroopsCount). Frontend can migrate to the new keys without breaking.
    derived = {
        "powerIndex": {
            "troops": power_index(profile, "troops"),
            "spells": power_index(profile, "spells"),
            "heroes": power_index(profile, "heroes"),
            "heroEquipment": power_index(profile, "heroEquipment"),
        },
        "topNearMax": top_near_max_by_cat,
        "topNearMaxByCat": top_near_max_by_cat,
        "topResearchByCat": top_research_by_cat,
        "nearMaxUnitsByCat": {
            "troops": units_by_threshold(profile, "troops", 0.9),
            "spells": units_by_threshold(profile, "spells", 0.9),
            "heroes": units_by_threshold(profile, "heroes", 0.9),
            "heroEquipment": units_by_threshold(profile, "heroEquipment", 0.9),
        },
        "maxUnitsByCat": {
            "troops": units_by_threshold(profile, "troops", 1.0),
            "spells": units_by_threshold(profile, "spells", 1.0),
            "heroes": units_by_threshold(profile, "heroes", 1.0),
            "heroEquipment": units_by_threshold(profile, "heroEquipment", 1.0),
        },
        "superActiveTroops": super_active_troops(profile),
        "superActiveCount": super_active_troops_count,
        "superActiveTroopsCount": super_active_troops_count,
    }
    profile["derived"] = derived
    return profile


def compute_th_distribution(profiles):
    buckets = {}
    for profile in profiles:
        th = profile.get("th")
        if th is None:
            continue
        buckets[th] = buckets.get(th, 0) + 1
    distribution = [
        {"th": th, "count": count} for th, count in sorted(buckets.items(), reverse=True)
    ]
    return distribution


def main():
    parser = argparse.ArgumentParser(description="Export clan snapshot data")
    parser.add_argument(
        "--config",
        default=os.path.join(os.path.dirname(__file__), "..", "config.example.json"),
    )
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(__file__), "..", "outputs", "clan_snapshot.json"),
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

    clan = coc_api.get_clan(clan_tag, token, sleep_seconds, cache_dir, cache_ttl)
    members = coc_api.get_members(clan_tag, token, sleep_seconds, cache_dir, cache_ttl)

    profiles = []
    for member in members:
        profile_json = coc_api.get_player(
            member.get("tag"), token, sleep_seconds, cache_dir, cache_ttl
        )
        profiles.append(build_profile(profile_json))

    warlog = None
    if config.get("includeWarlog"):
        warlog = coc_api.get_warlog(clan_tag, token, sleep_seconds, cache_dir, cache_ttl)

    th_values = [profile.get("th") for profile in profiles if profile.get("th")]
    th_avg = round(sum(th_values) / len(th_values), 2) if th_values else 0

    coverage_by_cat = {
        "troops": coverage(profiles, "troops"),
        "spells": coverage(profiles, "spells"),
        "heroes": coverage(profiles, "heroes"),
        "heroEquipment": coverage(profiles, "heroEquipment"),
    }
    coverage_map = {
        category: {item.get("unit"): item.get("coverageRate", 0) for item in rows}
        for category, rows in coverage_by_cat.items()
    }
    aggregates = {
        "thAvg": th_avg,
        "thDistribution": compute_th_distribution(profiles),
        "topUnitsByCat": {
            "troops": top_units_by_category(profiles, "troops"),
            "spells": top_units_by_category(profiles, "spells"),
            "heroes": top_units_by_category(profiles, "heroes"),
            "heroEquipment": top_units_by_category(profiles, "heroEquipment"),
        },
        "coverage": coverage_by_cat,
        "resources": {
            "topDonors": {
                "troops": top_donors_by_category(profiles, "troops"),
                "spells": top_donors_by_category(profiles, "spells"),
            },
            "coverageGaps": {
                "troops": coverage_gaps(coverage_by_cat["troops"]),
                "spells": coverage_gaps(coverage_by_cat["spells"]),
                "heroes": coverage_gaps(coverage_by_cat["heroes"]),
                "heroEquipment": coverage_gaps(coverage_by_cat["heroEquipment"]),
            },
            "recommendations": recommend_upgrades(profiles, coverage_map),
            "note": (
                "Recomendaciones heurísticas basadas en cobertura (sin datos reales de laboratorio)."
            ),
        },
    }

    clan_payload = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "source": "api",
            "clanTag": clan_tag,
        },
        "clan": {
            "tag": clan.get("tag"),
            "name": clan.get("name"),
            "members": clan.get("members"),
            "warWins": clan.get("warWins"),
            "warWinStreak": clan.get("warWinStreak"),
            "warTies": clan.get("warTies"),
            "warLosses": clan.get("warLosses"),
            "warlog": warlog,
        },
        "members": profiles,
        "aggregates": aggregates,
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(clan_payload, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
