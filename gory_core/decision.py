from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean

from gory_core.catalog import (
    ACTION_STATUS_MODEL,
    ROLES,
    SEVERITY_MODEL,
    get_role,
    get_zone,
    list_zones,
)
from gory_core.incidents import build_incident_note
from gory_core.spread import build_spread_summary, build_unavailable_spread_summary
from gory_core.signals import build_unavailable_zone_signal_summary

DRIVER_META = {
    "dryness": {
        "label": "Сухост",
        "description": "Сухите условия улесняват бързо възпламеняване.",
    },
    "heat": {
        "label": "Температура",
        "description": "Повишената температура изсушава повърхностните горива.",
    },
    "wind": {
        "label": "Вятър",
        "description": "Вятърът подпомага разпространението и усложнява контрола.",
    },
    "vegetation": {
        "label": "Растителност",
        "description": "Сухата растителност създава леснозапалима среда.",
    },
    "human_pressure": {
        "label": "Човешки натиск",
        "description": "Движение и дейности на терен повишават риска от запалване.",
    },
    "terrain": {
        "label": "Терен и достъп",
        "description": "Сложният достъп удължава времето за реакция.",
    },
    "settlement_exposure": {
        "label": "Експозиция на населени места",
        "description": "Близостта до населени места повишава потенциалното въздействие.",
    },
    "fire_signal": {
        "label": "Пожарен сигнал",
        "description": "Сигналът подсказва възможна активна ситуация в близост.",
    },
}

DRIVER_WEIGHTS = {
    "dryness": 0.20,
    "heat": 0.12,
    "wind": 0.15,
    "vegetation": 0.14,
    "human_pressure": 0.10,
    "terrain": 0.09,
    "settlement_exposure": 0.08,
    "fire_signal": 0.12,
}

STATUS_BY_SEVERITY = {
    "low": "monitor",
    "moderate": "monitor",
    "high": "warning",
    "very-high": "warning",
    "critical": "immediate",
}

LIVE_METEO_META = {
    "temperature_c": {
        "label": "Температура",
        "description": "По-високата температура изсушава повърхностните горива.",
        "unit": "°C",
        "target": "heat",
    },
    "humidity_pct": {
        "label": "Влажност",
        "description": "По-ниската влажност позволява по-лесно възпламеняване.",
        "unit": "%",
        "target": "dryness",
    },
    "wind_kmh": {
        "label": "Вятър",
        "description": "По-силният вятър ускорява развитие на пожар.",
        "unit": "km/h",
        "target": "wind",
    },
}


def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, value))


def build_missing_meteo_snapshot() -> dict:
    return {
        "status": "missing",
        "source": "Open-Meteo",
        "docsUrl": None,
        "observedAt": None,
        "values": {
            "temperature_c": None,
            "humidity_pct": None,
            "wind_kmh": None,
            "wind_direction_deg": None,
        },
        "missing": ["temperature_c", "humidity_pct", "wind_kmh", "wind_direction_deg"],
    }


def build_missing_fire_signal_summary() -> dict:
    return build_unavailable_zone_signal_summary(
        category="wildfire_activity",
        source_class="automated_remote_sensing",
        provider="NASA EONET",
        signal_type="wildfire_event",
        strategic_target="Copernicus / EFFIS",
    )


def build_unavailable_routing_summary(zone: dict) -> dict:
    return {
        "status": "unavailable",
        "origin": {
            "latitude": zone["lat"],
            "longitude": zone["lon"],
            "label": zone["label"],
        },
        "target": None,
        "direction": None,
        "distanceKm": None,
        "riskScore": None,
        "travelCost": None,
        "avoid": [],
        "basis": ["current zone risk"],
        "confidenceLevel": "low",
        "note": "Няма достатъчна основа за lower-risk guidance.",
    }


def build_live_meteo_adjustments(live_meteo: dict | None) -> tuple[dict, list[dict]]:
    snapshot = live_meteo or build_missing_meteo_snapshot()
    values = snapshot.get("values", {})
    adjustments: dict[str, float] = {}
    cards: list[dict] = []

    temperature = values.get("temperature_c")
    if temperature is not None:
        impact = clamp((temperature - 18) / 22)
        adjustments["heat"] = impact
        cards.append(
            {
                "key": "temperature_c",
                "label": LIVE_METEO_META["temperature_c"]["label"],
                "displayValue": f"{round(temperature, 1)} {LIVE_METEO_META['temperature_c']['unit']}",
                "impactScore": round(impact * 100),
                "description": LIVE_METEO_META["temperature_c"]["description"],
                "sourceType": "live",
            }
        )

    humidity = values.get("humidity_pct")
    if humidity is not None:
        impact = clamp((60 - humidity) / 50)
        adjustments["dryness"] = impact
        cards.append(
            {
                "key": "humidity_pct",
                "label": LIVE_METEO_META["humidity_pct"]["label"],
                "displayValue": f"{round(humidity, 1)} {LIVE_METEO_META['humidity_pct']['unit']}",
                "impactScore": round(impact * 100),
                "description": LIVE_METEO_META["humidity_pct"]["description"],
                "sourceType": "live",
            }
        )

    wind = values.get("wind_kmh")
    if wind is not None:
        impact = clamp(wind / 45)
        adjustments["wind"] = impact
        cards.append(
            {
                "key": "wind_kmh",
                "label": LIVE_METEO_META["wind_kmh"]["label"],
                "displayValue": f"{round(wind, 1)} {LIVE_METEO_META['wind_kmh']['unit']}",
                "impactScore": round(impact * 100),
                "description": LIVE_METEO_META["wind_kmh"]["description"],
                "sourceType": "live",
            }
        )

    cards.sort(key=lambda item: item["impactScore"], reverse=True)
    return adjustments, cards


def fire_signal_impact(zone_signal_summary: dict | None, baseline: float) -> tuple[float | None, list[dict]]:
    summary = zone_signal_summary or build_missing_fire_signal_summary()
    signal = summary.get("primarySignal")
    if summary.get("status") != "live" or not signal:
        return None, []

    distance = float(summary.get("nearestDistanceKm") or signal.get("distanceToZoneKm") or 9999)
    observed_at = summary.get("observedAt") or signal.get("observedAt")
    observed_dt = None
    if observed_at:
        try:
            observed_dt = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
        except ValueError:
            observed_dt = None

    age_days = None
    if observed_dt:
        age_days = max(
            0.0,
            (datetime.now(timezone.utc) - observed_dt.astimezone(timezone.utc)).total_seconds() / 86400,
        )

    if distance <= 10:
        distance_score = 1.0
    elif distance <= 25:
        distance_score = 0.85
    elif distance <= 50:
        distance_score = 0.65
    elif distance <= 75:
        distance_score = 0.45
    else:
        distance_score = 0.0

    if age_days is None or age_days <= 1:
        recency_score = 1.0
    elif age_days <= 3:
        recency_score = 0.8
    elif age_days <= 7:
        recency_score = 0.6
    else:
        recency_score = 0.4

    source_class = summary.get("sourceClass")
    source_multiplier = 0.85
    label = "Пожарен сигнал"
    description = None
    if source_class == "human_reported":
        source_multiplier = 0.45
        label = "Citizen smoke report"
        description = "Unverified citizen smoke report detected nearby."
    elif source_class == "verified_operational":
        source_multiplier = 1.0
        label = "Operational fire confirmation"
        description = "Operational wildfire confirmation detected nearby. Field confirmation increases confidence."

    cross_status = (summary.get("crossConfirmation") or {}).get("status", "none")
    cross_bonus = {
        "none": 0.0,
        "weak": 0.03,
        "moderate": 0.07,
        "strong": 0.12,
    }.get(cross_status, 0.0)

    impact = clamp(max(baseline, round((distance_score * 0.7 + recency_score * 0.3) * source_multiplier, 2)) + cross_bonus)
    title = summary.get("title") or signal.get("title") or "Wildfire event"
    verification = summary.get("verification", "unverified")
    live_card = {
        "key": "fire_signal_live",
        "label": label,
        "displayValue": f"{round(distance, 1)} km",
        "impactScore": round(impact * 100),
        "description": description or f"{title} · {summary.get('provider')} · {verification}",
        "sourceType": "live",
    }
    return impact, [live_card]


def resolve_effective_drivers(
    zone: dict,
    live_meteo: dict | None,
    zone_signal_summary: dict | None = None,
) -> tuple[dict, list[dict], list[dict]]:
    drivers = dict(zone["drivers"])
    meteo_adjustments, meteo_cards = build_live_meteo_adjustments(live_meteo)
    for key, value in meteo_adjustments.items():
        drivers[key] = value

    fire_impact, fire_cards = fire_signal_impact(zone_signal_summary, drivers["fire_signal"])
    if fire_impact is not None:
        drivers["fire_signal"] = fire_impact

    return drivers, meteo_cards, fire_cards


def score_zone(zone: dict, live_meteo: dict | None = None, zone_signal_summary: dict | None = None) -> int:
    drivers, _, _ = resolve_effective_drivers(zone, live_meteo, zone_signal_summary)
    weighted_total = sum(drivers[key] * DRIVER_WEIGHTS[key] for key in DRIVER_WEIGHTS)
    signal_bonus = 8 if drivers["fire_signal"] >= 0.30 else 0
    exposure_bonus = 6 if drivers["settlement_exposure"] >= 0.70 else 0
    terrain_bonus = 4 if drivers["terrain"] >= 0.80 else 0
    return min(100, round(weighted_total * 100 + signal_bonus + exposure_bonus + terrain_bonus))


def get_severity(score: int) -> dict:
    for item in SEVERITY_MODEL:
        low, high = item["range"]
        if low <= score <= high:
            return dict(item)
    return dict(SEVERITY_MODEL[-1])


def get_action_status(severity_id: str, drivers: dict) -> dict:
    if drivers["fire_signal"] >= 0.60:
        return dict(ACTION_STATUS_MODEL["immediate"])
    return dict(ACTION_STATUS_MODEL[STATUS_BY_SEVERITY[severity_id]])


def build_contextual_drivers(drivers: dict) -> list[dict]:
    contextual_keys = ["vegetation", "terrain", "settlement_exposure", "human_pressure", "fire_signal"]
    items = []
    for key in contextual_keys:
        meta = DRIVER_META[key]
        items.append(
            {
                "key": key,
                "label": meta["label"],
                "description": meta["description"],
                "impactScore": round(drivers[key] * 100),
                "sourceType": "contextual",
            }
        )
    return sorted(items, key=lambda item: item["impactScore"], reverse=True)


def build_reasoning(
    zone: dict,
    live_meteo: dict | None,
    zone_signal_summary: dict | None = None,
    spread_summary: dict | None = None,
) -> dict:
    effective_drivers, live_meteo_cards, live_fire_cards = resolve_effective_drivers(zone, live_meteo, zone_signal_summary)
    meteo_snapshot = live_meteo or build_missing_meteo_snapshot()
    fire_snapshot = zone_signal_summary or build_missing_fire_signal_summary()

    visible_live_meteo = [driver for driver in live_meteo_cards if driver["impactScore"] >= 5]
    visible_live_fire = [card for card in live_fire_cards if card["impactScore"] >= 5]
    supporting_signals = fire_snapshot.get("supportingSignals", [])
    cross_confirmation = fire_snapshot.get("crossConfirmation") or {"status": "none", "basis": [], "note": None}
    incident = fire_snapshot.get("incident")
    spread = spread_summary or build_unavailable_spread_summary()
    contextual = build_contextual_drivers(effective_drivers)

    if visible_live_meteo or visible_live_fire:
        summary = "Показваме само live сигнали с реално влияние върху оценката."
    elif fire_snapshot["status"] == "no-nearby-signal":
        summary = "Няма nearby live wildfire signal за тази зона."
    else:
        summary = "Няма отчетлив live сигнал за тази зона."

    if meteo_snapshot["status"] == "partial":
        missing_note = "Част от live meteo inputs липсват. Липсващите meteo части остават на contextual baseline."
    elif meteo_snapshot["status"] == "missing":
        missing_note = "Няма live meteo данни за тази зона. Решението остава полезно, но стъпва на contextual baseline."
    else:
        missing_note = "Live meteo коригира само meteo-компонентата. Останалите фактори остават contextual."

    if fire_snapshot["status"] == "live":
        if fire_snapshot.get("sourceClass") == "human_reported":
            fire_note = "Има непотвърден citizen smoke report и той влияе ограничено на fire-signal компонента."
        elif fire_snapshot.get("sourceClass") == "verified_operational":
            fire_note = "Има nearby operational wildfire confirmation и тя повишава увереността в сигнала."
        else:
            fire_note = "Има nearby live remote-sensing wildfire signal и той влияе само на fire-signal компонента."
    elif fire_snapshot["status"] == "no-nearby-signal":
        fire_note = "Feed-ът е активен, но няма nearby live wildfire signal в текущия радиус."
    else:
        fire_note = "Live wildfire signal feed не е наличен. Това не означава липса на пожарен риск."

    return {
        "headline": "Live signals",
        "summary": summary,
        "live": {
            "status": meteo_snapshot["status"],
            "drivers": visible_live_meteo,
            "fireSignals": visible_live_fire,
            "supportingSignals": supporting_signals,
            "crossConfirmation": cross_confirmation,
            "confirmationNote": cross_confirmation.get("note"),
            "incident": incident,
            "incidentNote": build_incident_note(incident),
            "spread": spread,
            "spreadNote": spread.get("note"),
        },
        "contextual": {
            "drivers": contextual,
            "note": "Contextual факторите остават отделни и не се визуализират като live сигнал.",
        },
        "missing": {
            "liveInputs": meteo_snapshot.get("missing", []),
            "note": missing_note,
            "fireSignalStatus": fire_snapshot["status"],
            "fireSignalNote": fire_note,
        },
    }


def build_confidence(zone: dict, live_meteo: dict | None, zone_signal_summary: dict | None = None) -> dict:
    basis = list(zone.get("basis", []))
    effective_drivers, _, _ = resolve_effective_drivers(zone, live_meteo, zone_signal_summary)
    confidence_score = round(
        (
            mean(effective_drivers.values()) * 0.45
            + min(len(basis), 4) / 4 * 0.35
            + (0.2 if effective_drivers["fire_signal"] >= 0.20 else 0.08)
        )
        * 100
    )

    meteo_snapshot = live_meteo or build_missing_meteo_snapshot()
    fire_snapshot = zone_signal_summary or build_missing_fire_signal_summary()
    cross_confirmation = fire_snapshot.get("crossConfirmation") or {"status": "none", "basis": [], "note": None}
    incident = fire_snapshot.get("incident")

    if meteo_snapshot["status"] == "live":
        confidence_score += 10
        basis.append("live meteo")
    elif meteo_snapshot["status"] == "partial":
        confidence_score += 4
        basis.append("partial live meteo")

    if fire_snapshot["status"] == "live":
        if fire_snapshot.get("sourceClass") == "human_reported":
            confidence_score += 2
            basis.append("unverified citizen report")
        elif fire_snapshot.get("sourceClass") == "verified_operational":
            confidence_score += 10
            basis.append("operational confirmation")
        else:
            confidence_score += 6
            basis.append("live remote-sensing wildfire signal")
    elif fire_snapshot["status"] == "no-nearby-signal":
        basis.append("fire feed checked")

    cross_status = cross_confirmation.get("status", "none")
    if cross_status == "weak":
        confidence_score += 3
        basis.append("weak cross-confirmation")
    elif cross_status == "moderate":
        confidence_score += 6
        basis.append("moderate cross-confirmation")
    elif cross_status == "strong":
        confidence_score += 10
        basis.append("strong cross-confirmation")

    if incident:
        incident_status = incident.get("status")
        if incident_status == "active":
            confidence_score += 3
            basis.append("active incident context")
        elif incident_status == "confirmed":
            confidence_score += 6
            basis.append("confirmed incident context")

    confidence_level = fire_snapshot.get("confidenceLevel")
    if confidence_level in {"medium", "high"}:
        basis.append(f"signal confidence: {confidence_level}")

    label = "Средна"
    if confidence_score >= 72:
        label = "Висока"
    elif confidence_score <= 45:
        label = "Ниска"

    return {
        "score": min(100, confidence_score),
        "label": label,
        "basis": basis,
        "method": "rules-based",
        "modelStatus": "live",
        "modelType": "structured decision engine",
        "liveDataStatus": meteo_snapshot["status"],
        "fireSignalStatus": fire_snapshot["status"],
    }


def build_role_actions(role_id: str, action_status: dict) -> dict:
    role = get_role(role_id)
    decision_wording = role["decisionWording"][action_status["id"]]

    if role_id == "citizen":
        quick_actions = ["Виж инструкции", "Сподели предупреждение", "Покажи близки пожари"]
    elif role_id == "guide":
        quick_actions = ["Провери маршрут", "Подготви алтернатива", "Ограничи групов достъп"]
    elif role_id == "farmer":
        quick_actions = ["Ограничи дейности", "Провери полета", "Планирай безопасен прозорец"]
    elif role_id == "field":
        quick_actions = ["Прегледай сигнали", "Маркирай за наблюдение", "Подготви екип"]
    elif role_id == "official":
        quick_actions = ["Изпрати предупреждение", "Отвори рискови зони", "Насочи ресурс"]
    else:
        quick_actions = ["Прегледай слоеве", "Провери capabilities", "Сравни режимите"]

    return {
        "roleLabel": role["label"],
        "recommendedAction": decision_wording,
        "quickActions": quick_actions,
        "priorityActions": role["priorityActions"],
        "summary": f"{role['label']}: {decision_wording}",
    }


def build_decision_payload(
    zone: dict,
    role_id: str,
    live_meteo: dict | None = None,
    zone_signal_summary: dict | None = None,
    routing_summary: dict | None = None,
    history_context: dict | None = None,
) -> dict:
    meteo_snapshot = live_meteo or build_missing_meteo_snapshot()
    fire_snapshot = zone_signal_summary or build_missing_fire_signal_summary()
    effective_drivers, _, _ = resolve_effective_drivers(zone, meteo_snapshot, fire_snapshot)
    score = score_zone(zone, meteo_snapshot, fire_snapshot)
    spread_summary = build_spread_summary(zone, meteo_snapshot, fire_snapshot, score)
    severity = get_severity(score)
    action_status = get_action_status(severity["id"], effective_drivers)
    reasoning = build_reasoning(zone, meteo_snapshot, fire_snapshot, spread_summary)
    confidence = build_confidence(zone, meteo_snapshot, fire_snapshot)
    role_actions = build_role_actions(role_id, action_status)

    return {
        "zone": {
            "id": zone["id"],
            "label": zone["label"],
            "region": zone["region"],
            "type": zone["type"],
            "lat": zone["lat"],
            "lon": zone["lon"],
        },
        "risk": {
            "score": score,
            "severity": severity,
            "actionStatus": action_status,
            "summary": f"{severity['label']} риск с режим '{action_status['label']}'.",
        },
        "reasoning": reasoning,
        "basis": {
            "liveMeteoStatus": meteo_snapshot["status"],
            "fallbackUsed": meteo_snapshot["status"] != "live",
            "fallbackMode": "contextual-baseline" if meteo_snapshot["status"] != "live" else "none",
            "fireSignalStatus": fire_snapshot["status"],
        },
        "confidence": confidence,
        "meteo": meteo_snapshot,
        "fireSignal": fire_snapshot,
        "spread": spread_summary,
        "incident": fire_snapshot.get("incident"),
        "history": history_context or {
            "incidentHistoryCount": 0,
            "recentIncidentsNearbyCount": 0,
        },
        "routing": routing_summary or build_unavailable_routing_summary(zone),
        "roleAction": role_actions,
    }


def get_zone_decision(
    zone_id: str,
    role_id: str,
    live_meteo: dict | None = None,
    zone_signal_summary: dict | None = None,
    routing_summary: dict | None = None,
    history_context: dict | None = None,
) -> dict | None:
    zone = get_zone(zone_id)
    if not zone:
        return None
    if role_id not in ROLES:
        role_id = "citizen"
    return build_decision_payload(zone, role_id, live_meteo, zone_signal_summary, routing_summary, history_context)


def get_top_reason(decision: dict) -> str:
    if decision["reasoning"]["live"]["fireSignals"]:
        return decision["reasoning"]["live"]["fireSignals"][0]["label"]
    if decision["reasoning"]["live"]["drivers"]:
        return decision["reasoning"]["live"]["drivers"][0]["label"]
    if decision["reasoning"]["contextual"]["drivers"]:
        return decision["reasoning"]["contextual"]["drivers"][0]["label"]
    return "Контекстуален риск"


def list_zone_summaries(
    role_id: str,
    live_meteo_map: dict[str, dict] | None = None,
    live_fire_signal_map: dict[str, dict] | None = None,
) -> list[dict]:
    summaries = []
    for zone in list_zones():
        decision = build_decision_payload(
            zone,
            role_id,
            (live_meteo_map or {}).get(zone["id"]),
            (live_fire_signal_map or {}).get(zone["id"]),
        )
        summaries.append(
            {
                "id": zone["id"],
                "label": zone["label"],
                "region": zone["region"],
                "lat": zone["lat"],
                "lon": zone["lon"],
                "type": zone["type"],
                "riskScore": decision["risk"]["score"],
                "severity": decision["risk"]["severity"],
                "actionStatus": decision["risk"]["actionStatus"],
                "topReason": get_top_reason(decision),
            }
        )
    return sorted(summaries, key=lambda item: item["riskScore"], reverse=True)


def build_alerts(
    role_id: str,
    live_meteo_map: dict[str, dict] | None = None,
    live_fire_signal_map: dict[str, dict] | None = None,
) -> list[dict]:
    alerts = []
    for zone in list_zones():
        decision = build_decision_payload(
            zone,
            role_id,
            (live_meteo_map or {}).get(zone["id"]),
            (live_fire_signal_map or {}).get(zone["id"]),
        )
        status_id = decision["risk"]["actionStatus"]["id"]
        if status_id == "monitor" and decision["risk"]["score"] < 38:
            continue

        if decision["reasoning"]["live"]["fireSignals"]:
            why_text = decision["reasoning"]["live"]["fireSignals"][0]["description"]
        elif decision["reasoning"]["live"]["drivers"]:
            why_text = decision["reasoning"]["live"]["drivers"][0]["description"]
        elif decision["reasoning"]["contextual"]["drivers"]:
            why_text = f"Контекстуален фактор: {decision['reasoning']['contextual']['drivers'][0]['label']}."
        else:
            why_text = "Няма наличен live signal; alert-ът е базиран на contextual baseline."

        alerts.append(
            {
                "id": f"alert-{zone['id']}",
                "who": get_role(role_id)["label"],
                "where": zone["label"],
                "why": why_text,
                "severity": decision["risk"]["severity"]["label"],
                "recommendedAction": decision["roleAction"]["recommendedAction"],
                "status": decision["risk"]["actionStatus"]["label"],
            }
        )
    return alerts[:4]


def get_national_status(
    role_id: str,
    live_meteo_map: dict[str, dict] | None = None,
    live_fire_signal_map: dict[str, dict] | None = None,
) -> dict:
    summaries = list_zone_summaries(role_id, live_meteo_map, live_fire_signal_map)
    scores = [item["riskScore"] for item in summaries]
    critical_zones = [item for item in summaries if item["severity"]["id"] == "critical"]
    warning_zones = [item for item in summaries if item["actionStatus"]["id"] == "warning"]
    national_index = round(mean(scores)) if scores else 0
    active_mode = get_role(role_id)["label"]
    live_meteo_count = sum(1 for item in (live_meteo_map or {}).values() if item.get("status") in {"live", "partial"})
    live_fire_count = sum(1 for item in (live_fire_signal_map or {}).values() if item.get("status") == "live")

    if critical_zones:
        posture = "Незабавна реакция"
    elif warning_zones:
        posture = "Предупреждение"
    else:
        posture = "Наблюдение"

    return {
        "nationalStatus": posture,
        "activeSignals": len(build_alerts(role_id, live_meteo_map, live_fire_signal_map)),
        "criticalZones": len(critical_zones),
        "modeLabel": active_mode,
        "bfri": national_index,
        "headline": "Национален decision snapshot",
        "subline": (
            f"Live meteo: {live_meteo_count}/{len(summaries)} зони. "
            f"Live wildfire event signals: {live_fire_count}. "
            "Decision core не претендира за full live national feed."
        ),
    }
