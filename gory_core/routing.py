from __future__ import annotations

import math

from gory_core.catalog import get_zone_neighbors
from gory_core.decision import score_zone
from gory_core.spread import build_spread_summary
from gory_core.signals import haversine_km

LOCAL_ROUTE_MAX_DISTANCE_KM = 95.0
LOCAL_ROUTE_WARNING_DISTANCE_KM = 70.0
MATERIALLY_HIGH_RISK_THRESHOLD = 0.58
MIN_MEANINGFUL_RISK_DELTA = 0.08


def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, value))


def bearing_to_direction(origin: dict, target: dict) -> str:
    dy = target["lat"] - origin["lat"]
    dx = target["lon"] - origin["lon"]
    angle = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    directions = [
        "север",
        "североизток",
        "изток",
        "югоизток",
        "юг",
        "югозапад",
        "запад",
        "северозапад",
    ]
    return directions[int((angle + 22.5) // 45) % 8]


def build_unavailable_routing_summary(origin: dict, note: str) -> dict:
    return {
        "status": "unavailable",
        "origin": {
            "latitude": origin["lat"],
            "longitude": origin["lon"],
            "label": origin["label"],
        },
        "target": None,
        "direction": None,
        "distanceKm": None,
        "riskScore": None,
        "travelCost": None,
        "avoid": [],
        "basis": ["current zone risk"],
        "confidenceLevel": "low",
        "note": note,
    }


def travel_cost_label(distance_km: float) -> str:
    if distance_km <= 35:
        return "кратко преместване към съседна зона"
    if distance_km <= 80:
        return "локален преход"
    return "удължен локален преход"


def meteo_penalty(meteo_snapshot: dict | None) -> float:
    if not meteo_snapshot:
        return 0.0
    values = (meteo_snapshot or {}).get("values", {})
    penalty = 0.0
    wind = values.get("wind_kmh")
    humidity = values.get("humidity_pct")
    temperature = values.get("temperature_c")
    if wind is not None and wind >= 25:
        penalty += 0.08
    elif wind is not None and wind >= 15:
        penalty += 0.04
    if humidity is not None and humidity <= 30:
        penalty += 0.06
    elif humidity is not None and humidity <= 45:
        penalty += 0.03
    if temperature is not None and temperature >= 32:
        penalty += 0.04
    elif temperature is not None and temperature >= 26:
        penalty += 0.02
    return penalty


def fire_penalty(signal_summary: dict | None) -> float:
    if not signal_summary:
        return 0.0
    if signal_summary.get("status") != "live":
        return 0.0
    source_class = signal_summary.get("sourceClass")
    if source_class == "human_reported":
        penalty = 0.07
    elif source_class == "verified_operational":
        penalty = 0.22
    else:
        penalty = 0.18
    confidence_level = signal_summary.get("confidenceLevel")
    if confidence_level == "high":
        penalty += 0.05
    elif confidence_level == "medium":
        penalty += 0.02
    cross_status = (signal_summary.get("crossConfirmation") or {}).get("status", "none")
    if cross_status == "weak":
        penalty += 0.01
    elif cross_status == "moderate":
        penalty += 0.03
    elif cross_status == "strong":
        penalty += 0.06
    incident = signal_summary.get("incident") or {}
    lifecycle_state = incident.get("lifecycleState")
    if lifecycle_state == "active":
        penalty += 0.02
    elif lifecycle_state == "contained":
        penalty += 0.01
    elif not lifecycle_state:
        if incident.get("status") == "active":
            penalty += 0.02
        elif incident.get("status") == "confirmed":
            penalty += 0.05
    severity_level = incident.get("severityLevel")
    if severity_level == "major":
        penalty += 0.02
    elif severity_level == "critical":
        penalty += 0.05
    return penalty


def terrain_penalty(zone: dict) -> float:
    terrain = zone.get("drivers", {}).get("terrain", 0.0)
    if terrain >= 0.8:
        return 0.06
    if terrain >= 0.65:
        return 0.03
    return 0.0


def aggregated_zone_risk(zone: dict, live_meteo: dict | None, signal_summary: dict | None) -> float:
    base_risk = score_zone(zone, live_meteo, signal_summary) / 100
    adjusted = base_risk + meteo_penalty(live_meteo) + fire_penalty(signal_summary) + terrain_penalty(zone)
    return clamp(round(adjusted, 3))


def spread_direction_penalty(candidate_direction: str, spread_summary: dict | None) -> float:
    if not spread_summary or spread_summary.get("status") == "unavailable":
        return 0.0
    pressure = spread_summary.get("spreadPressure")
    terrain_pressure = (spread_summary.get("terrainInfluence") or {}).get("terrainPressure")
    terrain_bonus = {
        "low": 0.0,
        "moderate": 0.01,
        "high": 0.02,
    }.get(terrain_pressure, 0.0)
    if candidate_direction == spread_summary.get("higherRiskDirection"):
        return {
            "low": 0.02,
            "moderate": 0.05,
            "high": 0.09,
        }.get(pressure, 0.0) + terrain_bonus
    if candidate_direction == spread_summary.get("lowerRiskDirection"):
        return {
            "low": -0.01,
            "moderate": -0.03,
            "high": -0.05,
        }.get(pressure, 0.0) - min(terrain_bonus, 0.01)
    return 0.0


def derive_routing_confidence(best_candidate: dict | None, origin_meteo: dict | None, candidates: list[dict]) -> str:
    if not best_candidate:
        return "low"

    best_signal = best_candidate.get("signalSummary", {})
    if best_signal.get("confidenceLevel") == "high" and (origin_meteo or {}).get("status") == "live":
        return "high"

    if (origin_meteo or {}).get("status") in {"live", "partial"} or len(candidates) > 1:
        return "medium"

    return "low"


def build_avoid_notes(origin_zone: dict, candidates: list[dict], best_candidate: dict | None, origin_signal: dict | None) -> list[str]:
    notes = []
    if origin_signal and origin_signal.get("status") == "live":
        notes.append("коридор близо до активен сигнал")

    for candidate in candidates:
        if best_candidate and candidate["zone"]["id"] == best_candidate["zone"]["id"]:
            continue
        reasons = []
        if candidate["signalSummary"].get("status") == "live":
            reasons.append("active signal")
        if candidate["riskScore"] >= 60:
            reasons.append("high neighboring risk")
        if reasons:
            notes.append(f"{candidate['direction']} към {candidate['zone']['label']}")
        if len(notes) >= 2:
            break
    return notes


def build_lower_risk_guidance(
    origin_zone: dict,
    zone_catalog: list[dict],
    live_meteo_map: dict[str, dict] | None = None,
    live_signal_map: dict[str, dict] | None = None,
) -> dict:
    neighbor_ids = get_zone_neighbors(origin_zone["id"])
    if not neighbor_ids:
        return build_unavailable_routing_summary(origin_zone, "Липсва достатъчна zone adjacency основа за lower-risk guidance.")

    zones_by_id = {zone["id"]: zone for zone in zone_catalog}
    origin_meteo = (live_meteo_map or {}).get(origin_zone["id"])
    origin_signal = (live_signal_map or {}).get(origin_zone["id"])
    current_risk = aggregated_zone_risk(origin_zone, origin_meteo, origin_signal)
    origin_spread = build_spread_summary(origin_zone, origin_meteo, origin_signal, score_zone(origin_zone, origin_meteo, origin_signal))

    candidates = []
    distant_candidates = []
    for neighbor_id in neighbor_ids:
        neighbor_zone = zones_by_id.get(neighbor_id)
        if not neighbor_zone:
            continue

        neighbor_meteo = (live_meteo_map or {}).get(neighbor_id)
        neighbor_signal = (live_signal_map or {}).get(neighbor_id)
        distance_km = round(
            haversine_km(origin_zone["lat"], origin_zone["lon"], neighbor_zone["lat"], neighbor_zone["lon"]),
            1,
        )
        risk_score = score_zone(neighbor_zone, neighbor_meteo, neighbor_signal)
        aggregated_risk = aggregated_zone_risk(neighbor_zone, neighbor_meteo, neighbor_signal)
        candidate = {
            "zone": neighbor_zone,
            "direction": bearing_to_direction(origin_zone, neighbor_zone),
            "distanceKm": distance_km,
            "riskScore": risk_score,
            "aggregatedRisk": clamp(aggregated_risk + spread_direction_penalty(bearing_to_direction(origin_zone, neighbor_zone), origin_spread)),
            "signalSummary": neighbor_signal or {},
        }

        if distance_km > LOCAL_ROUTE_MAX_DISTANCE_KM:
            distant_candidates.append(candidate)
            continue

        candidates.append(
            candidate
        )

    if not candidates:
        note = "Няма достатъчна near-local lower-risk опция в съседните зони."
        if distant_candidates:
            note = "Наличните по-ниски рискови опции са извън локалния обхват за тази фаза."
        return build_unavailable_routing_summary(origin_zone, note)

    candidates.sort(key=lambda item: (item["aggregatedRisk"], item["distanceKm"], item["riskScore"]))
    best_candidate = candidates[0]
    confidence_level = derive_routing_confidence(best_candidate, origin_meteo, candidates)
    avoid_notes = build_avoid_notes(origin_zone, candidates, best_candidate, origin_signal)

    basis = ["current zone risk", "neighboring zones"]
    if any((live_meteo_map or {}).get(item["zone"]["id"], {}).get("status") in {"live", "partial"} for item in candidates) or (origin_meteo or {}).get("status") in {"live", "partial"}:
        basis.append("meteo")
    if any(item["signalSummary"].get("status") == "live" for item in candidates) or (origin_signal or {}).get("status") == "live":
        basis.append("fire signal")
    if origin_spread.get("status") in {"available", "limited"}:
        basis.append("wind spread pressure")
    basis.append("terrain")

    risk_delta = current_risk - best_candidate["aggregatedRisk"]
    all_candidates_high_risk = all(candidate["aggregatedRisk"] >= MATERIALLY_HIGH_RISK_THRESHOLD for candidate in candidates)
    if all_candidates_high_risk:
        return {
            "status": "limited",
            "origin": {
                "latitude": origin_zone["lat"],
                "longitude": origin_zone["lon"],
                "label": origin_zone["label"],
            },
            "target": None,
            "direction": None,
            "distanceKm": None,
            "riskScore": None,
            "travelCost": None,
            "avoid": [f"{candidate['direction']} към {candidate['zone']['label']}" for candidate in candidates[:2]],
            "basis": basis,
            "confidenceLevel": "low",
            "note": "Всички near-local съседни опции остават материално високорискови.",
        }

    status = "available"
    note = "Предложена е посока с по-нисък риск на база текущите налични данни."
    if risk_delta < MIN_MEANINGFUL_RISK_DELTA or confidence_level == "low" or best_candidate["distanceKm"] > LOCAL_ROUTE_WARNING_DISTANCE_KM:
        status = "limited"
        note = "Налична е само ограничена посока с по-нисък риск на база текущите данни."

    return {
        "status": status,
        "origin": {
            "latitude": origin_zone["lat"],
            "longitude": origin_zone["lon"],
            "label": origin_zone["label"],
        },
        "target": {
            "latitude": best_candidate["zone"]["lat"],
            "longitude": best_candidate["zone"]["lon"],
            "label": best_candidate["zone"]["label"],
        },
        "direction": best_candidate["direction"],
        "distanceKm": best_candidate["distanceKm"],
        "riskScore": best_candidate["aggregatedRisk"],
        "travelCost": travel_cost_label(best_candidate["distanceKm"]),
        "avoid": avoid_notes,
        "basis": basis,
        "confidenceLevel": confidence_level,
        "note": note,
    }
