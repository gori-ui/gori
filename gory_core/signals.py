from __future__ import annotations

import math
from copy import deepcopy
from datetime import datetime, timedelta, timezone

from gory_core.incidents import build_incident_from_signal_summary

SOURCE_CLASS_PRIORITY = {
    "verified_operational": 3,
    "automated_remote_sensing": 2,
    "human_reported": 1,
}

VERIFICATION_PRIORITY = {
    "authority_confirmed": 3,
    "cross_confirmed": 2,
    "unverified": 1,
}

CROSS_CONFIRMATION_NEAR_KM = 30.0
CROSS_CONFIRMATION_RECENT_DAYS = 3.0
SIGNAL_TTL_SECONDS = 86400
MAX_SIGNAL_BUFFER = 2000
CROSS_CONFIRMATION_RANK = {
    "none": 0,
    "weak": 1,
    "moderate": 2,
    "strong": 3,
}


def clone(data):
    return deepcopy(data)


def parse_observed_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_signal_timestamp(signal: dict, fallback_now: datetime | None = None) -> datetime:
    observed = parse_observed_at(signal.get("observedAt"))
    if observed:
        return observed.astimezone(timezone.utc)
    return fallback_now or _now_utc()


def prune_runtime_signal_buffer(
    signals: list[dict],
    *,
    ttl_seconds: int = SIGNAL_TTL_SECONDS,
    max_size: int = MAX_SIGNAL_BUFFER,
    now: datetime | None = None,
) -> list[dict]:
    current_time = now or _now_utc()
    cutoff = current_time - timedelta(seconds=ttl_seconds)

    normalized = []
    for signal in signals:
        observed = normalize_signal_timestamp(signal, current_time)
        if observed >= cutoff:
            normalized.append((observed, signal))

    normalized.sort(key=lambda item: item[0])
    trimmed = normalized[-max_size:] if max_size > 0 else normalized
    return [clone(signal) for _, signal in trimmed]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def build_signal(
    *,
    signal_id: str | None,
    category: str,
    source_class: str,
    provider: str,
    status: str,
    observed_at: str | None,
    latitude: float,
    longitude: float,
    confidence: float | None,
    verification: str,
    signal_type: str,
    title: str | None,
    summary: str | None = None,
) -> dict:
    return {
        "id": signal_id,
        "category": category,
        "sourceClass": source_class,
        "provider": provider,
        "status": status,
        "observedAt": observed_at,
        "location": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "confidence": confidence,
        "verification": verification,
        "signalType": signal_type,
        "title": title,
        "summary": summary or title,
    }


def build_signal_feed_snapshot(
    *,
    status: str,
    category: str,
    source_class: str,
    provider: str,
    observed_at: str | None,
    signals: list[dict],
    strategic_target: str | None = None,
) -> dict:
    return {
        "status": status,
        "category": category,
        "sourceClass": source_class,
        "provider": provider,
        "observedAt": observed_at,
        "signals": signals,
        "strategicTarget": strategic_target,
    }


def merge_signal_feed_snapshots(
    feed_snapshots: list[dict],
    *,
    category: str,
    provider: str = "multi-source",
    source_class: str = "mixed",
    strategic_target: str | None = None,
) -> dict:
    live_feeds = [feed for feed in feed_snapshots if feed and feed.get("status") == "live"]
    signals = []
    observed_candidates = []
    for feed in live_feeds:
        signals.extend(clone(feed.get("signals", [])))
        if feed.get("observedAt"):
            observed_candidates.append(feed["observedAt"])

    observed_at = None
    parsed_observed = [parse_observed_at(item) for item in observed_candidates]
    parsed_observed = [item for item in parsed_observed if item]
    if parsed_observed:
        observed_at = max(parsed_observed).isoformat()
        if observed_at.endswith("+00:00"):
            observed_at = observed_at.replace("+00:00", "Z")

    status = "live" if live_feeds else "unavailable"
    return build_signal_feed_snapshot(
        status=status,
        category=category,
        source_class=source_class,
        provider=provider,
        observed_at=observed_at,
        signals=signals,
        strategic_target=strategic_target,
    )


def build_unavailable_zone_signal_summary(
    *,
    category: str,
    source_class: str,
    provider: str,
    signal_type: str,
    strategic_target: str | None = None,
) -> dict:
    return {
        "status": "unavailable",
        "category": category,
        "sourceClass": source_class,
        "provider": provider,
        "observedAt": None,
        "confidence": None,
        "verification": "unverified",
        "signalType": signal_type,
        "title": None,
        "summary": None,
        "primarySignal": None,
        "supportingSignals": [],
        "confidenceLevel": "low",
        "crossConfirmation": {
            "status": "none",
            "basis": [],
            "note": None,
        },
        "incident": None,
        "nearestDistanceKm": None,
        "strategicTarget": strategic_target,
    }


def source_priority(signal: dict) -> int:
    return SOURCE_CLASS_PRIORITY.get(signal.get("sourceClass"), 0)


def verification_priority(signal: dict) -> int:
    return VERIFICATION_PRIORITY.get(signal.get("verification"), 0)


def signal_priority_key(signal: dict) -> tuple:
    observed = parse_observed_at(signal.get("observedAt"))
    observed_score = observed.timestamp() if observed else 0.0
    distance = signal.get("distanceToZoneKm")
    distance_score = -(distance if distance is not None else 9999.0)
    return (
        source_priority(signal),
        verification_priority(signal),
        distance_score,
        observed_score,
    )


def is_recent_signal(signal: dict, max_age_days: float = CROSS_CONFIRMATION_RECENT_DAYS) -> bool:
    observed = parse_observed_at(signal.get("observedAt"))
    if not observed:
        return False
    age_days = (datetime.now(observed.tzinfo) - observed).total_seconds() / 86400
    return age_days <= max_age_days


def cross_confirmation_pair_label(signal_a: dict, signal_b: dict) -> str:
    if signal_a.get("sourceClass") == signal_b.get("sourceClass") == "human_reported":
        return "multiple human_reported"
    classes = sorted(
        {signal_a.get("sourceClass"), signal_b.get("sourceClass")},
        key=lambda item: SOURCE_CLASS_PRIORITY.get(item, 0),
        reverse=True,
    )
    return " + ".join(item for item in classes if item)


def cross_confirmation_status_for_pair(signal_a: dict, signal_b: dict) -> str:
    classes = {signal_a.get("sourceClass"), signal_b.get("sourceClass")}
    if classes == {"human_reported"}:
        return "weak"
    if "verified_operational" in classes and ("automated_remote_sensing" in classes or "human_reported" in classes):
        return "strong"
    if classes == {"automated_remote_sensing", "human_reported"}:
        return "moderate"
    return "none"


def derive_cross_confirmation(primary_signal: dict | None, supporting_signals: list[dict]) -> dict:
    if not primary_signal:
        return {
            "status": "none",
            "basis": [],
            "note": None,
        }

    basis: list[str] = []
    strongest_status = "none"

    primary_is_eligible = (
        (primary_signal.get("distanceToZoneKm") or 9999) <= CROSS_CONFIRMATION_NEAR_KM
        and is_recent_signal(primary_signal)
    )

    for supporting_signal in supporting_signals:
        if not primary_is_eligible:
            break
        if (supporting_signal.get("distanceToZoneKm") or 9999) > CROSS_CONFIRMATION_NEAR_KM:
            continue
        if not is_recent_signal(supporting_signal):
            continue

        pair_status = cross_confirmation_status_for_pair(primary_signal, supporting_signal)
        if pair_status == "none":
            continue

        pair_label = cross_confirmation_pair_label(primary_signal, supporting_signal)
        if pair_label and pair_label not in basis:
            basis.append(pair_label)
        if CROSS_CONFIRMATION_RANK[pair_status] > CROSS_CONFIRMATION_RANK[strongest_status]:
            strongest_status = pair_status

    human_signal_count = sum(
        1
        for signal in [primary_signal, *supporting_signals]
        if signal.get("sourceClass") == "human_reported"
        and (signal.get("distanceToZoneKm") or 9999) <= CROSS_CONFIRMATION_NEAR_KM
        and is_recent_signal(signal)
    )
    if strongest_status == "none" and human_signal_count >= 2:
        strongest_status = "weak"
        basis = ["multiple human_reported"]

    note = None
    if strongest_status == "weak":
        note = "Nearby reports align weakly and raise confidence slightly."
    elif strongest_status == "moderate":
        note = "Signal confidence increased due to nearby multi-source support."
    elif strongest_status == "strong":
        note = "Operational or multi-source support strongly increases confidence."

    return {
        "status": strongest_status,
        "basis": basis,
        "note": note,
    }


def derive_confidence_level(primary_signal: dict | None, supporting_signals: list[dict], cross_confirmation: dict | None = None) -> str:
    if not primary_signal:
        return "low"

    cross_status = (cross_confirmation or {}).get("status", "none")
    if cross_status == "strong":
        return "high"

    if verification_priority(primary_signal) >= 3:
        return "high"

    if source_priority(primary_signal) >= 3 and supporting_signals:
        return "high"

    if cross_status in {"weak", "moderate"}:
        return "medium"

    if source_priority(primary_signal) >= 2 or verification_priority(primary_signal) >= 2 or supporting_signals:
        return "medium"

    return "low"


def build_zone_signal_summary(zone: dict, feed_snapshot: dict, nearby_threshold_km: float = 75.0) -> dict:
    category = feed_snapshot.get("category")
    source_class = feed_snapshot.get("sourceClass")
    provider = feed_snapshot.get("provider")
    strategic_target = feed_snapshot.get("strategicTarget")
    signal_type = category or "signal"

    if feed_snapshot.get("status") != "live":
        return build_unavailable_zone_signal_summary(
            category=category or "signal",
            source_class=source_class or "automated_remote_sensing",
            provider=provider or "Unknown provider",
            signal_type=signal_type,
            strategic_target=strategic_target,
        )

    nearby_signals: list[dict] = []
    nearest_distance = None

    for signal in feed_snapshot.get("signals", []):
        location = signal.get("location") or {}
        latitude = location.get("latitude")
        longitude = location.get("longitude")
        if latitude is None or longitude is None:
            continue

        distance = haversine_km(zone["lat"], zone["lon"], latitude, longitude)
        if nearest_distance is None or distance < nearest_distance:
            nearest_distance = distance

        if distance <= nearby_threshold_km:
            candidate = clone(signal)
            candidate["distanceToZoneKm"] = round(distance, 1)
            nearby_signals.append(candidate)

    if not nearby_signals:
        return {
            "status": "no-nearby-signal",
            "category": category,
            "sourceClass": source_class,
            "provider": provider,
            "observedAt": feed_snapshot.get("observedAt"),
            "confidence": None,
            "verification": "unverified",
            "signalType": signal_type,
            "title": None,
            "summary": None,
            "primarySignal": None,
            "supportingSignals": [],
            "confidenceLevel": "low",
            "crossConfirmation": {
                "status": "none",
                "basis": [],
                "note": None,
            },
            "incident": None,
            "nearestDistanceKm": round(nearest_distance, 1) if nearest_distance is not None else None,
            "strategicTarget": strategic_target,
        }

    prioritized_signals = sorted(nearby_signals, key=signal_priority_key, reverse=True)
    primary_signal = prioritized_signals[0]
    supporting_signals = prioritized_signals[1:]
    cross_confirmation = derive_cross_confirmation(primary_signal, supporting_signals)
    confidence_level = derive_confidence_level(primary_signal, supporting_signals, cross_confirmation)

    summary = {
        "status": "live",
        "category": category,
        "sourceClass": primary_signal.get("sourceClass", source_class),
        "provider": primary_signal.get("provider", provider),
        "observedAt": primary_signal.get("observedAt") or feed_snapshot.get("observedAt"),
        "confidence": primary_signal.get("confidence"),
        "verification": primary_signal.get("verification", "unverified"),
        "signalType": primary_signal.get("signalType", signal_type),
        "title": primary_signal.get("title"),
        "summary": primary_signal.get("summary"),
        "primarySignal": primary_signal,
        "supportingSignals": supporting_signals,
        "confidenceLevel": confidence_level,
        "crossConfirmation": cross_confirmation,
        "incident": None,
        "nearestDistanceKm": primary_signal.get("distanceToZoneKm"),
        "strategicTarget": strategic_target,
    }
    summary["incident"] = build_incident_from_signal_summary(zone, summary)
    return summary
