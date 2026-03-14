from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone

from gory_core.history_store import (
    cleanup_expired_persisted_incidents,
    list_persisted_incidents,
    list_recent_persisted_incidents_for_zone,
    save_incident_snapshot,
)
from gory_core.signals import haversine_km, parse_observed_at

MINOR_RETENTION_HOURS = 24
MAJOR_RETENTION_DAYS = 30
NEARBY_HISTORY_RADIUS_KM = 75.0

_INCIDENT_HISTORY: dict[str, dict] = {}


def _snapshot_key(snapshot: dict) -> str | None:
    return snapshot.get("canonicalId") or snapshot.get("id")


def _zone_id_from_incident(incident: dict) -> str | None:
    if incident.get("zoneId"):
        return incident.get("zoneId")
    incident_id = incident.get("id", "")
    if incident_id.startswith("incident-"):
        return incident_id.removeprefix("incident-") or None
    return None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(value: datetime | None) -> str | None:
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _retention_until(incident: dict, now: datetime) -> str | None:
    severity = incident.get("severityLevel", "minor")
    last_updated = parse_observed_at(incident.get("lastUpdatedAt")) or now
    if severity == "critical":
        return None
    if severity == "major":
        return _to_iso(last_updated + timedelta(days=MAJOR_RETENTION_DAYS))
    return _to_iso(last_updated + timedelta(hours=MINOR_RETENTION_HOURS))


def build_incident_snapshot(incident: dict, now: datetime | None = None) -> dict | None:
    if not incident or not incident.get("id"):
        return None

    current_time = now or _now_utc()
    timeline = deepcopy(incident.get("timeline", []))
    return {
        "id": incident["id"],
        "canonicalId": incident.get("canonicalId"),
        "zoneId": _zone_id_from_incident(incident),
        "zoneLabel": incident.get("zoneLabel"),
        "severityLevel": incident.get("severityLevel", "minor"),
        "lifecycleState": incident.get("lifecycleState", "suspected"),
        "status": incident.get("status", "suspected"),
        "location": deepcopy(incident.get("location")),
        "firstObservedAt": incident.get("firstObservedAt"),
        "lastUpdatedAt": incident.get("lastUpdatedAt"),
        "ageMinutes": incident.get("ageMinutes"),
        "sources": deepcopy(incident.get("sources", [])),
        "signalsCount": len(incident.get("signals", [])),
        "timeline": timeline,
        "retentionUntil": _retention_until(incident, current_time),
    }


def store_incident_snapshot(incident: dict | None, now: datetime | None = None) -> dict | None:
    if not incident or not incident.get("id"):
        return None

    current_time = now or _now_utc()
    snapshot = build_incident_snapshot(incident, current_time)
    if not snapshot:
        return None

    snapshot_key = _snapshot_key(snapshot)
    if not snapshot_key:
        return None

    _INCIDENT_HISTORY[snapshot_key] = snapshot
    save_incident_snapshot(snapshot)
    cleanup_expired_history(current_time)
    return deepcopy(snapshot)


def cleanup_expired_history(now: datetime | None = None) -> None:
    current_time = now or _now_utc()
    expired_ids = []
    for incident_id, snapshot in _INCIDENT_HISTORY.items():
        retention_until = parse_observed_at(snapshot.get("retentionUntil"))
        if retention_until and retention_until < current_time:
            expired_ids.append(incident_id)
    for incident_id in expired_ids:
        _INCIDENT_HISTORY.pop(incident_id, None)
    cleanup_expired_persisted_incidents(current_time)


def list_recent_incidents(limit: int | None = None) -> list[dict]:
    cleanup_expired_history()
    merged: dict[str, dict] = {}

    for snapshot in list_persisted_incidents():
        snapshot_key = _snapshot_key(snapshot)
        if snapshot_key:
            merged[snapshot_key] = deepcopy(snapshot)

    for snapshot in _INCIDENT_HISTORY.values():
        snapshot_key = _snapshot_key(snapshot)
        if snapshot_key:
            merged[snapshot_key] = deepcopy(snapshot)

    items = sorted(
        merged.values(),
        key=lambda snapshot: (
            parse_observed_at(snapshot.get("lastUpdatedAt")) or datetime.min.replace(tzinfo=timezone.utc),
            parse_observed_at(snapshot.get("firstObservedAt")) or datetime.min.replace(tzinfo=timezone.utc),
        ),
        reverse=True,
    )
    if limit is not None:
        items = items[:limit]
    return deepcopy(items)


def list_recent_incidents_for_zone(zone_id: str) -> list[dict]:
    incident_id = f"incident-{zone_id}"
    merged: dict[str, dict] = {}
    for snapshot in list_recent_persisted_incidents_for_zone(zone_id):
        snapshot_key = _snapshot_key(snapshot)
        if snapshot_key:
            merged[snapshot_key] = deepcopy(snapshot)
    for snapshot in [item for item in _INCIDENT_HISTORY.values() if item.get("id") == incident_id]:
        snapshot_key = _snapshot_key(snapshot)
        if snapshot_key:
            merged[snapshot_key] = deepcopy(snapshot)
    items = sorted(
        merged.values(),
        key=lambda snapshot: (
            parse_observed_at(snapshot.get("lastUpdatedAt")) or datetime.min.replace(tzinfo=timezone.utc),
            parse_observed_at(snapshot.get("firstObservedAt")) or datetime.min.replace(tzinfo=timezone.utc),
        ),
        reverse=True,
    )
    return deepcopy(items)


def count_recent_incidents_near_zone(zone: dict, radius_km: float = NEARBY_HISTORY_RADIUS_KM) -> int:
    count = 0
    for snapshot in list_recent_incidents():
        location = snapshot.get("location") or {}
        latitude = location.get("latitude")
        longitude = location.get("longitude")
        if latitude is None or longitude is None:
            continue
        if haversine_km(zone["lat"], zone["lon"], latitude, longitude) <= radius_km:
            count += 1
    return count


def build_zone_history_context(zone: dict) -> dict:
    return {
        "incidentHistoryCount": len(list_recent_incidents_for_zone(zone["id"])),
        "recentIncidentsNearbyCount": count_recent_incidents_near_zone(zone),
    }
