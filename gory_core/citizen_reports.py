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

CITIZEN_CATEGORY = "wildfire_activity"
CITIZEN_SOURCE_CLASS = "human_reported"
CITIZEN_PROVIDER = "citizen"
CITIZEN_SIGNAL_TYPE = "smoke_report"

_citizen_reports: list[dict] = []
_counter = count(1)


def _observed_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _next_signal_id() -> str:
    return f"citizen-{next(_counter)}"


def ingest_citizen_report(latitude: float, longitude: float, description: str | None = None) -> dict:
    global _citizen_reports
    description_text = (description or "").strip()
    summary = "Citizen reported visible smoke"
    if description_text:
        summary = f"Citizen reported visible smoke: {description_text}"

    signal = build_signal(
        signal_id=_next_signal_id(),
        category=CITIZEN_CATEGORY,
        source_class=CITIZEN_SOURCE_CLASS,
        provider=CITIZEN_PROVIDER,
        status="reported",
        observed_at=_observed_now(),
        latitude=latitude,
        longitude=longitude,
        confidence=None,
        verification="unverified",
        signal_type=CITIZEN_SIGNAL_TYPE,
        title="Citizen smoke report",
        summary=summary,
    )
    _citizen_reports.append(signal)
    _citizen_reports = prune_runtime_signal_buffer(
        _citizen_reports,
        ttl_seconds=SIGNAL_TTL_SECONDS,
        max_size=MAX_SIGNAL_BUFFER,
    )
    return clone(signal)


def list_citizen_reports() -> list[dict]:
    global _citizen_reports
    _citizen_reports = prune_runtime_signal_buffer(
        _citizen_reports,
        ttl_seconds=SIGNAL_TTL_SECONDS,
        max_size=MAX_SIGNAL_BUFFER,
    )
    return clone(_citizen_reports)


def build_citizen_signal_feed() -> dict:
    reports = list_citizen_reports()
    observed_at = reports[-1]["observedAt"] if reports else None
    return build_signal_feed_snapshot(
        status="live",
        category=CITIZEN_CATEGORY,
        source_class=CITIZEN_SOURCE_CLASS,
        provider=CITIZEN_PROVIDER,
        observed_at=observed_at,
        signals=reports,
        strategic_target=None,
    )
