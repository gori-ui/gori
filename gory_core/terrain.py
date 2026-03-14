from __future__ import annotations


def build_unavailable_terrain_influence() -> dict:
    return {
        "status": "unavailable",
        "slopeClass": None,
        "terrainPressure": "low",
        "basis": ["slope"],
        "note": "Няма достатъчна slope основа за terrain influence.",
    }


def build_terrain_influence(zone: dict | None) -> dict:
    if not zone:
        return build_unavailable_terrain_influence()

    terrain_value = (zone.get("drivers") or {}).get("terrain")
    if terrain_value is None:
        return build_unavailable_terrain_influence()

    if terrain_value >= 0.7:
        slope_class = "steep"
        terrain_pressure = "high"
        note = "Steeper terrain may accelerate uphill fire spread."
    elif terrain_value >= 0.4:
        slope_class = "moderate"
        terrain_pressure = "moderate"
        note = "Moderate slope may support faster uphill fire spread."
    else:
        slope_class = "flat"
        terrain_pressure = "low"
        note = "Flatter terrain adds limited uphill spread pressure."

    return {
        "status": "limited",
        "slopeClass": slope_class,
        "terrainPressure": terrain_pressure,
        "basis": ["slope"],
        "note": note,
    }
