import json
import os
import subprocess
import sys
from pathlib import Path


def prompt_value(label: str) -> str:
    value = ""
    while not value:
        value = input(label).strip()
    return value


def main() -> None:
    clan_tag = prompt_value("Clan tag (ej. #CLANTAG): ")
    token = prompt_value("Token API: ")

    os.environ["COC_API_TOKEN"] = token

    config = {
        "clanTag": clan_tag,
        "tokenEnvVar": "COC_API_TOKEN",
        "sleepSeconds": 0.25,
        "cacheTtlSeconds": 3600,
        "includeWarlog": False,
    }

    config_path = Path("backend") / "config.runtime.json"
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")

    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "backend.export.export_clan_snapshot",
            "--config",
            str(config_path),
        ]
    )
    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "backend.export.export_active_war",
            "--config",
            str(config_path),
        ]
    )

    print("\nServidor listo en http://localhost:8000/web/pages/clan.html")
    print("War Active: http://localhost:8000/web/pages/war.html")
    print("Presiona CTRL+C para detener el servidor.")

    subprocess.check_call([sys.executable, "-m", "http.server", "8000"])


if __name__ == "__main__":
    main()
