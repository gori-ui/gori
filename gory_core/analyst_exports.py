from __future__ import annotations

import json
from copy import deepcopy


def build_incident_bundle(incident: dict, zone_decision: dict, history_items: list[dict]) -> dict:
    spread = deepcopy(zone_decision.get("spread") or {})
    return {
        "canonicalId": incident.get("canonicalId"),
        "zone": deepcopy(zone_decision.get("zone")),
        "risk": deepcopy(zone_decision.get("risk")),
        "incident": deepcopy(incident),
        "spread": spread,
        "terrainInfluence": deepcopy(spread.get("terrainInfluence")),
        "crossConfirmation": deepcopy(zone_decision.get("crossConfirmation")),
        "routing": deepcopy(zone_decision.get("routing")),
        "timeline": deepcopy(incident.get("timeline", [])),
        "history": deepcopy(history_items),
    }


def build_zone_decision_snapshot(zone_decision: dict) -> dict:
    spread = deepcopy(zone_decision.get("spread") or {})
    return {
        "zone": deepcopy(zone_decision.get("zone")),
        "risk": deepcopy(zone_decision.get("risk")),
        "spread": spread,
        "terrainInfluence": deepcopy(spread.get("terrainInfluence")),
        "routing": deepcopy(zone_decision.get("routing")),
        "incident": deepcopy(zone_decision.get("incident")),
        "crossConfirmation": deepcopy(zone_decision.get("crossConfirmation")),
        "history": deepcopy(zone_decision.get("history")),
        "note": zone_decision.get("note"),
    }


def build_incident_history_bundle(canonical_id: str, history_items: list[dict]) -> dict:
    return {
        "canonicalId": canonical_id,
        "history": deepcopy(history_items),
    }


def as_ndjson(data) -> str:
    if isinstance(data, list):
        lines = data
    elif isinstance(data, dict) and isinstance(data.get("history"), list) and set(data.keys()) == {"canonicalId", "history"}:
        lines = data["history"]
    else:
        lines = [data]
    return "\n".join(json.dumps(item, ensure_ascii=False) for item in lines)
