from __future__ import annotations

import json
from typing import Iterable
from urllib.parse import urlencode
from urllib.request import urlopen

OPEN_METEO_DOCS_URL = "https://open-meteo.com/en/docs"
OPEN_METEO_API_URL = "https://api.open-meteo.com/v1/forecast"


def _build_query(latitudes: str, longitudes: str) -> str:
    return urlencode(
        {
            "latitude": latitudes,
            "longitude": longitudes,
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
            "wind_speed_unit": "kmh",
            "temperature_unit": "celsius",
            "timezone": "auto",
            "forecast_days": 1,
        }
    )


def _normalize_snapshot(item: dict | None) -> dict:
    current = item.get("current", {}) if isinstance(item, dict) else {}
    values = {
        "temperature_c": current.get("temperature_2m"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "wind_kmh": current.get("wind_speed_10m"),
        "wind_direction_deg": current.get("wind_direction_10m"),
    }
    missing = [key for key, value in values.items() if value is None]

    if len(missing) == len(values):
        status = "missing"
    elif missing:
        status = "partial"
    else:
        status = "live"

    return {
        "status": status,
        "source": "Open-Meteo",
        "docsUrl": OPEN_METEO_DOCS_URL,
        "observedAt": current.get("time"),
        "values": values,
        "missing": missing,
    }


def _request(latitudes: str, longitudes: str) -> list[dict]:
    url = f"{OPEN_METEO_API_URL}?{_build_query(latitudes, longitudes)}"
    with urlopen(url, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if isinstance(payload, list):
        return payload
    return [payload]


def fetch_live_meteo_for_zones(zones: Iterable[dict]) -> dict[str, dict]:
    zone_list = list(zones)
    if not zone_list:
        return {}

    latitudes = ",".join(str(zone["lat"]) for zone in zone_list)
    longitudes = ",".join(str(zone["lon"]) for zone in zone_list)

    try:
        payloads = _request(latitudes, longitudes)
    except Exception:
        return {
            zone["id"]: {
                "status": "missing",
                "source": "Open-Meteo",
                "docsUrl": OPEN_METEO_DOCS_URL,
                "observedAt": None,
                "values": {
                    "temperature_c": None,
                    "humidity_pct": None,
                    "wind_kmh": None,
                    "wind_direction_deg": None,
                },
                "missing": ["temperature_c", "humidity_pct", "wind_kmh", "wind_direction_deg"],
            }
            for zone in zone_list
        }

    snapshots = {}
    for index, zone in enumerate(zone_list):
        payload = payloads[index] if index < len(payloads) else None
        snapshots[zone["id"]] = _normalize_snapshot(payload)
    return snapshots


def fetch_live_meteo_for_zone(zone: dict) -> dict:
    data = fetch_live_meteo_for_zones([zone])
    return data.get(zone["id"], _normalize_snapshot(None))
