from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from gory_core.signals import parse_observed_at

BASE_DIR = Path(__file__).resolve().parent.parent
INCIDENTS_DIR = BASE_DIR / "data" / "incidents"


def _ensure_store_dir() -> None:
    INCIDENTS_DIR.mkdir(parents=True, exist_ok=True)


def _snapshot_path(canonical_id: str) -> Path:
    return INCIDENTS_DIR / f"{canonical_id}.json"


def _sort_key(snapshot: dict) -> tuple:
    return (
        parse_observed_at(snapshot.get("lastUpdatedAt")) or datetime.min.replace(tzinfo=timezone.utc),
        parse_observed_at(snapshot.get("firstObservedAt")) or datetime.min.replace(tzinfo=timezone.utc),
    )


def save_incident_snapshot(snapshot: dict | None) -> dict | None:
    if not snapshot or not snapshot.get("canonicalId"):
        return None

    _ensure_store_dir()
    path = _snapshot_path(snapshot["canonicalId"])
    path.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return deepcopy(snapshot)


def load_incident_snapshot(canonical_id: str) -> dict | None:
    path = _snapshot_path(canonical_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def list_persisted_incidents() -> list[dict]:
    if not INCIDENTS_DIR.exists():
        return []

    items = []
    for path in INCIDENTS_DIR.glob("*.json"):
        try:
            items.append(json.loads(path.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            continue
    items.sort(key=_sort_key, reverse=True)
    return items


def cleanup_expired_persisted_incidents(now: datetime | None = None) -> None:
    current_time = now or datetime.now(timezone.utc)
    for snapshot in list_persisted_incidents():
        retention_until = parse_observed_at(snapshot.get("retentionUntil"))
        canonical_id = snapshot.get("canonicalId")
        if canonical_id and retention_until and retention_until < current_time:
            path = _snapshot_path(canonical_id)
            if path.exists():
                path.unlink()


def list_recent_persisted_incidents_for_zone(zone_id: str) -> list[dict]:
    incident_id = f"incident-{zone_id}"
    cleanup_expired_persisted_incidents()
    return [snapshot for snapshot in list_persisted_incidents() if snapshot.get("id") == incident_id]
