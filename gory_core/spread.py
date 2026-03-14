from __future__ import annotations

from gory_core.terrain import build_terrain_influence, build_unavailable_terrain_influence


def _direction_label(degrees: float) -> str:
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
    return directions[int(((degrees % 360) + 22.5) // 45) % 8]


def _pressure_from_rank(rank: int) -> str:
    return {
        0: "low",
        1: "moderate",
        2: "high",
    }.get(max(0, min(2, rank)), "low")


def build_unavailable_spread_summary() -> dict:
    return {
        "status": "unavailable",
        "windSpeedKmh": None,
        "windDirectionDeg": None,
        "windDirectionLabel": None,
        "spreadPressure": "low",
        "higherRiskDirection": None,
        "lowerRiskDirection": None,
        "basis": ["wind"],
        "terrainInfluence": build_unavailable_terrain_influence(),
        "note": "Няма достатъчна wind основа за environmental spread guidance.",
    }


def build_spread_summary(zone: dict, meteo_snapshot: dict | None, signal_summary: dict | None, risk_score: int) -> dict:
    terrain_influence = build_terrain_influence(zone)
    snapshot = meteo_snapshot or {}
    values = snapshot.get("values", {})
    wind_speed = values.get("wind_kmh")
    wind_direction = values.get("wind_direction_deg")
    if wind_speed is None or wind_direction is None:
        unavailable = build_unavailable_spread_summary()
        unavailable["terrainInfluence"] = terrain_influence
        return unavailable

    spread_direction = (wind_direction + 180) % 360
    higher_risk_direction = _direction_label(spread_direction)
    lower_risk_direction = _direction_label(wind_direction)
    wind_direction_label = f"{_direction_label(wind_direction)} -> {higher_risk_direction}"

    if wind_speed >= 28:
        pressure_rank = 2
    elif wind_speed >= 16:
        pressure_rank = 1
    else:
        pressure_rank = 0

    incident = (signal_summary or {}).get("incident") or {}
    if incident.get("status") in {"confirmed", "active"}:
        pressure_rank += 1
    elif (signal_summary or {}).get("confidenceLevel") == "high":
        pressure_rank += 1

    if risk_score < 40 and pressure_rank > 0:
        pressure_rank -= 1

    terrain_pressure = terrain_influence.get("terrainPressure", "low")
    if terrain_pressure == "high" and pressure_rank < 2:
        pressure_rank += 1
    elif terrain_pressure == "moderate" and pressure_rank == 0:
        pressure_rank += 1

    spread_pressure = _pressure_from_rank(pressure_rank)
    status = "available"
    basis = ["wind", "current zone risk"]
    if incident:
        basis.append("current incident context")
    elif signal_summary and signal_summary.get("status") == "live":
        basis.append("signal confidence")
        status = "limited"
    else:
        status = "limited"

    if terrain_influence.get("status") in {"available", "limited"}:
        basis.append("slope")

    note = f"Wind may push spread toward the {higher_risk_direction}."
    if spread_pressure == "high":
        note = f"Environmental spread pressure is elevated. Wind may push spread toward the {higher_risk_direction}."
    elif spread_pressure == "moderate":
        note = f"Wind may support spread toward the {higher_risk_direction}."

    if terrain_pressure == "high":
        note = f"{note} Steeper terrain may further accelerate uphill spread."
    elif terrain_pressure == "moderate":
        note = f"{note} Moderate slope adds some uphill spread pressure."

    return {
        "status": status,
        "windSpeedKmh": round(float(wind_speed), 1),
        "windDirectionDeg": round(float(wind_direction), 1),
        "windDirectionLabel": wind_direction_label,
        "spreadPressure": spread_pressure,
        "higherRiskDirection": higher_risk_direction,
        "lowerRiskDirection": lower_risk_direction,
        "basis": basis,
        "terrainInfluence": terrain_influence,
        "note": note,
    }
