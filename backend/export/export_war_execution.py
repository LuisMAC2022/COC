import argparse
import json
import os
from datetime import datetime, timezone

from .. import coc_api


def load_config(path: str):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def score_attack(stars: int, destruction: float, delta: int) -> float:
    return round(stars * 1.0 + destruction * 0.01 + max(0, delta) * 0.15, 3)


def init_player(member):
    return {
        "tag": member.get("tag"),
        "name": member.get("name"),
        "mapPosition": member.get("mapPosition"),
        "attacksUsed": 0,
        "totalStars": 0,
        "totalDestruction": 0,
        "totalDelta": 0,
        "mvpScore": 0,
    }


def summarize_player(stats):
    attacks = stats["attacksUsed"] or 0
    avg_destruction = stats["totalDestruction"] / attacks if attacks else 0
    avg_delta = stats["totalDelta"] / attacks if attacks else 0
    avg_stars = stats["totalStars"] / attacks if attacks else 0
    summary = {
        **stats,
        "avgDestruction": round(avg_destruction, 2),
        "avgDelta": round(avg_delta, 2),
        "avgStars": round(avg_stars, 2),
        "mvpScore": round(stats["mvpScore"], 3),
    }
    return summary


def build_execution(clan_team, opponent_team):
    opponent_positions = {
        member.get("tag"): member.get("mapPosition") for member in opponent_team.get("members", [])
    }
    opponent_names = {
        member.get("tag"): member.get("name") for member in opponent_team.get("members", [])
    }

    attacks = []
    players = []
    for member in clan_team.get("members", []):
        stats = init_player(member)
        attacker_pos = member.get("mapPosition") or 0
        for attack in member.get("attacks", []) or []:
            defender_tag = attack.get("defenderTag")
            defender_pos = opponent_positions.get(defender_tag) or 0
            delta = attacker_pos - defender_pos
            stars = int(attack.get("stars", 0))
            destruction = float(attack.get("destructionPercentage", 0))
            order = attack.get("order")
            mvp_score = score_attack(stars, destruction, delta)

            attacks.append(
                {
                    "order": order,
                    "attackerTag": member.get("tag"),
                    "attackerName": member.get("name"),
                    "defenderTag": defender_tag,
                    "defenderName": opponent_names.get(defender_tag),
                    "stars": stars,
                    "destruction": destruction,
                    "delta": delta,
                    "mvpScore": mvp_score,
                }
            )

            stats["attacksUsed"] += 1
            stats["totalStars"] += stars
            stats["totalDestruction"] += destruction
            stats["totalDelta"] += delta
            stats["mvpScore"] += mvp_score

        players.append(summarize_player(stats))

    attacks.sort(key=lambda item: (item.get("order") is None, item.get("order", 0)))

    return players, attacks


def build_leaderboard(players, key, limit=10):
    return sorted(players, key=lambda item: item.get(key, 0), reverse=True)[:limit]


def main():
    parser = argparse.ArgumentParser(description="Export war execution data")
    parser.add_argument(
        "--config",
        default=os.path.join(os.path.dirname(__file__), "..", "config.example.json"),
    )
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(__file__), "..", "outputs", "war_execution.json"),
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

    players = []
    attacks = []

    if war_json and state not in (None, "notInWar"):
        clan_team = war_json.get("clan", {})
        opponent_team = war_json.get("opponent", {})
        players, attacks = build_execution(clan_team, opponent_team)

    payload = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "state": state or "unknown",
            "timing": "order",
            "note": "El orden de ataques se usa como aproximación temporal.",
        },
        "players": players,
        "attacks": attacks,
        "leaderboards": {
            "mvp": build_leaderboard(players, "mvpScore"),
            "stars": build_leaderboard(players, "totalStars"),
            "destruction": build_leaderboard(players, "avgDestruction"),
            "attacksUsed": build_leaderboard(players, "attacksUsed"),
        },
        "scatter": [
            {
                "tag": player.get("tag"),
                "name": player.get("name"),
                "avgDelta": player.get("avgDelta"),
                "avgStars": player.get("avgStars"),
                "attacksUsed": player.get("attacksUsed"),
            }
            for player in players
        ],
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
