from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from gory_core.spread import build_spread_summary


INCIDENT_GROUPING_DISTANCE_KM = 30.0
CONTAINED_WINDOW_MINUTES = 180
CLOSED_WINDOW_MINUTES = 720
_INCIDENT_RUNTIME: dict[str, dict] = {}


def parse_observed_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def derive_incident_status(primary_signal: dict, supporting_signals: list[dict], cross_confirmation: dict) -> str:
    source_class = primary_signal.get("sourceClass")
    cross_status = (cross_confirmation or {}).get("status", "none")
    signal_count = 1 + len(supporting_signals)

    if source_class == "verified_operational" or cross_status == "strong":
        return "confirmed"
    if source_class == "automated_remote_sensing" or cross_status == "moderate" or signal_count >= 2:
        return "active"
    return "suspected"


def build_incident_note(incident: dict | None) -> str | None:
    if not incident:
        return None
    lifecycle_state = incident.get("lifecycleState")
    severity_level = incident.get("severityLevel")
    note = None
    if lifecycle_state == "active":
        note = "Incident lifecycle: active."
    elif lifecycle_state == "contained":
        note = "Incident lifecycle: contained."
    elif lifecycle_state == "closed":
        note = "Incident lifecycle: closed."
    elif lifecycle_state == "suspected":
        note = "Incident lifecycle: suspected."
    if note and severity_level:
        return f"{note} Incident severity: {severity_level}."
    status = incident.get("status")
    if status:
        return f"Incident lifecycle: {status}."
    return None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(value: datetime | None) -> str | None:
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _minutes_since(value: str | None, now: datetime) -> int | None:
    observed = parse_observed_at(value)
    if not observed:
        return None
    return max(0, int((now - observed.astimezone(timezone.utc)).total_seconds() // 60))


def _signal_label(signal: dict) -> str:
    return signal.get("title") or signal.get("summary") or "Signal added"


def _cross_rank(status: str) -> int:
    return {
        "none": 0,
        "weak": 1,
        "moderate": 2,
        "strong": 3,
    }.get(status, 0)


def _spread_rank(pressure: str) -> int:
    return {
        "low": 0,
        "moderate": 1,
        "high": 2,
    }.get(pressure, 0)


def _derive_lifecycle_state(incident: dict, signal_summary: dict, spread_summary: dict, now: datetime) -> str:
    age_since_update = _minutes_since(incident.get("lastUpdatedAt"), now)
    incident_status = incident.get("status")
    cross_status = (signal_summary.get("crossConfirmation") or {}).get("status", "none")
    spread_pressure = spread_summary.get("spreadPressure", "low")
    source_classes = set(incident.get("sources", []))
    has_strong_pressure = (
        incident_status in {"active", "confirmed"}
        or cross_status in {"moderate", "strong"}
        or "automated_remote_sensing" in source_classes
        or "verified_operational" in source_classes
    )

    if age_since_update is None:
        return "suspected"
    if age_since_update >= CLOSED_WINDOW_MINUTES and cross_status in {"none", "weak"} and "verified_operational" not in source_classes:
        return "closed"
    if age_since_update >= CONTAINED_WINDOW_MINUTES and spread_pressure != "high" and not has_strong_pressure:
        return "contained"
    if has_strong_pressure and age_since_update < CONTAINED_WINDOW_MINUTES:
        return "active"
    if incident_status == "suspected":
        return "suspected"
    if age_since_update >= CONTAINED_WINDOW_MINUTES and spread_pressure != "high":
        return "contained"
    return "active"


def _derive_severity_level(incident: dict, signal_summary: dict, spread_summary: dict) -> str:
    lifecycle_state = incident.get("lifecycleState")
    incident_status = incident.get("status")
    confidence_level = incident.get("confidenceLevel", "low")
    cross_status = (signal_summary.get("crossConfirmation") or {}).get("status", "none")
    spread_pressure = spread_summary.get("spreadPressure", "low")
    source_classes = set(incident.get("sources", []))

    if (
        lifecycle_state == "active"
        and incident_status == "confirmed"
        and confidence_level == "high"
        and spread_pressure == "high"
        and ("verified_operational" in source_classes or cross_status == "strong")
    ):
        return "critical"

    if (
        lifecycle_state in {"active", "contained"}
        and (
            confidence_level in {"medium", "high"}
            or cross_status in {"moderate", "strong"}
            or spread_pressure in {"moderate", "high"}
            or incident_status in {"active", "confirmed"}
        )
    ):
        return "major"

    return "minor"


def _build_timeline(
    incident_id: str,
    incident: dict,
    signal_summary: dict,
    spread_summary: dict,
    now: datetime,
) -> list[dict]:
    runtime_state = _INCIDENT_RUNTIME.get(incident_id, {})
    previous_signals = set(runtime_state.get("signals", []))
    previous_cross = runtime_state.get("crossStatus", "none")
    previous_spread = runtime_state.get("spreadPressure", "low")
    previous_lifecycle = runtime_state.get("lifecycleState")
    timeline = deepcopy(runtime_state.get("timeline", []))

    if not timeline:
        timeline.append(
            {
                "timestamp": incident.get("firstObservedAt") or _to_iso(now),
                "type": "incident_created",
                "label": "Incident created from nearby wildfire signals",
            }
        )

    signal_lookup = {
        signal.get("id"): signal
        for signal in [signal_summary.get("primarySignal"), *(signal_summary.get("supportingSignals") or [])]
        if signal and signal.get("id")
    }
    current_signals = set(incident.get("signals", []))
    for signal_id in sorted(current_signals - previous_signals):
        signal = signal_lookup.get(signal_id) or {}
        timeline.append(
            {
                "timestamp": signal.get("observedAt") or incident.get("lastUpdatedAt") or _to_iso(now),
                "type": "signal_added",
                "label": _signal_label(signal),
            }
        )

    current_cross = (signal_summary.get("crossConfirmation") or {}).get("status", "none")
    if _cross_rank(current_cross) > _cross_rank(previous_cross) and current_cross != "none":
        timeline.append(
            {
                "timestamp": incident.get("lastUpdatedAt") or _to_iso(now),
                "type": "cross_confirmation",
                "label": (signal_summary.get("crossConfirmation") or {}).get("note") or "Signal confidence increased due to nearby multi-source support",
            }
        )

    current_spread = spread_summary.get("spreadPressure", "low")
    if _spread_rank(current_spread) > _spread_rank(previous_spread):
        timeline.append(
            {
                "timestamp": _to_iso(now),
                "type": "spread_pressure_increased",
                "label": spread_summary.get("note") or "Environmental spread pressure increased",
            }
        )

    lifecycle_state = incident.get("lifecycleState")
    if lifecycle_state and lifecycle_state != previous_lifecycle:
        timeline.append(
            {
                "timestamp": _to_iso(now),
                "type": "lifecycle_changed",
                "label": f"Incident moved to {lifecycle_state} state",
            }
        )

    current_severity = incident.get("severityLevel")
    previous_severity = runtime_state.get("severityLevel")
    if current_severity and current_severity != previous_severity:
        timeline.append(
            {
                "timestamp": _to_iso(now),
                "type": "severity_changed",
                "label": f"Incident severity set to {current_severity}",
            }
        )

    trimmed_timeline = timeline[-6:]
    _INCIDENT_RUNTIME[incident_id] = {
        "signals": sorted(current_signals),
        "crossStatus": current_cross,
        "spreadPressure": current_spread,
        "lifecycleState": lifecycle_state,
        "severityLevel": current_severity,
        "timeline": deepcopy(trimmed_timeline),
    }
    return trimmed_timeline


def build_incident_from_signal_summary(zone: dict, signal_summary: dict | None) -> dict | None:
    if not signal_summary or signal_summary.get("status") != "live":
        return None

    primary_signal = signal_summary.get("primarySignal")
    if not primary_signal:
        return None

    cross_confirmation = signal_summary.get("crossConfirmation") or {"status": "none", "basis": [], "note": None}
    supporting_signals = [
        signal
        for signal in signal_summary.get("supportingSignals", [])
        if (signal.get("distanceToZoneKm") or 9999) <= INCIDENT_GROUPING_DISTANCE_KM
    ]
    contributing_signals = [primary_signal, *supporting_signals]
    if not contributing_signals:
        return None

    signal_ids = [signal.get("id") for signal in contributing_signals if signal.get("id")]
    signal_ids_sorted = sorted(signal_ids)
    incident_id = f"incident-{zone['id']}"

    latitudes = [signal["location"]["latitude"] for signal in contributing_signals if signal.get("location")]
    longitudes = [signal["location"]["longitude"] for signal in contributing_signals if signal.get("location")]

    observed_values = [signal.get("observedAt") for signal in contributing_signals if signal.get("observedAt")]
    parsed_times = [parse_observed_at(value) for value in observed_values]
    parsed_times = [item for item in parsed_times if item]

    first_observed = None
    last_updated = None
    if parsed_times:
        first_observed = min(parsed_times).isoformat().replace("+00:00", "Z")
        last_updated = max(parsed_times).isoformat().replace("+00:00", "Z")

    return {
        "id": incident_id,
        "zoneId": zone["id"],
        "zoneLabel": zone["label"],
        "status": derive_incident_status(primary_signal, supporting_signals, cross_confirmation),
        "location": {
            "latitude": round(sum(latitudes) / len(latitudes), 4) if latitudes else zone["lat"],
            "longitude": round(sum(longitudes) / len(longitudes), 4) if longitudes else zone["lon"],
        },
        "signals": signal_ids_sorted,
        "primarySignal": primary_signal.get("id"),
        "confidenceLevel": signal_summary.get("confidenceLevel", "low"),
        "sources": sorted({signal.get("sourceClass") for signal in contributing_signals if signal.get("sourceClass")}),
        "firstObservedAt": first_observed,
        "lastUpdatedAt": last_updated,
    }


def apply_incident_lifecycle(zone: dict, signal_summary: dict | None, meteo_snapshot: dict | None) -> dict | None:
    if not signal_summary:
        return signal_summary

    incident = signal_summary.get("incident")
    if not incident:
        return signal_summary

    now = _now_utc()
    incident_copy = deepcopy(incident)
    risk_score = 0
    primary_signal = signal_summary.get("primarySignal") or {}
    if primary_signal:
        confidence_level = signal_summary.get("confidenceLevel")
        if confidence_level == "high":
            risk_score = 70
        elif confidence_level == "medium":
            risk_score = 50
        else:
            risk_score = 30
    spread_summary = build_spread_summary(zone, meteo_snapshot, signal_summary, risk_score)
    lifecycle_state = _derive_lifecycle_state(incident_copy, signal_summary, spread_summary, now)
    incident_copy["lifecycleState"] = lifecycle_state
    incident_copy["severityLevel"] = _derive_severity_level(incident_copy, signal_summary, spread_summary)
    incident_copy["ageMinutes"] = _minutes_since(incident_copy.get("firstObservedAt"), now)
    incident_copy["timeline"] = _build_timeline(incident_copy["id"], incident_copy, signal_summary, spread_summary, now)

    updated_summary = deepcopy(signal_summary)
    updated_summary["incident"] = incident_copy
    return updated_summary
