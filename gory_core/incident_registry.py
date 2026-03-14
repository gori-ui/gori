from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha1

from gory_core.canonical_registry_store import load_canonical_registry, upsert_canonical_entry
from gory_core.signals import haversine_km, parse_observed_at

INCIDENT_MATCH_DISTANCE_KM = 10.0
INCIDENT_MATCH_WINDOW_HOURS = 72
ACTIVE_INCIDENT_WINDOW_HOURS = 168

_CANONICAL_REGISTRY: dict[str, dict] = load_canonical_registry()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(value: datetime | None) -> str | None:
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _runtime_zone_key(incident: dict) -> str:
    incident_id = incident.get("id", "")
    return incident_id.removeprefix("incident-") or "unknown"


def _region_code_from_incident(incident: dict) -> str:
    parts = [part for part in _runtime_zone_key(incident).split("-") if part]
    initials = "".join(part[0].upper() for part in parts[:2]) or "UK"
    return f"BG-{initials}"


def _canonical_hash(incident: dict, first_observed: datetime, region_code: str) -> str:
    location = incident.get("location") or {}
    latitude = round(float(location.get("latitude", 0.0)), 2)
    longitude = round(float(location.get("longitude", 0.0)), 2)
    raw = f"{region_code}|{latitude:.2f}|{longitude:.2f}|{first_observed.strftime('%Y%m%d%H%M')}"
    return sha1(raw.encode("utf-8")).hexdigest()[:4].upper()


def _build_canonical_id(incident: dict) -> str:
    first_observed = parse_observed_at(incident.get("firstObservedAt")) or _now_utc()
    region_code = _region_code_from_incident(incident)
    short_hash = _canonical_hash(incident, first_observed, region_code)
    return f"GORI-{first_observed.strftime('%Y%m%d')}-{region_code}-{short_hash}"


def _hours_between(reference: datetime | None, value: datetime | None) -> float:
    if not reference or not value:
        return float("inf")
    return abs((reference - value).total_seconds()) / 3600


def _candidate_registry_entries(now: datetime) -> list[tuple[str, dict]]:
    items = []
    max_age = timedelta(hours=ACTIVE_INCIDENT_WINDOW_HOURS)
    for canonical_id, record in _CANONICAL_REGISTRY.items():
        last_updated = parse_observed_at(record.get("lastUpdatedAt"))
        if last_updated and now - last_updated > max_age and record.get("lifecycleState") == "closed":
            continue
        items.append((canonical_id, record))
    return items


def resolve_incident_id(incident_snapshot: dict | None) -> str | None:
    if not incident_snapshot or not incident_snapshot.get("id"):
        return None

    now = _now_utc()
    location = incident_snapshot.get("location") or {}
    latitude = location.get("latitude")
    longitude = location.get("longitude")
    current_first = parse_observed_at(incident_snapshot.get("firstObservedAt")) or now
    current_last = parse_observed_at(incident_snapshot.get("lastUpdatedAt")) or current_first

    best_match_id = None
    best_match_score = None
    for canonical_id, record in _candidate_registry_entries(now):
        existing_location = record.get("location") or {}
        existing_latitude = existing_location.get("latitude")
        existing_longitude = existing_location.get("longitude")
        if latitude is None or longitude is None or existing_latitude is None or existing_longitude is None:
            continue

        distance_km = haversine_km(latitude, longitude, existing_latitude, existing_longitude)
        if distance_km > INCIDENT_MATCH_DISTANCE_KM:
            continue

        existing_last = parse_observed_at(record.get("lastUpdatedAt")) or now
        time_gap_hours = _hours_between(existing_last, current_first)
        if time_gap_hours > INCIDENT_MATCH_WINDOW_HOURS:
            continue

        score = (distance_km, time_gap_hours)
        if best_match_score is None or score < best_match_score:
            best_match_id = canonical_id
            best_match_score = score

    canonical_id = best_match_id or _build_canonical_id(incident_snapshot)
    existing_record = _CANONICAL_REGISTRY.get(canonical_id, {})
    first_observed = parse_observed_at(existing_record.get("firstObservedAt")) or current_first
    updated_record = {
        "canonicalId": canonical_id,
        "runtimeIncidentId": incident_snapshot.get("id"),
        "zoneId": incident_snapshot.get("zoneId") or _runtime_zone_key(incident_snapshot),
        "zoneLabel": incident_snapshot.get("zoneLabel"),
        "createdAt": existing_record.get("createdAt") or _to_iso(now),
        "firstObservedAt": _to_iso(min(first_observed, current_first)),
        "lastUpdatedAt": incident_snapshot.get("lastUpdatedAt"),
        "location": deepcopy(location),
        "lifecycleState": incident_snapshot.get("lifecycleState"),
        "severityLevel": incident_snapshot.get("severityLevel"),
        "status": incident_snapshot.get("status"),
        "sources": deepcopy(incident_snapshot.get("sources", [])),
        "signalsCount": len(incident_snapshot.get("signals", [])),
        "timeline": deepcopy(incident_snapshot.get("timeline", [])),
    }
    _CANONICAL_REGISTRY[canonical_id] = updated_record
    upsert_canonical_entry(updated_record)
    return canonical_id


def get_canonical_incident(incident_id: str) -> dict | None:
    record = _CANONICAL_REGISTRY.get(incident_id)
    return deepcopy(record) if record else None


def list_active_incidents() -> list[dict]:
    now = _now_utc()
    items = [
        deepcopy(record)
        for _, record in _candidate_registry_entries(now)
        if record.get("lifecycleState") != "closed"
    ]
    items.sort(key=lambda item: item.get("lastUpdatedAt") or "", reverse=True)
    return items
