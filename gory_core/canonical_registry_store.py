from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REGISTRY_PATH = BASE_DIR / "data" / "canonical_registry.json"


def _ensure_parent_dir() -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)


def load_canonical_registry() -> dict[str, dict]:
    if not REGISTRY_PATH.exists():
        return {}
    try:
        payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(payload, dict):
        return {}
    return {
        str(canonical_id): deepcopy(record)
        for canonical_id, record in payload.items()
        if isinstance(record, dict)
    }


def persist_canonical_registry(entries: dict[str, dict]) -> None:
    _ensure_parent_dir()
    temp_path = REGISTRY_PATH.with_suffix(".json.tmp")
    temp_path.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temp_path.replace(REGISTRY_PATH)


def upsert_canonical_entry(entry: dict | None) -> dict | None:
    if not entry or not entry.get("canonicalId"):
        return None

    current = load_canonical_registry()
    canonical_id = entry["canonicalId"]
    if current.get(canonical_id) == entry:
        return deepcopy(entry)

    current[canonical_id] = deepcopy(entry)
    persist_canonical_registry(current)
    return deepcopy(entry)
