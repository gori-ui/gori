from __future__ import annotations

from copy import deepcopy

SUPPORTED_API_ROLES = {"tourist", "field", "operator", "analyst"}
DEFAULT_API_ROLE = "tourist"
ENGINE_ROLE_BY_API_ROLE = {
    "tourist": "citizen",
    "field": "field",
    "operator": "official",
    "analyst": "explore",
}


def resolve_api_role(role: str | None) -> str | None:
    if role is None:
        return DEFAULT_API_ROLE
    return role if role in SUPPORTED_API_ROLES else None


def engine_role_for_api_role(role: str) -> str:
    return ENGINE_ROLE_BY_API_ROLE[role]


def _timeline_summary(timeline: list[dict] | None, limit: int = 3) -> list[dict]:
    items = timeline or []
    return [
        {
            "timestamp": item.get("timestamp"),
            "type": item.get("type"),
            "label": item.get("label"),
        }
        for item in items[-limit:]
    ]


def _zone_id_from_object(item: dict) -> str | None:
    if item.get("zoneId"):
        return item.get("zoneId")
    incident_id = item.get("id", "") or item.get("runtimeIncidentId", "")
    if incident_id.startswith("incident-"):
        return incident_id.removeprefix("incident-") or None
    return None


def _zone_label_from_object(item: dict) -> str | None:
    return item.get("zoneLabel")


def shape_incident_list_item_for_role(incident: dict, role: str) -> dict:
    if role == "tourist":
        return {
            "canonicalId": incident.get("canonicalId"),
            "zoneId": _zone_id_from_object(incident),
            "zoneLabel": _zone_label_from_object(incident),
            "severityLevel": incident.get("severityLevel"),
            "status": incident.get("status"),
            "lastUpdatedAt": incident.get("lastUpdatedAt"),
        }
    if role == "field":
        return {
            "canonicalId": incident.get("canonicalId"),
            "zoneId": _zone_id_from_object(incident),
            "zoneLabel": _zone_label_from_object(incident),
            "status": incident.get("status"),
            "lifecycleState": incident.get("lifecycleState"),
            "severityLevel": incident.get("severityLevel"),
            "lastUpdatedAt": incident.get("lastUpdatedAt"),
        }
    if role == "operator":
        return {
            "canonicalId": incident.get("canonicalId"),
            "zoneId": _zone_id_from_object(incident),
            "zoneLabel": _zone_label_from_object(incident),
            "status": incident.get("status"),
            "lifecycleState": incident.get("lifecycleState"),
            "severityLevel": incident.get("severityLevel"),
            "spreadPressure": incident.get("spreadPressure"),
            "incidentPriority": incident.get("incidentPriority"),
            "lastUpdatedAt": incident.get("lastUpdatedAt"),
        }
    return {
        "canonicalId": incident.get("canonicalId"),
        "zoneId": _zone_id_from_object(incident),
        "zoneLabel": _zone_label_from_object(incident),
        "status": incident.get("status"),
        "lifecycleState": incident.get("lifecycleState"),
        "severityLevel": incident.get("severityLevel"),
        "location": deepcopy(incident.get("location")),
        "firstObservedAt": incident.get("firstObservedAt"),
        "lastUpdatedAt": incident.get("lastUpdatedAt"),
    }


def _tourist_note(decision: dict) -> str:
    incident = decision.get("incident") or {}
    spread = decision.get("spread") or {}
    severity = ((decision.get("risk") or {}).get("severity") or {}).get("label", "Повишен")
    if incident:
        return f"{severity} пожарен риск в тази зона."
    if spread.get("spreadPressure") in {"moderate", "high"}:
        return "Има повишен риск от развитие на пожар при текущите условия."
    return "Следи локалните предупреждения и избягвай рискови дейности."


def shape_zone_risk_for_role(decision: dict, role: str) -> dict:
    incident = decision.get("incident") or {}
    spread = decision.get("spread") or {}
    fire_signal = decision.get("fireSignal") or {}
    base = {
        "zoneId": decision["zone"]["id"],
        "canonicalIncidentId": incident.get("canonicalId"),
        "incidentPresent": bool(incident),
        "incidentStatus": incident.get("status"),
        "incidentLifecycleState": incident.get("lifecycleState"),
        "incidentSeverityLevel": incident.get("severityLevel"),
        "spreadPressure": spread.get("spreadPressure"),
        "signalsCount": incident.get("signalsCount")
        or len(fire_signal.get("supportingSignals", [])) + (1 if fire_signal.get("primarySignal") else 0),
        # Compatibility aliases for existing consumers.
        "incidentSeverity": incident.get("severityLevel"),
        "incidentLifecycle": incident.get("lifecycleState"),
    }

    if role == "tourist":
        return base
    if role == "field":
        return {
            **base,
            "incidentLifecycle": incident.get("lifecycleState"),
            "higherRiskDirection": spread.get("higherRiskDirection"),
        }
    if role == "operator":
        return {
            **base,
            "incidentLifecycle": incident.get("lifecycleState"),
            "crossConfirmation": ((fire_signal.get("crossConfirmation") or {}).get("status")),
            "sources": incident.get("sources", []),
        }
    return {
        **base,
        "incident": deepcopy(incident),
        "spread": deepcopy(spread),
        "crossConfirmation": deepcopy(fire_signal.get("crossConfirmation")),
        "history": deepcopy(decision.get("history")),
    }


def shape_incident_for_role(incident: dict, role: str) -> dict:
    if role == "tourist":
        return {
            "canonicalId": incident.get("canonicalId"),
            "status": incident.get("status"),
            "severityLevel": incident.get("severityLevel"),
            "location": deepcopy(incident.get("location")),
            "lastUpdatedAt": incident.get("lastUpdatedAt"),
        }
    if role == "field":
        return {
            "canonicalId": incident.get("canonicalId"),
            "zoneId": _zone_id_from_object(incident),
            "zoneLabel": _zone_label_from_object(incident),
            "status": incident.get("status"),
            "severityLevel": incident.get("severityLevel"),
            "lifecycleState": incident.get("lifecycleState"),
            "location": deepcopy(incident.get("location")),
            "firstObservedAt": incident.get("firstObservedAt"),
            "lastUpdatedAt": incident.get("lastUpdatedAt"),
        }
    if role == "operator":
        return {
            "canonicalId": incident.get("canonicalId"),
            "zoneId": _zone_id_from_object(incident),
            "zoneLabel": _zone_label_from_object(incident),
            "runtimeIncidentId": incident.get("runtimeIncidentId"),
            "status": incident.get("status"),
            "severityLevel": incident.get("severityLevel"),
            "lifecycleState": incident.get("lifecycleState"),
            "location": deepcopy(incident.get("location")),
            "firstObservedAt": incident.get("firstObservedAt"),
            "lastUpdatedAt": incident.get("lastUpdatedAt"),
            "sources": deepcopy(incident.get("sources", [])),
            "signalsCount": incident.get("signalsCount"),
            "timelineSummary": _timeline_summary(incident.get("timeline")),
        }
    return deepcopy(incident)


def shape_incident_history_for_role(history_items: list[dict], role: str) -> list[dict]:
    if role == "analyst":
        return deepcopy(history_items)

    shaped = []
    for item in history_items:
        base = {
            "canonicalId": item.get("canonicalId"),
            "zoneId": _zone_id_from_object(item),
            "zoneLabel": _zone_label_from_object(item),
            "severityLevel": item.get("severityLevel"),
            "lifecycleState": item.get("lifecycleState"),
            "status": item.get("status"),
            "lastUpdatedAt": item.get("lastUpdatedAt"),
        }
        if role == "tourist":
            shaped.append(base)
        elif role == "field":
            shaped.append(
                {
                    **base,
                    "location": deepcopy(item.get("location")),
                }
            )
        else:
            shaped.append(
                {
                    **base,
                    "sources": deepcopy(item.get("sources", [])),
                    "signalsCount": item.get("signalsCount"),
                    "timelineSummary": _timeline_summary(item.get("timeline")),
                }
            )
    return shaped


def shape_decision_for_role(decision: dict, role: str) -> dict:
    incident = decision.get("incident") or {}
    spread = decision.get("spread") or {}
    fire_signal = decision.get("fireSignal") or {}

    if role == "analyst":
        return deepcopy(decision)

    if role == "tourist":
        return {
            "zone": {
                "id": decision["zone"]["id"],
                "label": decision["zone"]["label"],
                "region": decision["zone"]["region"],
            },
            "incidentPresent": bool(incident),
            "incidentSeverity": incident.get("severityLevel"),
            "spreadPressure": spread.get("spreadPressure"),
            "riskLevel": decision["risk"]["severity"]["label"],
            "note": _tourist_note(decision),
        }

    if role == "field":
        return {
            "zone": deepcopy(decision["zone"]),
            "risk": {
                "score": decision["risk"]["score"],
                "severity": decision["risk"]["severity"]["label"],
                "actionStatus": decision["risk"]["actionStatus"]["label"],
            },
            "incident": {
                "canonicalId": incident.get("canonicalId"),
                "zoneId": _zone_id_from_object(incident),
                "severityLevel": incident.get("severityLevel"),
                "lifecycleState": incident.get("lifecycleState"),
                "status": incident.get("status"),
            },
            "spread": {
                "spreadPressure": spread.get("spreadPressure"),
                "higherRiskDirection": spread.get("higherRiskDirection"),
                "lowerRiskDirection": spread.get("lowerRiskDirection"),
            },
            "routing": deepcopy(decision.get("routing")),
            "note": decision["risk"]["summary"],
        }

    return {
        "zone": deepcopy(decision["zone"]),
        "risk": deepcopy(decision["risk"]),
        "incident": {
            "canonicalId": incident.get("canonicalId"),
            "zoneId": _zone_id_from_object(incident),
            "severityLevel": incident.get("severityLevel"),
            "lifecycleState": incident.get("lifecycleState"),
            "status": incident.get("status"),
            "sources": deepcopy(incident.get("sources", [])),
            "signalsCount": incident.get("signalsCount"),
            "timelineSummary": _timeline_summary(incident.get("timeline")),
        },
        "spread": {
            "status": spread.get("status"),
            "spreadPressure": spread.get("spreadPressure"),
            "higherRiskDirection": spread.get("higherRiskDirection"),
            "lowerRiskDirection": spread.get("lowerRiskDirection"),
            "terrainInfluence": deepcopy(spread.get("terrainInfluence")),
            "note": spread.get("note"),
        },
        "crossConfirmation": deepcopy(fire_signal.get("crossConfirmation")),
        "routing": deepcopy(decision.get("routing")),
        "history": deepcopy(decision.get("history")),
        "note": decision["risk"]["summary"],
    }
