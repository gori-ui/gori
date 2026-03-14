from __future__ import annotations

import json
from datetime import timezone
from urllib.parse import urlencode
from urllib.request import urlopen

from gory_core.signals import (
    build_signal,
    build_signal_feed_snapshot,
    build_zone_signal_summary,
    parse_observed_at,
)

EONET_API_URL = "https://eonet.gsfc.nasa.gov/api/v3/events/geojson"
PRIMARY_STRATEGIC_TARGET = "Copernicus / EFFIS"
WILDFIRE_CATEGORY = "wildfire_activity"
WILDFIRE_SIGNAL_TYPE = "wildfire_event"
SOURCE_CLASS = "automated_remote_sensing"
PROVIDER = "NASA EONET"


def fetch_live_fire_feed() -> dict:
    params = {
        "status": "open",
        "category": "wildfires",
        "days": "30",
        "limit": "200",
    }
    url = f"{EONET_API_URL}?{urlencode(params)}"

    try:
        with urlopen(url, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return build_signal_feed_snapshot(
            status="unavailable",
            category=WILDFIRE_CATEGORY,
            source_class=SOURCE_CLASS,
            provider=PROVIDER,
            observed_at=None,
            signals=[],
            strategic_target=PRIMARY_STRATEGIC_TARGET,
        )

    signals = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        properties = feature.get("properties") or {}
        coordinates = geometry.get("coordinates") or []
        if geometry.get("type") != "Point" or len(coordinates) < 2:
            continue

        signals.append(
            build_signal(
                signal_id=properties.get("id") or feature.get("id"),
                category=WILDFIRE_CATEGORY,
                source_class=SOURCE_CLASS,
                provider=PROVIDER,
                status="active",
                observed_at=properties.get("date"),
                latitude=coordinates[1],
                longitude=coordinates[0],
                confidence=None,
                verification="unverified",
                signal_type=WILDFIRE_SIGNAL_TYPE,
                title=properties.get("title") or "Wildfire event",
                summary=properties.get("title"),
            )
        )

    observed_at = None
    timestamps = [parse_observed_at(item.get("observedAt")) for item in signals]
    timestamps = [item for item in timestamps if item]
    if timestamps:
        observed_at = max(timestamps).astimezone(timezone.utc).isoformat()
        if observed_at.endswith("+00:00"):
            observed_at = observed_at.replace("+00:00", "Z")

    return build_signal_feed_snapshot(
        status="live",
        category=WILDFIRE_CATEGORY,
        source_class=SOURCE_CLASS,
        provider=PROVIDER,
        observed_at=observed_at,
        signals=signals,
        strategic_target=PRIMARY_STRATEGIC_TARGET,
    )


def build_zone_fire_signal_map(zones: list[dict], feed_snapshot: dict, nearby_threshold_km: float = 75.0) -> dict[str, dict]:
    return {
        zone["id"]: build_zone_signal_summary(zone, feed_snapshot, nearby_threshold_km)
        for zone in zones
    }
