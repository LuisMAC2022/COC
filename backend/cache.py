import json
import os
import time
from datetime import datetime, timezone


def _cache_path(cache_dir: str, key: str) -> str:
    safe_key = key.replace("#", "").replace("/", "_")
    return os.path.join(cache_dir, f"{safe_key}.json")


def cache_get(cache_dir: str, key: str, ttl_seconds: int):
    path = _cache_path(cache_dir, key)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    fetched_at = payload.get("fetchedAt")
    if not fetched_at:
        return None
    fetched_ts = datetime.fromisoformat(fetched_at).timestamp()
    if time.time() - fetched_ts > ttl_seconds:
        return None
    return payload.get("data")


def cache_set(cache_dir: str, key: str, data):
    os.makedirs(cache_dir, exist_ok=True)
    path = _cache_path(cache_dir, key)
    payload = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
