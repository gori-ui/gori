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

OPERATIONAL_CATEGORY = "wildfire_activity"
OPERATIONAL_SOURCE_CLASS = "verified_operational"
OPERATIONAL_PROVIDER = "field_team"
OPERATIONAL_SIGNAL_TYPE = "field_confirmation"
ALLOWED_VERIFICATIONS = {"cross_confirmed", "authority_confirmed"}

_operational_signals: list[dict] = []
_counter = count(1)


def _observed_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _next_signal_id() -> str:
    return f"ops-{next(_counter)}"


def normalize_operational_verification(value: str | None) -> str:
    if value in ALLOWED_VERIFICATIONS:
        return value
    return "authority_confirmed"


def ingest_operational_signal(
    latitude: float,
    longitude: float,
    description: str | None = None,
    verification: str | None = None,
) -> dict:
    global _operational_signals
    verification_value = normalize_operational_verification(verification)
    description_text = (description or "").strip()
    summary = "Field team confirmed active wildfire conditions"
    if description_text:
        summary = f"Field team confirmed active wildfire conditions: {description_text}"

    signal = build_signal(
        signal_id=_next_signal_id(),
        category=OPERATIONAL_CATEGORY,
        source_class=OPERATIONAL_SOURCE_CLASS,
        provider=OPERATIONAL_PROVIDER,
        status="active",
        observed_at=_observed_now(),
        latitude=latitude,
        longitude=longitude,
        confidence=None,
        verification=verification_value,
        signal_type=OPERATIONAL_SIGNAL_TYPE,
        title="Operational fire confirmation",
        summary=summary,
    )
    _operational_signals.append(signal)
    _operational_signals = prune_runtime_signal_buffer(
        _operational_signals,
        ttl_seconds=SIGNAL_TTL_SECONDS,
        max_size=MAX_SIGNAL_BUFFER,
    )
    return clone(signal)


def list_operational_signals() -> list[dict]:
    global _operational_signals
    _operational_signals = prune_runtime_signal_buffer(
        _operational_signals,
        ttl_seconds=SIGNAL_TTL_SECONDS,
        max_size=MAX_SIGNAL_BUFFER,
    )
    return clone(_operational_signals)


def build_operational_signal_feed() -> dict:
    signals = list_operational_signals()
    observed_at = signals[-1]["observedAt"] if signals else None
    return build_signal_feed_snapshot(
        status="live",
        category=OPERATIONAL_CATEGORY,
        source_class=OPERATIONAL_SOURCE_CLASS,
        provider=OPERATIONAL_PROVIDER,
        observed_at=observed_at,
        signals=signals,
        strategic_target=None,
    )
