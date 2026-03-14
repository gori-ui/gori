from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from gory_core.analyst_exports import (
    as_ndjson,
    build_incident_bundle,
    build_incident_history_bundle,
    build_zone_decision_snapshot,
)
from gory_core.citizen_reports import ingest_citizen_report
from gory_core.api_docs import build_api_docs
from gory_core.catalog import (
    clone,
    get_action_status_model,
    get_capabilities,
    get_role,
    get_severity_model,
    list_layer_groups,
    list_layers,
    list_roles,
    list_zones,
)
from gory_core.decision import build_alerts, get_national_status, get_zone_decision, list_zone_summaries
from gory_core.history_store import load_incident_snapshot
from gory_core.operational_signals import ingest_operational_signal
from gory_core.role_payloads import (
    engine_role_for_api_role,
    resolve_api_role,
    shape_decision_for_role,
    shape_incident_list_item_for_role,
    shape_incident_for_role,
    shape_incident_history_for_role,
    shape_zone_risk_for_role,
)
from gory_core.runtime_context import (
    build_operator_incident_overview_from_context,
    build_operator_summary_from_context,
    build_runtime_context,
    get_incident_from_context,
    get_zone_decision_from_context,
    list_active_incidents_from_context,
)
from gory_core.satellite_signals import ingest_satellite_signal

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="G.O.R.I. Decision Core")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class CitizenSignalIn(BaseModel):
    latitude: float
    longitude: float
    description: str | None = None


class OperationalSignalIn(BaseModel):
    latitude: float
    longitude: float
    description: str | None = None
    verification: str = "authority_confirmed"


class SatelliteSignalIn(BaseModel):
    latitude: float
    longitude: float
    description: str | None = None


def refresh_runtime_incident_state() -> None:
    build_runtime_context(list_zones())


def resolve_public_role_or_error(role: str | None):
    api_role = resolve_api_role(role)
    if not api_role:
        return None, JSONResponse({"error": "invalid_role"}, status_code=400)
    return api_role, None


def resolve_export_format_or_error(export_format: str | None):
    normalized = (export_format or "json").lower()
    if normalized not in {"json", "ndjson"}:
        return None, JSONResponse({"error": "invalid_format"}, status_code=400)
    return normalized, None


def export_response(payload, export_format: str):
    if export_format == "ndjson":
        return Response(as_ndjson(payload), media_type="application/x-ndjson; charset=utf-8")
    return JSONResponse(payload)


def build_runtime_layers(fire_feed: dict) -> list[dict]:
    layers = list_layers()
    for layer in layers:
        if layer["id"] == "live-fire-signals":
            if fire_feed.get("status") == "live":
                layer["status"] = "live"
                layer["explanation"] = "Live wildfire signal layer е активен; markers се показват само когато има сигнали в обхват."
            else:
                layer["status"] = "unavailable"
                layer["explanation"] = "Live wildfire signal layer не е достъпен в текущата среда."
    return layers


def build_runtime_capabilities(fire_feed: dict) -> dict:
    capabilities = clone(get_capabilities())
    if fire_feed.get("status") == "live":
        capabilities["liveNow"].append(
            {
                "id": "live-fire-feed",
                "label": "Live wildfire signals",
                "status": "live",
                "note": f"Runtime source: {fire_feed.get('provider')}. Strategic target остава {fire_feed.get('strategicTarget')}.",
            }
        )
    else:
        capabilities["prepared"].append(
            {
                "id": "live-fire-feed",
                "label": "Live wildfire signals",
                "status": "unavailable",
                "note": f"Strategic target е {fire_feed.get('strategicTarget')}, но текущият live feed не е достъпен.",
            }
        )
    return capabilities


def build_bootstrap_payload(role_id: str) -> dict:
    role = get_role(role_id)
    context = build_runtime_context(list_zones())
    zone_catalog = context["zoneCatalog"]
    live_meteo_map = context["liveMeteoMap"]
    live_fire_signal_map = context["fireMap"]
    signal_feed = context["signalFeed"]
    fire_signal_markers = []
    incident_markers = []
    seen_signal_ids = set()
    seen_incident_ids = set()
    for item in live_fire_signal_map.values():
        incident = item.get("incident")
        incident_id = incident.get("id") if incident else None
        if incident_id and incident_id not in seen_incident_ids:
            seen_incident_ids.add(incident_id)
            incident_markers.append(incident)
        signal = item.get("primarySignal")
        if item.get("status") != "live" or not signal:
            continue
        signal_id = signal.get("id")
        if signal_id in seen_signal_ids:
            continue
        seen_signal_ids.add(signal_id)
        fire_signal_markers.append(signal)
        for supporting in item.get("supportingSignals", []):
            supporting_id = supporting.get("id")
            if not supporting_id or supporting_id in seen_signal_ids:
                continue
            seen_signal_ids.add(supporting_id)
            fire_signal_markers.append(supporting)
    return {
        "product": {
            "name": "Г.О.Р.И. / HazardWatch",
            "subtitle": "Decision Core for national wildfire intelligence in Bulgaria",
        },
        "activeRole": role,
        "roles": list_roles(),
        "severityModel": get_severity_model(),
        "actionStatusModel": get_action_status_model(),
        "layers": build_runtime_layers(signal_feed),
        "layerGroups": list_layer_groups(),
        "capabilities": build_runtime_capabilities(signal_feed),
        "nationalStatus": get_national_status(role["id"], live_meteo_map, live_fire_signal_map),
        "zones": list_zone_summaries(role["id"], live_meteo_map, live_fire_signal_map),
        "alerts": build_alerts(role["id"], live_meteo_map, live_fire_signal_map),
        "fireFeed": signal_feed,
        "incidentMarkers": incident_markers,
        "fireSignalMarkers": fire_signal_markers,
    }


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/bootstrap")
def api_bootstrap(role: str = "citizen"):
    return JSONResponse(build_bootstrap_payload(role))


@app.get("/api/decision/{zone_id}")
def api_decision(zone_id: str, role: str = "citizen"):
    context = build_runtime_context(list_zones())
    zone = context["zonesById"].get(zone_id)
    payload = get_zone_decision_from_context(context, zone_id, role) if zone else None
    if not payload:
        return JSONResponse({"error": "zone_not_found"}, status_code=404)
    return JSONResponse(payload)


@app.get("/api/zones")
def api_zones():
    return JSONResponse(
        [
            {
                "id": zone["id"],
                "label": zone["label"],
                "region": zone["region"],
                "location": {
                    "latitude": zone["lat"],
                    "longitude": zone["lon"],
                },
            }
            for zone in list_zones()
        ]
    )


@app.get("/api/zones/{zone_id}/risk")
def api_zone_risk(zone_id: str, role: str | None = None):
    api_role, error = resolve_public_role_or_error(role)
    if error:
        return error
    context = build_runtime_context(list_zones())
    zone = context["zonesById"].get(zone_id)
    if not zone:
        return JSONResponse({"error": "zone_not_found"}, status_code=404)
    decision = get_zone_decision_from_context(
        context,
        zone_id,
        engine_role_for_api_role(api_role),
        include_routing=False,
    )
    return JSONResponse(shape_zone_risk_for_role(decision, api_role))


@app.get("/api/incidents")
def api_incidents(role: str | None = None):
    api_role, error = resolve_public_role_or_error(role)
    if error:
        return error
    context = build_runtime_context(list_zones())
    if api_role == "operator":
        incidents = build_operator_incident_overview_from_context(context)
    else:
        incidents = list_active_incidents_from_context(context)
    return JSONResponse(
        [shape_incident_list_item_for_role(incident, api_role) for incident in incidents]
    )


@app.get("/api/incidents/{canonical_id}")
def api_incident_detail(canonical_id: str, role: str | None = None):
    api_role, error = resolve_public_role_or_error(role)
    if error:
        return error
    context = build_runtime_context(list_zones())
    incident = get_incident_from_context(context, canonical_id)
    if not incident:
        return JSONResponse({"error": "incident_not_found"}, status_code=404)
    return JSONResponse(shape_incident_for_role(incident, api_role))


@app.get("/api/incidents/{canonical_id}/history")
def api_incident_history(canonical_id: str, role: str | None = None):
    api_role, error = resolve_public_role_or_error(role)
    if error:
        return error
    snapshot = load_incident_snapshot(canonical_id)
    if not snapshot:
        return JSONResponse({"error": "incident_not_found"}, status_code=404)
    return JSONResponse(shape_incident_history_for_role([snapshot], api_role))


@app.get("/api/zones/{zone_id}/decision")
def api_zone_decision(zone_id: str, role: str | None = None):
    api_role, error = resolve_public_role_or_error(role)
    if error:
        return error

    context = build_runtime_context(list_zones())
    zone = context["zonesById"].get(zone_id)
    if not zone:
        return JSONResponse({"error": "zone_not_found"}, status_code=404)
    payload = get_zone_decision_from_context(context, zone_id, engine_role_for_api_role(api_role))
    if not payload:
        return JSONResponse({"error": "zone_not_found"}, status_code=404)
    return JSONResponse(shape_decision_for_role(payload, api_role))


@app.get("/api/operator/summary")
def api_operator_summary():
    context = build_runtime_context(list_zones())
    return JSONResponse(build_operator_summary_from_context(context))


@app.get("/api/analyst/incidents")
def api_analyst_incidents(format: str = "json"):
    export_format, error = resolve_export_format_or_error(format)
    if error:
        return error
    context = build_runtime_context(list_zones())
    payload = [shape_incident_list_item_for_role(incident, "analyst") for incident in list_active_incidents_from_context(context)]
    return export_response(payload, export_format)


@app.get("/api/analyst/incidents/{canonical_id}/bundle")
def api_analyst_incident_bundle(canonical_id: str, format: str = "json"):
    export_format, error = resolve_export_format_or_error(format)
    if error:
        return error

    context = build_runtime_context(list_zones())
    incident = get_incident_from_context(context, canonical_id)
    if not incident:
        return JSONResponse({"error": "incident_not_found"}, status_code=404)

    zone_id = incident.get("zoneId")
    if not zone_id:
        return JSONResponse({"error": "zone_not_found"}, status_code=404)

    decision = get_zone_decision_from_context(
        context,
        zone_id,
        engine_role_for_api_role("analyst"),
    )
    if not decision:
        return JSONResponse({"error": "zone_not_found"}, status_code=404)

    snapshot = load_incident_snapshot(canonical_id)
    history_items = shape_incident_history_for_role(
        [snapshot] if snapshot else [],
        "analyst",
    )
    payload = build_incident_bundle(incident, decision, history_items)
    return export_response(payload, export_format)


@app.get("/api/analyst/incidents/{canonical_id}/history")
def api_analyst_incident_history(canonical_id: str, format: str = "json"):
    export_format, error = resolve_export_format_or_error(format)
    if error:
        return error

    snapshot = load_incident_snapshot(canonical_id)
    if not snapshot:
        return JSONResponse({"error": "incident_not_found"}, status_code=404)
    payload = build_incident_history_bundle(
        canonical_id,
        shape_incident_history_for_role([snapshot], "analyst"),
    )
    return export_response(payload, export_format)


@app.get("/api/analyst/zones/{zone_id}/decision-snapshot")
def api_analyst_zone_decision_snapshot(zone_id: str, format: str = "json"):
    export_format, error = resolve_export_format_or_error(format)
    if error:
        return error

    context = build_runtime_context(list_zones())
    payload = get_zone_decision_from_context(
        context,
        zone_id,
        engine_role_for_api_role("analyst"),
    )
    if not payload:
        return JSONResponse({"error": "zone_not_found"}, status_code=404)
    return export_response(build_zone_decision_snapshot(payload), export_format)


@app.get("/api/capabilities")
def api_capabilities():
    return JSONResponse(get_capabilities())


@app.get("/api/docs")
def api_docs():
    return JSONResponse(build_api_docs())


@app.post("/api/signals/citizen")
def api_citizen_signal(payload: CitizenSignalIn):
    signal = ingest_citizen_report(payload.latitude, payload.longitude, payload.description)
    return JSONResponse(signal)


@app.post("/api/signals/operational")
def api_operational_signal(payload: OperationalSignalIn):
    signal = ingest_operational_signal(
        payload.latitude,
        payload.longitude,
        payload.description,
        payload.verification,
    )
    return JSONResponse(signal)


@app.post("/api/signals/satellite")
def api_satellite_signal(payload: SatelliteSignalIn):
    signal = ingest_satellite_signal(
        payload.latitude,
        payload.longitude,
        payload.description,
    )
    return JSONResponse(signal)
