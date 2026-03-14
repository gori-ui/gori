from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone

from gory_core.catalog import list_zones
from gory_core.citizen_reports import build_citizen_signal_feed
from gory_core.decision import get_zone_decision
from gory_core.fire_feed import build_zone_fire_signal_map, fetch_live_fire_feed
from gory_core.history import build_zone_history_context, store_incident_snapshot
from gory_core.incident_registry import resolve_incident_id
from gory_core.incidents import apply_incident_lifecycle
from gory_core.meteo import fetch_live_meteo_for_zones
from gory_core.operational_signals import build_operational_signal_feed
from gory_core.operator_dashboard import build_operator_incident_overview, build_operator_summary
from gory_core.routing import build_lower_risk_guidance
from gory_core.satellite_signals import build_satellite_signal_feed
from gory_core.signals import merge_signal_feed_snapshots

RUNTIME_CONTEXT_TTL_SECONDS = 10
_RUNTIME_CONTEXT_CACHE: dict[str, object] = {"builtAt": None, "context": None}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _cached_runtime_context_is_fresh() -> bool:
    built_at = _RUNTIME_CONTEXT_CACHE.get("builtAt")
    if not isinstance(built_at, datetime):
        return False
    return _now_utc() - built_at <= timedelta(seconds=RUNTIME_CONTEXT_TTL_SECONDS)


def _collect_context_incidents(context: dict) -> list[dict]:
    incidents = []
    for item in context["fireMap"].values():
        incident = (item or {}).get("incident")
        if incident and incident.get("canonicalId"):
            incidents.append(deepcopy(incident))
    incidents.sort(key=lambda item: item.get("lastUpdatedAt") or "", reverse=True)
    return incidents


def build_runtime_signal_feed() -> dict:
    wildfire_feed = fetch_live_fire_feed()
    satellite_feed = build_satellite_signal_feed()
    citizen_feed = build_citizen_signal_feed()
    operational_feed = build_operational_signal_feed()
    strategic_target = wildfire_feed.get("strategicTarget")
    extra_sources = []
    if satellite_feed.get("signals"):
        extra_sources.append("satellite anomalies")
    if operational_feed.get("signals"):
        extra_sources.append("operational confirmations")
    if citizen_feed.get("signals"):
        extra_sources.append("citizen reports")
    if extra_sources:
        strategic_target = f"{strategic_target} + " + " + ".join(extra_sources)
    return merge_signal_feed_snapshots(
        [wildfire_feed, satellite_feed, operational_feed, citizen_feed],
        category="wildfire_activity",
        provider="multi-source",
        source_class="mixed",
        strategic_target=strategic_target,
    )


def enrich_signal_map_with_incidents(zone_catalog: list[dict], live_meteo_map: dict[str, dict], signal_map: dict[str, dict]) -> dict[str, dict]:
    enriched = {}
    for zone in zone_catalog:
        item = apply_incident_lifecycle(zone, signal_map.get(zone["id"]), live_meteo_map.get(zone["id"]))
        incident = (item or {}).get("incident")
        if incident:
            incident["canonicalId"] = resolve_incident_id(incident)
        enriched[zone["id"]] = item
    return enriched


def update_incident_history(signal_map: dict[str, dict]) -> None:
    for item in signal_map.values():
        store_incident_snapshot(item.get("incident"))


def build_runtime_context(zone_catalog: list[dict] | None = None) -> dict:
    if _cached_runtime_context_is_fresh() and _RUNTIME_CONTEXT_CACHE.get("context"):
        return _RUNTIME_CONTEXT_CACHE["context"]  # type: ignore[return-value]

    zones = zone_catalog or list_zones()
    live_meteo_map = fetch_live_meteo_for_zones(zones)
    signal_feed = build_runtime_signal_feed()
    fire_map = enrich_signal_map_with_incidents(
        zones,
        live_meteo_map,
        build_zone_fire_signal_map(zones, signal_feed),
    )
    update_incident_history(fire_map)
    context = {
        "zoneCatalog": zones,
        "zonesById": {zone["id"]: zone for zone in zones},
        "liveMeteoMap": live_meteo_map,
        "fireMap": fire_map,
        "signalFeed": signal_feed,
    }
    _RUNTIME_CONTEXT_CACHE["builtAt"] = _now_utc()
    _RUNTIME_CONTEXT_CACHE["context"] = context
    return context


def get_incident_from_context(context: dict, canonical_id: str) -> dict | None:
    for incident in _collect_context_incidents(context):
        if incident.get("canonicalId") == canonical_id:
            return incident
    return None


def get_zone_decision_from_context(
    context: dict,
    zone_id: str,
    role_id: str,
    *,
    include_routing: bool = True,
) -> dict | None:
    zone = context["zonesById"].get(zone_id)
    if not zone:
        return None
    routing_summary = None
    if include_routing:
        routing_summary = build_lower_risk_guidance(
            zone,
            context["zoneCatalog"],
            context["liveMeteoMap"],
            context["fireMap"],
        )
    return get_zone_decision(
        zone_id,
        role_id,
        context["liveMeteoMap"].get(zone_id),
        context["fireMap"].get(zone_id),
        routing_summary,
        build_zone_history_context(zone),
    )


def list_active_incidents_from_context(context: dict) -> list[dict]:
    return _collect_context_incidents(context)


def build_operator_incident_overview_from_context(context: dict) -> list[dict]:
    return build_operator_incident_overview(
        context["zoneCatalog"],
        context["liveMeteoMap"],
        context["fireMap"],
    )


def build_operator_summary_from_context(context: dict) -> dict:
    return build_operator_summary(
        context["zoneCatalog"],
        context["liveMeteoMap"],
        context["fireMap"],
    )
