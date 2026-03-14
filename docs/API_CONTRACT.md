# GORI Public API Contract

Canonical public paths:

- `GET /api/zones`
- `GET /api/zones/{zoneId}/risk`
- `GET /api/incidents`
- `GET /api/incidents/{canonicalId}`
- `GET /api/incidents/{canonicalId}/history`
- `GET /api/zones/{zoneId}/decision`

Legacy compatibility path:

- `GET /api/decision/{zone_id}`

Role-aware API roles:

- `tourist`
- `field`
- `operator`
- `analyst`

Default role:

- `tourist`

Field glossary:

- `status`: current incident status derived from signal context
- `lifecycleState`: explainable lifecycle stage over time
- `severityLevel`: explainable severity classification
- `canonicalId`: stable incident identity for persistence and history

Canonical identity note:

- `canonicalId` is stable across process restarts
- the canonical registry is persisted on disk and reused when incident identity is resolved again

Runtime ingestion note:

- runtime signal buffers are bounded in-process
- older ingestion signals may be pruned by TTL
- oversized ingestion buffers may drop the oldest entries

Runtime snapshot note:

- supported operator and analyst API paths now derive related responses from one coherent in-process runtime snapshot per request path, with short-lived snapshot reuse for related reads
- this reduces subtle live-context drift inside the same logical read flow

Compatibility note:

- `/api/zones/{zoneId}/risk` now exposes canonical names:
  - `incidentStatus`
  - `incidentLifecycleState`
  - `incidentSeverityLevel`
- legacy aliases are still present for compatibility:
  - `incidentLifecycle`
  - `incidentSeverity`

Operator dashboard skeleton:

- Incident List:
  - `GET /api/incidents?role=operator`
- Incident Detail:
  - `GET /api/incidents/{canonicalId}?role=operator`
- Incident History:
  - `GET /api/incidents/{canonicalId}/history?role=operator`
- Zone Decision Context:
  - `GET /api/zones/{zoneId}/decision?role=operator`
- Situational Summary Cards:
  - `GET /api/operator/summary`
  - useful fields:
    - `activeIncidentsCount`
    - `activeCriticalIncidentsCount`
    - `elevatedSpreadIncidentsCount`
    - `containedIncidentsCount`
    - `operatorAttentionCount`

Frontend-facing operator dashboard structure:

- Dashboard Home / Overview
  - Summary Cards
    - endpoint: `GET /api/operator/summary`
    - essential fields:
      - `activeIncidentsCount`
      - `criticalIncidentsCount`
      - `zonesWithElevatedSpread`
      - `operatorAttentionCount`
  - Incident List
    - endpoint: `GET /api/incidents?role=operator`
    - essential fields:
      - `canonicalId`
      - `zoneId`
      - `zoneLabel`
      - `incidentPriority`
      - `status`
      - `lifecycleState`
      - `severityLevel`
      - `spreadPressure`
      - `lastUpdatedAt`
  - Situational Strip
    - endpoint: `GET /api/incidents?role=operator`
    - essential fields:
      - `severityLevel`
      - `lifecycleState`
      - `zoneLabel`
    - optional fields:
      - `lastUpdatedAt`

- Incident Detail View
  - Identity Header
    - endpoint: `GET /api/incidents/{canonicalId}?role=operator`
    - essential fields:
      - `canonicalId`
      - `zoneId`
      - `zoneLabel`
      - `severityLevel`
      - `lifecycleState`
      - `status`
    - optional fields:
      - `runtimeIncidentId`
  - Support Summary
    - endpoint: `GET /api/incidents/{canonicalId}?role=operator`
    - essential fields:
      - `sources`
      - `signalsCount`
    - optional fields:
      - `timelineSummary`
  - History Summary
    - endpoint: `GET /api/incidents/{canonicalId}/history?role=operator`
    - essential fields:
      - `canonicalId`
      - `severityLevel`
      - `lifecycleState`
      - `lastUpdatedAt`
    - optional fields:
      - `sources`
      - `signalsCount`
      - `timelineSummary`
  - Zone Decision Link
    - endpoint: `GET /api/zones/{zoneId}/decision?role=operator`
    - essential fields:
      - `zone`
      - `risk`
      - `incident`
    - optional fields:
      - `spread`
      - `routing`
      - `history`

- Zone Decision Context View
  - Risk Summary
    - endpoint: `GET /api/zones/{zoneId}/decision?role=operator`
    - essential fields:
      - `zone`
      - `risk`
      - `incident`
  - Spread / Routing Context
    - endpoint: `GET /api/zones/{zoneId}/decision?role=operator`
    - essential fields:
      - `spread`
      - `routing`
    - optional fields:
      - `crossConfirmation`
  - History Context
    - endpoint: `GET /api/zones/{zoneId}/decision?role=operator`
    - essential fields:
      - `history`
      - `note`

- Secondary Situational Panel (optional)
  - Selected Incident Snapshot
    - endpoint: `GET /api/incidents/{canonicalId}?role=operator`
    - essential fields:
      - `severityLevel`
      - `lifecycleState`
      - `status`
    - optional fields:
      - `sources`
      - `signalsCount`
      - `timelineSummary`
  - Selected Zone Context
    - endpoint: `GET /api/zones/{zoneId}/decision?role=operator`
    - essential fields:
      - `spread`
      - `routing`
      - `note`
    - optional fields:
      - `history`
      - `crossConfirmation`

Frontend implementation note:

- The current API contract is sufficient for the first operator dashboard structure.
- No new endpoint is required for view composition beyond `GET /api/operator/summary`.
- Frontend can treat `timelineSummary`, `history`, and `crossConfirmation` as optional enrichments rather than blocking fields.

Analyst export surfaces:

- Incident list export:
  - `GET /api/analyst/incidents`
- Incident bundle export:
  - `GET /api/analyst/incidents/{canonicalId}/bundle`
- Incident history export:
  - `GET /api/analyst/incidents/{canonicalId}/history`
- Zone decision snapshot export:
  - `GET /api/analyst/zones/{zoneId}/decision-snapshot`

Export format note:

- default format is `json`
- optional `?format=ndjson` is supported for machine-readable line-based export
- analyst exports reuse the existing incident registry, decision payload, spread context, and retained history snapshot
