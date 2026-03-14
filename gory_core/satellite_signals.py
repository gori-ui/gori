from __future__ import annotations

from datetime import datetime, timezone
from itertools import count

from gory_core.signals import (
    MAX_SIGNAL_BUFFER,
    SIGNAL_TTL_SECONDS,
    build_signal,
    build_signal_feed_snapshot,
    clone,
    prune_runtime_signal_buffer,
)

SATELLITE_CATEGORY = "wildfire_activity"
SATELLITE_SOURCE_CLASS = "automated_remote_sensing"
SATELLITE_PROVIDER = "satellite_feed"
SATELLITE_SIGNAL_TYPE = "thermal_anomaly"

_satellite_signals: list[dict] = []
_counter = count(1)


def _observed_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _next_signal_id() -> str:
    return f"sat-{next(_counter)}"


def ingest_satellite_signal(latitude: float, longitude: float, description: str | None = None) -> dict:
    global _satellite_signals
    description_text = (description or "").strip()
    summary = "Satellite thermal anomaly detected"
    if description_text:
        summary = f"Satellite thermal anomaly detected: {description_text}"

    signal = build_signal(
        signal_id=_next_signal_id(),
        category=SATELLITE_CATEGORY,
        source_class=SATELLITE_SOURCE_CLASS,
        provider=SATELLITE_PROVIDER,
        status="active",
        observed_at=_observed_now(),
        latitude=latitude,
        longitude=longitude,
        confidence=None,
        verification="unverified",
        signal_type=SATELLITE_SIGNAL_TYPE,
        title="Satellite thermal anomaly",
        summary=summary,
    )
    _satellite_signals.append(signal)
    _satellite_signals = prune_runtime_signal_buffer(
        _satellite_signals,
        ttl_seconds=SIGNAL_TTL_SECONDS,
        max_size=MAX_SIGNAL_BUFFER,
    )
    return clone(signal)


def list_satellite_signals() -> list[dict]:
    global _satellite_signals
    _satellite_signals = prune_runtime_signal_buffer(
        _satellite_signals,
        ttl_seconds=SIGNAL_TTL_SECONDS,
        max_size=MAX_SIGNAL_BUFFER,
    )
    return clone(_satellite_signals)


def build_satellite_signal_feed() -> dict:
    signals = list_satellite_signals()
    observed_at = signals[-1]["observedAt"] if signals else None
    return build_signal_feed_snapshot(
        status="live",
        category=SATELLITE_CATEGORY,
        source_class=SATELLITE_SOURCE_CLASS,
        provider=SATELLITE_PROVIDER,
        observed_at=observed_at,
        signals=signals,
        strategic_target=None,
    )
