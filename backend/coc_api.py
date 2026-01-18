import os
import time
from typing import Any, Dict, Optional

import requests

from .cache import cache_get, cache_set

API_BASE = "https://api.clashofclans.com/v1"


def _request_json(url: str, token: str) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    response = requests.get(url, headers=headers, timeout=20)
    if response.status_code >= 400:
        raise RuntimeError(f"API error {response.status_code}: {response.text}")
    return response.json()


def _fetch_with_retry(url: str, token: str, sleep_seconds: float) -> Dict[str, Any]:
    try:
        return _request_json(url, token)
    except RuntimeError:
        time.sleep(max(0.5, sleep_seconds))
        return _request_json(url, token)


def _get_cached(
    endpoint: str,
    tag: str,
    token: str,
    sleep_seconds: float,
    cache_dir: str,
    ttl_seconds: int,
):
    key = f"{endpoint}_{tag}"
    cached = cache_get(cache_dir, key, ttl_seconds)
    if cached is not None:
        return cached
    url = f"{API_BASE}/{endpoint}/{tag.replace('#', '%23')}"
    data = _fetch_with_retry(url, token, sleep_seconds)
    cache_set(cache_dir, key, data)
    time.sleep(sleep_seconds)
    return data


def get_clan(
    clan_tag: str,
    token: str,
    sleep_seconds: float,
    cache_dir: str,
    ttl_seconds: int,
):
    return _get_cached("clans", clan_tag, token, sleep_seconds, cache_dir, ttl_seconds)


def get_members(
    clan_tag: str,
    token: str,
    sleep_seconds: float,
    cache_dir: str,
    ttl_seconds: int,
):
    data = _get_cached(
        "clans",
        f"{clan_tag}/members",
        token,
        sleep_seconds,
        cache_dir,
        ttl_seconds,
    )
    return data.get("items", [])


def get_player(
    player_tag: str,
    token: str,
    sleep_seconds: float,
    cache_dir: str,
    ttl_seconds: int,
):
    return _get_cached("players", player_tag, token, sleep_seconds, cache_dir, ttl_seconds)


def get_warlog(
    clan_tag: str,
    token: str,
    sleep_seconds: float,
    cache_dir: str,
    ttl_seconds: int,
) -> Optional[Dict[str, Any]]:
    try:
        return _get_cached(
            "clans",
            f"{clan_tag}/warlog?limit=25",
            token,
            sleep_seconds,
            cache_dir,
            ttl_seconds,
        )
    except RuntimeError:
        return None


def read_token(token_env_var: str) -> str:
    token = os.environ.get(token_env_var)
    if not token:
        raise RuntimeError(f"Missing token in env var {token_env_var}")
    return token
