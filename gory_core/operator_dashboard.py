from __future__ import annotations

from gory_core.decision import get_zone_decision
from gory_core.incident_registry import list_active_incidents


SEVERITY_RANK = {
    "critical": 0,
    "major": 1,
    "minor": 2,
}

LIFECYCLE_RANK = {
    "active": 0,
    "suspected": 1,
    "contained": 2,
    "closed": 3,
}

SPREAD_RANK = {
    "high": 0,
    "moderate": 1,
    "low": 2,
    None: 3,
    "unavailable": 3,
}


def _priority_label(incident: dict, spread_pressure: str | None) -> str:
    severity = incident.get("severityLevel")
    lifecycle = incident.get("lifecycleState")
    if severity == "critical" and lifecycle == "active":
        return "immediate"
    if severity in {"critical", "major"} and lifecycle == "active":
        return "priority"
    if lifecycle in {"active", "suspected"} or spread_pressure in {"high", "moderate"}:
        return "monitor"
    return "watch"


def _sort_key(incident: dict) -> tuple:
    return (
        SEVERITY_RANK.get(incident.get("severityLevel"), 9),
        LIFECYCLE_RANK.get(incident.get("lifecycleState"), 9),
        SPREAD_RANK.get(incident.get("spreadPressure"), 9),
        -(incident.get("signalsCount") or 0),
        incident.get("lastUpdatedAt") or "",
    )


def build_operator_incident_overview(
    zone_catalog: list[dict],
    live_meteo_map: dict[str, dict],
    fire_map: dict[str, dict],
) -> list[dict]:
    zone_by_id = {zone["id"]: zone for zone in zone_catalog}
    overview = []
    for incident in list_active_incidents():
        zone_id = incident.get("zoneId")
        zone = zone_by_id.get(zone_id)
        decision = (
            get_zone_decision(
                zone_id,
                "official",
                live_meteo_map.get(zone_id),
                fire_map.get(zone_id),
            )
            if zone
            else None
        )
        spread_pressure = (decision.get("spread") or {}).get("spreadPressure") if decision else None
        overview.append(
            {
                **incident,
                "spreadPressure": spread_pressure,
                "incidentPriority": _priority_label(incident, spread_pressure),
            }
        )

    overview.sort(key=_sort_key)
    return overview


def build_operator_summary(zone_catalog: list[dict], live_meteo_map: dict[str, dict], fire_map: dict[str, dict]) -> dict:
    incidents = build_operator_incident_overview(zone_catalog, live_meteo_map, fire_map)
    active_incidents_count = len(incidents)
    critical_incidents_count = sum(1 for incident in incidents if incident.get("severityLevel") == "critical")
    active_critical_incidents_count = sum(
        1
        for incident in incidents
        if incident.get("severityLevel") == "critical" and incident.get("lifecycleState") == "active"
    )
    elevated_spread_incidents_count = sum(
        1 for incident in incidents if incident.get("spreadPressure") in {"high", "moderate"}
    )
    contained_incidents_count = sum(1 for incident in incidents if incident.get("lifecycleState") == "contained")
    operator_attention_count = sum(
        1 for incident in incidents if incident.get("incidentPriority") in {"immediate", "priority"}
    )

    zones_with_elevated_spread = 0
    for zone in zone_catalog:
        decision = get_zone_decision(
            zone["id"],
            "official",
            live_meteo_map.get(zone["id"]),
            fire_map.get(zone["id"]),
        )
        if not decision:
            continue

        if (decision.get("spread") or {}).get("spreadPressure") in {"moderate", "high"} and decision.get("incident"):
            zones_with_elevated_spread += 1

    return {
        "activeIncidentsCount": active_incidents_count,
        "criticalIncidentsCount": critical_incidents_count,
        "activeCriticalIncidentsCount": active_critical_incidents_count,
        "elevatedSpreadIncidentsCount": elevated_spread_incidents_count,
        "containedIncidentsCount": contained_incidents_count,
        "zonesWithElevatedSpread": zones_with_elevated_spread,
        "operatorAttentionCount": operator_attention_count,
    }
