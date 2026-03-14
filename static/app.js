const BULGARIA_CENTER = [42.73, 25.48];
const BULGARIA_BOUNDS = [[41.2, 22.3], [44.3, 28.8]];

function createOperatorState() {
  return {
    view: "home",
    summary: null,
    incidents: [],
    selectedIncidentId: null,
    incidentDetail: null,
    incidentHistory: [],
    zoneDecision: null,
    loading: null,
    error: null,
  };
}

const state = {
  roleId: localStorage.getItem("gory_role") || "citizen",
  bootstrap: null,
  selectedZoneId: null,
  decision: null,
  operator: createOperatorState(),
  map: null,
  layerGroups: {},
  zoneMarkers: {},
  panelInitDone: false,
  visibleLayers: new Set(),
};

const els = {
  decisionStrip: document.getElementById("decisionStrip"),
  modeTitle: document.getElementById("modeTitle"),
  modeSubtitle: document.getElementById("modeSubtitle"),
  changeRoleButton: document.getElementById("changeRoleButton"),
  legendContent: document.getElementById("legendContent"),
  layerModeSummary: document.getElementById("layerModeSummary"),
  layerGroupsContent: document.getElementById("layerGroupsContent"),
  capabilitiesContent: document.getElementById("capabilitiesContent"),
  decisionPanel: document.getElementById("decisionPanel"),
  decisionContent: document.getElementById("decisionContent"),
  operatorPanel: document.getElementById("operatorPanel"),
  operatorPanelTitle: document.getElementById("operatorPanelTitle"),
  operatorPanelSubtitle: document.getElementById("operatorPanelSubtitle"),
  operatorContent: document.getElementById("operatorContent"),
  alertsContent: document.getElementById("alertsContent"),
  roleOverlay: document.getElementById("roleOverlay"),
  roleGroups: document.getElementById("roleGroups"),
  alertsPanel: document.getElementById("alertsPanel"),
};

function severityColor(id) {
  return {
    low: "#d9e6d5",
    moderate: "#ecdfb8",
    high: "#f1c08f",
    "very-high": "#e78a71",
    critical: "#c55849",
  }[id] || "#d9e6d5";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusBadge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

function capabilityGroupLabel(groupName) {
  return {
    liveNow: "Live now",
    prepared: "Prepared",
  }[groupName] || groupName;
}

function routingStatusLabel(status) {
  return {
    available: "налична",
    limited: "ограничена",
    unavailable: "неналична",
  }[status] || status;
}

function confidenceLabel(value) {
  return {
    low: "ниска",
    medium: "средна",
    high: "висока",
  }[value] || value;
}

function incidentPriorityLabel(value) {
  return {
    immediate: "immediate",
    priority: "priority",
    monitor: "monitor",
    watch: "watch",
  }[value] || value || "watch";
}

function spreadPressureLabel(value) {
  return {
    high: "high spread",
    moderate: "elevated spread",
    low: "lower spread",
    unavailable: "spread unknown",
  }[value] || (value ? `${value} spread` : "spread unknown");
}

function isOperatorShellMode() {
  return state.roleId === "official";
}

function resetOperatorState() {
  state.operator = createOperatorState();
}

function prioritizedOperatorIncidents() {
  const priorityRank = {
    immediate: 0,
    priority: 1,
    monitor: 2,
    watch: 3,
  };
  const spreadRank = {
    high: 0,
    moderate: 1,
    low: 2,
    unavailable: 3,
  };
  return [...(state.operator.incidents || [])].sort((left, right) => {
    const priorityDelta = (priorityRank[left.incidentPriority] ?? 9) - (priorityRank[right.incidentPriority] ?? 9);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    const spreadDelta = (spreadRank[left.spreadPressure] ?? 9) - (spreadRank[right.spreadPressure] ?? 9);
    if (spreadDelta !== 0) {
      return spreadDelta;
    }
    return String(right.lastUpdatedAt || "").localeCompare(String(left.lastUpdatedAt || ""));
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function loadBootstrap(roleId) {
  state.bootstrap = await fetchJson(`/api/bootstrap?role=${encodeURIComponent(roleId)}`);
  state.roleId = state.bootstrap.activeRole.id;
  state.visibleLayers = new Set(state.bootstrap.activeRole.defaultLayers);
  if (!isOperatorShellMode()) {
    resetOperatorState();
  }
  if (!state.selectedZoneId) {
    state.selectedZoneId = state.bootstrap.zones[0]?.id || null;
  }
  renderShell();
  renderMap();
  if (state.selectedZoneId) {
    await selectZone(state.selectedZoneId, false);
  }
  if (isOperatorShellMode()) {
    await loadOperatorDashboardHome();
  }
}

async function selectZone(zoneId, panTo = true) {
  state.selectedZoneId = zoneId;
  if (isOperatorShellMode()) {
    state.operator.loading = "zone";
    state.operator.error = null;
    renderOperatorPanel();
    try {
      state.operator.zoneDecision = await fetchJson(`/api/zones/${encodeURIComponent(zoneId)}/decision?role=operator`);
      state.operator.view = "zone";
    } catch (error) {
      state.operator.error = error.message;
    } finally {
      state.operator.loading = null;
      renderOperatorPanel();
    }
  } else {
    state.decision = await fetchJson(`/api/decision/${encodeURIComponent(zoneId)}?role=${encodeURIComponent(state.roleId)}`);
    renderDecisionPanel();
  }
  renderLayersPanel();
  renderMapSelection();
  if (panTo && state.map) {
    const zone = state.bootstrap.zones.find((item) => item.id === zoneId);
    if (zone) {
      state.map.flyTo([zone.lat, zone.lon], 8, { duration: 0.55 });
    }
  }
}

function renderShell() {
  renderDecisionStrip();
  renderModeBanner();
  renderLegend();
  renderLayersPanel();
  renderAlerts();
  renderOperatorPanel();
  renderRoleOverlay();
  updateWidgetVisibility();
  if (!state.panelInitDone) {
    window.setTimeout(() => {
      normalizePanelPositions();
      initPanelDragging();
      state.panelInitDone = true;
    }, 50);
  }
}

function renderDecisionStrip() {
  const status = state.bootstrap.nationalStatus;
  els.decisionStrip.innerHTML = [
    {
      label: "Национален статус",
      value: status.nationalStatus,
      note: status.headline,
    },
    {
      label: "Активни сигнали",
      value: String(status.activeSignals),
      note: "Alert objects с action wording според режима.",
    },
    {
      label: "Критични зони",
      value: String(status.criticalZones),
      note: "Зони с най-висок operational priority.",
    },
    {
      label: "Активен режим",
      value: status.modeLabel,
      note: "Role-aware логика, не само променени текстове.",
    },
    {
      label: "BFRI индекс",
      value: `${status.bfri}/100`,
      note: status.subline,
    },
  ]
    .map(
      (item) => `
        <article class="strip-card">
          <div class="strip-label">${escapeHtml(item.label)}</div>
          <div class="strip-value">${escapeHtml(item.value)}</div>
          <div class="strip-note">${escapeHtml(item.note)}</div>
        </article>
      `
    )
    .join("");
}

function renderModeBanner() {
  const role = state.bootstrap.activeRole;
  els.modeTitle.textContent = `${role.icon} ${role.label}`;
  els.modeSubtitle.textContent = role.description;
}

function renderLegend() {
  els.legendContent.innerHTML = state.bootstrap.severityModel
    .map(
      (item) => `
        <article class="legend-item">
          <div class="legend-swatch" style="background:${item.color};"></div>
          <div>
            <div class="legend-title">${escapeHtml(item.label)} (${item.range[0]}-${item.range[1]})</div>
            <div class="legend-copy">${escapeHtml(item.responseText)}</div>
            <div class="badge-row" style="margin-top:8px;">
              <span class="badge">${escapeHtml(item.operationalAction)}</span>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderLayersPanel() {
  const role = state.bootstrap.activeRole;
  els.layerModeSummary.innerHTML = `
    <strong>${escapeHtml(role.label)}</strong><br>
    Активни слоеве: ${role.defaultLayers.map((id) => escapeHtml(layerById(id)?.label || id)).join(", ")}.<br>
    Priority actions: ${role.priorityActions.map(escapeHtml).join(", ")}.
  `;

  const zoneItems = getRelevantZones()
    .map(
      (zone) => `
        <button
          class="zone-option ${state.selectedZoneId === zone.id ? "selected" : ""}"
          type="button"
          data-zone-select="${escapeHtml(zone.id)}"
        >
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div class="zone-option-title">${escapeHtml(zone.label)}</div>
              <div class="zone-option-meta">${escapeHtml(zone.region)} · ${escapeHtml(zone.topReason)}</div>
            </div>
            <div class="badge-row" style="justify-content:flex-end;">
              ${state.selectedZoneId === zone.id ? '<span class="badge live">избрана</span>' : ""}
              <span class="badge">${zone.riskScore}/100</span>
            </div>
          </div>
        </button>
      `
    )
    .join("");

  els.layerGroupsContent.innerHTML = state.bootstrap.layerGroups
    .map((group) => {
      const layers = state.bootstrap.layers.filter((layer) => layer.groupId === group.id);
      const items = layers
        .map((layer) => {
          const enabled = state.visibleLayers.has(layer.id);
          const disabled = layer.status !== "live";
          return `
            <article class="layer-item">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div>
                  <div class="layer-title">${escapeHtml(layer.label)}</div>
                  <div class="layer-copy">${escapeHtml(layer.description)}</div>
                </div>
                ${statusBadge(layer.status)}
              </div>
              <div class="layer-copy" style="margin-top:8px;">
                ${escapeHtml(layer.explanation)}<br>
                За кого: ${escapeHtml(layer.usefulFor)}.
              </div>
              <div class="badge-row" style="margin-top:10px;">
                <span class="badge">${escapeHtml(group.label)}</span>
                <span class="badge">${escapeHtml(layer.dataBasis)}</span>
                <button
                  class="button"
                  type="button"
                  data-layer-toggle="${escapeHtml(layer.id)}"
                  ${disabled ? "disabled" : ""}
                  style="padding:8px 10px;font-size:11px;${disabled ? "opacity:.45;cursor:not-allowed;" : ""}"
                >
                  ${enabled ? "Скрий слой" : "Покажи слой"}
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="panel-section">
          <div class="section-label">${escapeHtml(group.label)}</div>
          <div class="empty-card">${escapeHtml(group.description)}</div>
          ${items}
        </section>
      `;
    })
    .join("");

  const capabilityRows = Object.entries(state.bootstrap.capabilities)
    .map(
      ([groupName, items]) => `
        <section class="panel-section">
          <div class="section-label">${escapeHtml(capabilityGroupLabel(groupName))}</div>
          ${items
            .map(
              (item) => `
                <article class="capability-row">
                  <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                    <div class="layer-title">${escapeHtml(item.label)}</div>
                    ${statusBadge(item.status)}
                  </div>
                  <div class="layer-copy">${escapeHtml(item.note)}</div>
                </article>
              `
            )
            .join("")}
        </section>
      `
    )
    .join("");

  els.capabilitiesContent.innerHTML = `
    <div class="section-label">Capabilities</div>
    ${capabilityRows}
  `;

  els.layerGroupsContent.insertAdjacentHTML(
    "afterbegin",
    `
      <section class="panel-section">
        <div class="section-label">Избор на зона</div>
        <div class="section-note">Ако маркер е под panel, избери зона оттук.</div>
        <div class="zone-list">${zoneItems}</div>
      </section>
    `
  );

  document.querySelectorAll("[data-layer-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleLayer(button.dataset.layerToggle));
  });

  document.querySelectorAll("[data-zone-select]").forEach((button) => {
    button.addEventListener("click", () => selectZone(button.dataset.zoneSelect));
  });
}

function renderAlerts() {
  if (!state.bootstrap.alerts.length) {
    els.alertsContent.innerHTML = '<div class="empty-card">Няма активни сигнали за този режим.</div>';
    return;
  }

  els.alertsContent.innerHTML = state.bootstrap.alerts
    .map(
      (alert) => `
        <article class="alert-card">
          <div class="alert-title">${escapeHtml(alert.where)}</div>
          <div class="badge-row" style="margin:8px 0;">
            <span class="badge">${escapeHtml(alert.status)}</span>
            <span class="badge">${escapeHtml(alert.severity)}</span>
          </div>
          <div class="alert-copy">${escapeHtml(alert.why)}</div>
          <div class="alert-copy" style="margin-top:8px;"><strong>Action:</strong> ${escapeHtml(alert.recommendedAction)}</div>
        </article>
      `
    )
    .join("");
}

function renderDecisionPanel() {
  if (!state.decision) {
    els.decisionContent.innerHTML = '<div class="empty-card">Избери зона на картата, за да видиш decision-first оценка.</div>';
    return;
  }

  const { zone, risk, reasoning, confidence, roleAction, basis, meteo, fireSignal, spread, routing } = state.decision;
  const quickActions = roleAction.quickActions
    .map((action) => `<div class="quick-action">${escapeHtml(action)}</div>`)
    .join("");
  const liveDrivers = reasoning.live.drivers || [];
  const liveFireSignals = reasoning.live.fireSignals || [];
  const supportingSignals = reasoning.live.supportingSignals || [];
  const confirmationNote = reasoning.live.confirmationNote;
  const incidentNote = reasoning.live.incidentNote;
  const liveCards = [...liveFireSignals, ...liveDrivers];
  const reasons = liveCards.length
    ? liveCards
        .map(
          (driver) => `
            <article class="reason-card">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div class="reason-title">${escapeHtml(driver.label)} · ${escapeHtml(driver.displayValue)}</div>
                <span class="badge live">live</span>
              </div>
              <div class="reason-copy">${escapeHtml(driver.description)}</div>
              <div class="reason-copy">Влияние върху риска: ${driver.impactScore}/100</div>
            </article>
          `
        )
        .join("")
    : '<div class="empty-card">Няма отчетлив live signal за тази зона.</div>';
  const meteoValues = [
    meteo.values.temperature_c != null ? `Темп. ${meteo.values.temperature_c}°C` : null,
    meteo.values.humidity_pct != null ? `Влажн. ${meteo.values.humidity_pct}%` : null,
    meteo.values.wind_kmh != null ? `Вятър ${meteo.values.wind_kmh} km/h` : null,
  ]
    .filter(Boolean)
    .map((item) => `<span class="badge">${escapeHtml(item)}</span>`)
    .join("");
  const missingInputs = reasoning.missing.liveInputs.length
    ? `<div class="empty-card">Липсващи live meteo inputs: ${escapeHtml(reasoning.missing.liveInputs.join(", "))}.</div>`
    : "";
  const fireSignalBadges = [
    `<span class="badge ${escapeHtml(fireSignal.status)}">fire: ${escapeHtml(fireSignal.status)}</span>`,
    `<span class="badge">${escapeHtml(fireSignal.provider)}</span>`,
    fireSignal.status === "live" && fireSignal.nearestDistanceKm != null
      ? `<span class="badge">${escapeHtml(String(fireSignal.nearestDistanceKm))} km</span>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  const fireSignalNote = !liveFireSignals.length
    ? `<div class="empty-card">${escapeHtml(reasoning.missing.fireSignalNote)}</div>`
    : "";
  const supportingSignalsNote = supportingSignals.length
    ? `<div class="empty-card">Допълнителни сигнали: ${supportingSignals.length}</div>`
    : "";
  const confirmationCard = confirmationNote
    ? `<div class="empty-card">${escapeHtml(confirmationNote)}</div>`
    : "";
  const spreadCard = spread && spread.status !== "unavailable"
    ? `<div class="empty-card"><strong>Вятър и натиск на развитие</strong><br>${escapeHtml(spread.note)}<br>Натиск: ${escapeHtml(spread.spreadPressure)} · По-висок риск: ${escapeHtml(spread.higherRiskDirection)} · По-нисък риск: ${escapeHtml(spread.lowerRiskDirection)}</div>`
    : spread
      ? `<div class="empty-card">${escapeHtml(spread.note)}</div>`
      : "";
  const incidentCard = incidentNote
    ? `<div class="empty-card">${escapeHtml(incidentNote)}</div>`
    : "";
  const routingAvoid = (routing.avoid || []).length
    ? `<div class="reason-copy">Избягвай: ${escapeHtml(routing.avoid.join(", "))}</div>`
    : "";
  const routingSection = routing.status === "unavailable"
    ? `
      <section class="panel-section">
        <div class="section-label">Посока с по-нисък риск</div>
        <div class="empty-card">${escapeHtml(routing.note)}</div>
      </section>
    `
    : `
      <section class="panel-section">
        <div class="section-label">Посока с по-нисък риск</div>
        <div class="reason-card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div class="reason-title">${escapeHtml(routing.direction)} · ${escapeHtml(routing.target.label)}</div>
            <span class="badge ${escapeHtml(routing.status)}">${escapeHtml(routingStatusLabel(routing.status))}</span>
          </div>
          <div class="reason-copy">${escapeHtml(routing.note)}</div>
          <div class="reason-copy">Дистанция: ${escapeHtml(String(routing.distanceKm))} km · ${escapeHtml(routing.travelCost)}</div>
          <div class="reason-copy">Увереност: ${escapeHtml(confidenceLabel(routing.confidenceLevel))}</div>
          ${routingAvoid}
        </div>
      </section>
    `;
  const basisTags = confidence.basis.slice(0, 3);

  els.decisionContent.innerHTML = `
    <section class="decision-hero">
      <div class="decision-zone">${escapeHtml(zone.label)}</div>
      <div class="decision-meta">${escapeHtml(zone.region)} · ${escapeHtml(zone.type)}</div>
      <div class="decision-score">
        <div class="decision-score-value">${risk.score}</div>
        <div class="decision-score-copy">
          <strong>${escapeHtml(risk.severity.label)}</strong><br>
          ${escapeHtml(risk.actionStatus.label)}<br>
          ${escapeHtml(risk.summary)}
        </div>
      </div>
      <div class="badge-row" style="margin-top:12px;">
        <span class="badge">${escapeHtml(risk.severity.operationalAction)}</span>
        <span class="badge">${escapeHtml(confidence.method)}</span>
        <span class="badge">${escapeHtml(confidence.label)} confidence</span>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-label">Препоръчано действие</div>
      <div class="empty-card">
        <strong>${escapeHtml(roleAction.roleLabel)}</strong><br>
        ${escapeHtml(roleAction.recommendedAction)}
      </div>
      <div class="badge-row">
        ${roleAction.priorityActions.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>

    ${routingSection}

    <section class="panel-section">
      <div class="section-label">Live influence</div>
      <div class="empty-card">${escapeHtml(reasoning.summary)}</div>
      ${reasons}
      ${supportingSignalsNote}
      ${confirmationCard}
      ${incidentCard}
      ${spreadCard}
      ${fireSignalNote}
      ${missingInputs}
      <div class="empty-card">${escapeHtml(reasoning.missing.note)}</div>
    </section>

    <section class="panel-section">
      <div class="section-label">Основа на оценката</div>
      <div class="metric-grid">
        <article class="metric-row">
          <div class="metric-title">Увереност</div>
          <div class="metric-value">${confidence.score}/100</div>
        </article>
        <article class="metric-row">
          <div class="metric-title">Модел</div>
          <div class="metric-value" style="font-size:15px;">${escapeHtml(confidence.modelType)}</div>
        </article>
      </div>
      <div class="badge-row">
        <span class="badge ${escapeHtml(meteo.status)}">meteo: ${escapeHtml(meteo.status)}</span>
        <span class="badge">${escapeHtml(meteo.source)}</span>
        <span class="badge">${basis.fallbackUsed ? "meteo baseline" : "live meteo"}</span>
      </div>
      <div class="badge-row" style="margin-top:8px;">
        ${fireSignalBadges}
      </div>
      ${meteoValues ? `<div class="badge-row" style="margin-top:8px;">${meteoValues}</div>` : ""}
      ${basisTags.length ? `<div class="badge-row">${basisTags.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    </section>

    <section class="panel-section">
      <div class="section-label">Бързи действия</div>
      ${quickActions}
    </section>
  `;
}

function formatTimestamp(value) {
  if (!value) {
    return "No timestamp";
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return timestamp.toLocaleString("bg-BG", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function focusZoneOnMap(zoneId) {
  const zone = state.bootstrap.zones.find((item) => item.id === zoneId);
  renderLayersPanel();
  renderMapSelection();
  if (zone && state.map) {
    state.map.flyTo([zone.lat, zone.lon], 8, { duration: 0.45 });
  }
}

async function loadOperatorDashboardHome() {
  state.operator.loading = "home";
  state.operator.error = null;
  state.operator.view = "home";
  state.operator.zoneDecision = null;
  renderOperatorPanel();
  try {
    const [summary, incidents] = await Promise.all([
      fetchJson("/api/operator/summary"),
      fetchJson("/api/incidents?role=operator"),
    ]);
    state.operator.summary = summary;
    state.operator.incidents = incidents;
  } catch (error) {
    state.operator.error = error.message;
  } finally {
    state.operator.loading = null;
    renderOperatorPanel();
  }
}

async function openOperatorIncident(canonicalId) {
  state.operator.selectedIncidentId = canonicalId;
  state.operator.view = "incident";
  state.operator.loading = "incident";
  state.operator.error = null;
  state.operator.zoneDecision = null;
  renderOperatorPanel();
  try {
    const [detail, history] = await Promise.all([
      fetchJson(`/api/incidents/${encodeURIComponent(canonicalId)}?role=operator`),
      fetchJson(`/api/incidents/${encodeURIComponent(canonicalId)}/history?role=operator`),
    ]);
    state.operator.incidentDetail = detail;
    state.operator.incidentHistory = history;
    if (detail.zoneId) {
      state.selectedZoneId = detail.zoneId;
      state.operator.zoneDecision = await fetchJson(`/api/zones/${encodeURIComponent(detail.zoneId)}/decision?role=operator`);
      focusZoneOnMap(detail.zoneId);
    }
  } catch (error) {
    state.operator.error = error.message;
  } finally {
    state.operator.loading = null;
    renderOperatorPanel();
  }
}

async function openOperatorZoneDecision(zoneId) {
  if (!zoneId) {
    return;
  }
  state.selectedZoneId = zoneId;
  state.operator.view = "zone";
  state.operator.loading = "zone";
  state.operator.error = null;
  renderOperatorPanel();
  try {
    state.operator.zoneDecision = await fetchJson(`/api/zones/${encodeURIComponent(zoneId)}/decision?role=operator`);
    focusZoneOnMap(zoneId);
  } catch (error) {
    state.operator.error = error.message;
  } finally {
    state.operator.loading = null;
    renderOperatorPanel();
  }
}

function renderOperatorTimeline(items) {
  if (!items || !items.length) {
    return '<div class="empty-card">No recent incident timeline items are available yet.</div>';
  }
  return items
    .map(
      (item) => `
        <article class="timeline-item">
          <div class="timeline-title">${escapeHtml(item.label || item.type || "Timeline item")}</div>
          <div class="timeline-copy">${escapeHtml(formatTimestamp(item.timestamp))}</div>
        </article>
      `
    )
    .join("");
}

function renderOperatorHomeView() {
  const summary = state.operator.summary || {};
  const incidents = prioritizedOperatorIncidents();
  const stripNotes = [
    summary.activeCriticalIncidentsCount ? `${summary.activeCriticalIncidentsCount} active critical incidents need first review.` : null,
    summary.elevatedSpreadIncidentsCount ? `${summary.elevatedSpreadIncidentsCount} incidents show elevated spread pressure.` : null,
    summary.containedIncidentsCount ? `${summary.containedIncidentsCount} incidents are currently contained.` : null,
    summary.operatorAttentionCount ? `${summary.operatorAttentionCount} incidents deserve immediate inspection.` : null,
  ].filter(Boolean);

  const incidentItems = incidents.length
    ? incidents
        .map(
          (incident) => `
            <button
              class="operator-list-item ${state.operator.selectedIncidentId === incident.canonicalId ? "selected" : ""}"
              type="button"
              data-operator-open-incident="${escapeHtml(incident.canonicalId)}"
            >
              <div class="operator-list-head">
                <div>
                  <div class="operator-list-title">${escapeHtml(incident.zoneLabel || incident.canonicalId)}</div>
                  <div class="operator-list-meta">${escapeHtml(incident.canonicalId)}</div>
                </div>
                <div class="badge-row" style="justify-content:flex-end;">
                  <span class="badge ${escapeHtml(incident.incidentPriority || "watch")}">${escapeHtml(incidentPriorityLabel(incident.incidentPriority))}</span>
                  <span class="badge">${escapeHtml(incident.severityLevel || "unknown")}</span>
                  <span class="badge">${escapeHtml(incident.lifecycleState || incident.status || "active")}</span>
                  <span class="badge">${escapeHtml(spreadPressureLabel(incident.spreadPressure))}</span>
                </div>
              </div>
              <div class="operator-list-meta">Zone: ${escapeHtml(incident.zoneId || "n/a")} · Updated ${escapeHtml(formatTimestamp(incident.lastUpdatedAt))}</div>
            </button>
          `
        )
        .join("")
    : '<div class="empty-card">No active incidents are currently exposed for operator mode. The overview will surface priority and spread cues as soon as incidents appear.</div>';

  return `
    <section class="panel-section">
      <div class="section-label">Summary cards</div>
      <div class="operator-summary-grid">
        <article class="operator-summary-card">
          <div class="metric-title">Active incidents</div>
          <div class="operator-summary-value">${escapeHtml(String(summary.activeIncidentsCount ?? 0))}</div>
          <div class="operator-summary-copy">Current incident objects in the operator runtime view.</div>
        </article>
        <article class="operator-summary-card">
          <div class="metric-title">Active critical</div>
          <div class="operator-summary-value">${escapeHtml(String(summary.activeCriticalIncidentsCount ?? 0))}</div>
          <div class="operator-summary-copy">Critical incidents that remain active now.</div>
        </article>
        <article class="operator-summary-card">
          <div class="metric-title">Elevated spread</div>
          <div class="operator-summary-value">${escapeHtml(String(summary.elevatedSpreadIncidentsCount ?? summary.zonesWithElevatedSpread ?? 0))}</div>
          <div class="operator-summary-copy">Incidents where current spread pressure is elevated.</div>
        </article>
        <article class="operator-summary-card">
          <div class="metric-title">Immediate review</div>
          <div class="operator-summary-value">${escapeHtml(String(summary.operatorAttentionCount ?? 0))}</div>
          <div class="operator-summary-copy">Incidents ranked as immediate or priority review.</div>
        </article>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-label">Situational strip</div>
      <div class="operator-strip">
        ${stripNotes.length
          ? stripNotes.map((note) => `<div class="operator-inline-card"><div class="operator-inline-copy">${escapeHtml(note)}</div></div>`).join("")
          : '<div class="empty-card">No elevated operator notes at the moment.</div>'}
      </div>
    </section>

    <section class="panel-section">
      <div class="section-label">Incident list</div>
      <div class="section-note">Ordered by operational relevance: severity, lifecycle, spread pressure, then recent update.</div>
      <div class="operator-list">${incidentItems}</div>
    </section>
  `;
}

function renderOperatorIncidentView() {
  const detail = state.operator.incidentDetail;
  const historyItems = state.operator.incidentHistory || [];
  const zoneDecision = state.operator.zoneDecision || {};
  const spread = zoneDecision.spread || {};
  const terrain = spread.terrainInfluence || {};
  const crossConfirmation = zoneDecision.crossConfirmation || {};
  const latestHistory = historyItems[0];

  if (!detail) {
    return '<div class="empty-card">Select an incident from the overview to inspect incident detail.</div>';
  }

  return `
    <section class="panel-section">
      <div class="operator-toolbar">
        <button class="button" type="button" data-operator-nav="home">Back to overview</button>
        <button class="button" type="button" data-operator-open-zone="${escapeHtml(detail.zoneId || "")}" ${detail.zoneId ? "" : "disabled"}>Open zone decision</button>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-label">Incident identity</div>
      <div class="decision-hero">
        <div class="decision-zone">${escapeHtml(detail.zoneLabel || detail.canonicalId)}</div>
        <div class="decision-meta">${escapeHtml(detail.canonicalId)}</div>
        <div class="badge-row" style="margin-top:12px;">
          <span class="badge">${escapeHtml(detail.severityLevel || "unknown")}</span>
          <span class="badge">${escapeHtml(detail.lifecycleState || "unknown")}</span>
          <span class="badge">${escapeHtml(detail.status || "unknown")}</span>
        </div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-label">Support summary</div>
      <article class="reason-card">
        <div class="reason-title">Signals and sources</div>
        <div class="reason-copy">Sources: ${escapeHtml((detail.sources || []).join(", ") || "n/a")}</div>
        <div class="reason-copy">Signals in current incident context: ${escapeHtml(String(detail.signalsCount ?? 0))}</div>
      </article>
      ${crossConfirmation.status ? `
        <article class="reason-card">
          <div class="reason-title">Cross-confirmation</div>
          <div class="reason-copy">Status: ${escapeHtml(crossConfirmation.status)}</div>
          <div class="reason-copy">${escapeHtml(crossConfirmation.note || "Nearby multi-source support is part of the current incident confidence.")}</div>
        </article>
      ` : ""}
    </section>

    <section class="panel-section">
      <div class="section-label">Spread summary</div>
      <article class="reason-card">
        <div class="reason-title">${escapeHtml(spread.spreadPressure || "unavailable")} spread pressure</div>
        <div class="reason-copy">${escapeHtml(spread.note || "Spread summary is not available for this incident.")}</div>
        <div class="reason-copy">Higher-risk direction: ${escapeHtml(spread.higherRiskDirection || "n/a")} · Lower-risk direction: ${escapeHtml(spread.lowerRiskDirection || "n/a")}</div>
        <div class="reason-copy">Terrain: ${escapeHtml(terrain.slopeClass || "n/a")} slope · ${escapeHtml(terrain.terrainPressure || "n/a")} pressure</div>
      </article>
    </section>

    <section class="panel-section">
      <div class="section-label">History and timeline</div>
      ${latestHistory ? `
        <article class="reason-card">
          <div class="reason-title">Retained history snapshot</div>
          <div class="reason-copy">Lifecycle: ${escapeHtml(latestHistory.lifecycleState || "n/a")} · Severity: ${escapeHtml(latestHistory.severityLevel || "n/a")}</div>
          <div class="reason-copy">Last updated: ${escapeHtml(formatTimestamp(latestHistory.lastUpdatedAt))}</div>
        </article>
      ` : ""}
      ${renderOperatorTimeline(detail.timelineSummary || latestHistory?.timelineSummary || [])}
    </section>
  `;
}

function renderOperatorZoneView() {
  const decision = state.operator.zoneDecision;
  const incident = (decision || {}).incident || {};
  const spread = (decision || {}).spread || {};
  const terrain = spread.terrainInfluence || {};
  const routing = (decision || {}).routing || {};
  const risk = (decision || {}).risk || {};
  const history = (decision || {}).history || {};

  if (!decision) {
    return '<div class="empty-card">Select an incident or zone to inspect zone decision context.</div>';
  }

  return `
    <section class="panel-section">
      <div class="operator-toolbar">
        <button class="button" type="button" data-operator-nav="home">Back to overview</button>
        ${state.operator.incidentDetail ? '<button class="button" type="button" data-operator-nav="incident">Back to incident</button>' : ""}
      </div>
    </section>

    <section class="panel-section">
      <div class="section-label">Zone risk summary</div>
      <div class="decision-hero">
        <div class="decision-zone">${escapeHtml(decision.zone.label)}</div>
        <div class="decision-meta">${escapeHtml(decision.zone.region || "")}</div>
        <div class="decision-score">
          <div class="decision-score-value">${escapeHtml(String(risk.score ?? "n/a"))}</div>
          <div class="decision-score-copy">
            <strong>${escapeHtml((risk.severity || {}).label || "Risk")}</strong><br>
            ${escapeHtml((risk.actionStatus || {}).label || "")}
          </div>
        </div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-label">Incident linkage</div>
      <article class="reason-card">
        <div class="reason-title">${escapeHtml(incident.canonicalId || "No linked incident")}</div>
        <div class="reason-copy">Severity: ${escapeHtml(incident.severityLevel || "n/a")} · Lifecycle: ${escapeHtml(incident.lifecycleState || "n/a")} · Status: ${escapeHtml(incident.status || "n/a")}</div>
        <div class="reason-copy">Signals: ${escapeHtml(String(incident.signalsCount ?? 0))}</div>
      </article>
    </section>

    <section class="panel-section">
      <div class="section-label">Spread, terrain and routing</div>
      <article class="reason-card">
        <div class="reason-title">${escapeHtml(spread.spreadPressure || "unavailable")} spread pressure</div>
        <div class="reason-copy">${escapeHtml(spread.note || "Spread summary is unavailable.")}</div>
        <div class="reason-copy">Higher-risk direction: ${escapeHtml(spread.higherRiskDirection || "n/a")} · Lower-risk direction: ${escapeHtml(spread.lowerRiskDirection || "n/a")}</div>
        <div class="reason-copy">Terrain: ${escapeHtml(terrain.slopeClass || "n/a")} slope · ${escapeHtml(terrain.terrainPressure || "n/a")} pressure</div>
        <div class="reason-copy">Routing: ${escapeHtml(routing.direction || "n/a")} toward ${escapeHtml((routing.target || {}).label || "n/a")} · ${escapeHtml(routing.note || "No routing note")}</div>
      </article>
    </section>

    <section class="panel-section">
      <div class="section-label">Context note</div>
      <div class="empty-card">
        ${escapeHtml(decision.note || "No operator note is currently available.")}<br>
        Nearby history count: ${escapeHtml(String(history.recentIncidentsNearbyCount ?? 0))} · Retained zone history: ${escapeHtml(String(history.incidentHistoryCount ?? 0))}
      </div>
    </section>
  `;
}

function bindOperatorPanelEvents() {
  els.operatorContent.querySelectorAll("[data-operator-open-incident]").forEach((button) => {
    button.addEventListener("click", () => openOperatorIncident(button.dataset.operatorOpenIncident));
  });
  els.operatorContent.querySelectorAll("[data-operator-open-zone]").forEach((button) => {
    button.addEventListener("click", () => openOperatorZoneDecision(button.dataset.operatorOpenZone));
  });
  els.operatorContent.querySelectorAll("[data-operator-nav]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.dataset.operatorNav;
      if (target === "home") {
        state.operator.view = "home";
        renderOperatorPanel();
        return;
      }
      if (target === "incident") {
        state.operator.view = "incident";
        renderOperatorPanel();
      }
    });
  });
}

function renderOperatorPanel() {
  if (!isOperatorShellMode()) {
    els.operatorPanelTitle.textContent = "Operator Dashboard";
    els.operatorPanelSubtitle.textContent = "Overview, incident detail and zone decision context for operator mode.";
    els.operatorContent.innerHTML = '<div class="empty-card">Switch to the official role to open the operator dashboard shell.</div>';
    return;
  }

  const viewTitle = {
    home: "Operator Dashboard",
    incident: "Incident Detail",
    zone: "Zone Decision Context",
  }[state.operator.view] || "Operator Dashboard";

  const viewSubtitle = {
    home: "Summary cards, active incidents and compact situational context.",
    incident: "Current incident identity, support, spread and retained history context.",
    zone: "Current zone risk, terrain, spread and routing context.",
  }[state.operator.view] || "Operator dashboard shell.";

  els.operatorPanelTitle.textContent = viewTitle;
  els.operatorPanelSubtitle.textContent = viewSubtitle;

  if (state.operator.loading) {
    els.operatorContent.innerHTML = '<div class="empty-card">Loading operator data...</div>';
    return;
  }
  if (state.operator.error) {
    els.operatorContent.innerHTML = `<div class="empty-card">Operator shell failed to load: ${escapeHtml(state.operator.error)}</div>`;
    return;
  }

  if (state.operator.view === "incident") {
    els.operatorContent.innerHTML = renderOperatorIncidentView();
  } else if (state.operator.view === "zone") {
    els.operatorContent.innerHTML = renderOperatorZoneView();
  } else {
    els.operatorContent.innerHTML = renderOperatorHomeView();
  }

  bindOperatorPanelEvents();
}

function renderRoleOverlay() {
  const groups = [...new Set(state.bootstrap.roles.map((role) => role.audience))];
  els.roleGroups.innerHTML = groups
    .map((group) => {
      const cards = state.bootstrap.roles
        .filter((role) => role.audience === group)
        .map((role) => {
          const recommended = role.recommended ? "recommended" : "";
          return `
            <button class="role-card ${recommended}" type="button" data-role-id="${escapeHtml(role.id)}">
              <div class="role-icon">${escapeHtml(role.icon)}</div>
              <div class="role-card-title">${escapeHtml(role.label)}</div>
              <div class="role-card-copy">${escapeHtml(role.description)}</div>
              <div class="role-card-meta">
                <span>${escapeHtml(role.operationalLevel)}</span>
                ${role.recommended ? '<span class="badge live">recommended</span>' : ""}
              </div>
            </button>
          `;
        })
        .join("");
      return `
        <section>
          <div class="role-group-title">${escapeHtml(group)}</div>
          <div class="role-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  els.roleGroups.querySelectorAll("[data-role-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      localStorage.setItem("gory_role", button.dataset.roleId);
      els.roleOverlay.classList.remove("open");
      state.selectedZoneId = state.selectedZoneId || state.bootstrap.zones[0]?.id || null;
      await loadBootstrap(button.dataset.roleId);
    });
  });
}

function updateWidgetVisibility() {
  const visibleWidgets = new Set(state.bootstrap.activeRole.visibleWidgets);
  const operatorMode = isOperatorShellMode();
  els.operatorPanel.style.display = operatorMode ? "block" : "none";
  els.decisionPanel.style.display = operatorMode ? "none" : "block";
  els.alertsPanel.style.display = !operatorMode && visibleWidgets.has("alerts-panel") ? "block" : "none";
}

function initMap() {
  state.map = L.map("map", { zoomControl: false }).setView(BULGARIA_CENTER, 7);
  state.map.setMaxBounds(BULGARIA_BOUNDS);
  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 12,
  }).addTo(state.map);

  state.layerGroups = {
    markers: L.layerGroup().addTo(state.map),
    incidents: L.layerGroup().addTo(state.map),
    fireSignals: L.layerGroup().addTo(state.map),
    priority: L.layerGroup().addTo(state.map),
    alerts: L.layerGroup().addTo(state.map),
    settlement: L.layerGroup().addTo(state.map),
    terrain: L.layerGroup().addTo(state.map),
    drought: L.layerGroup().addTo(state.map),
  };

  state.map.on("moveend", () => {
    if (state.bootstrap) {
      renderLayersPanel();
    }
  });

  if (state.bootstrap) {
    renderLayersPanel();
  }
}

function renderMap() {
  if (!state.map) {
    initMap();
  }

  Object.values(state.layerGroups).forEach((layer) => layer.clearLayers());
  state.zoneMarkers = {};

  state.bootstrap.zones.forEach((zone) => {
    const marker = L.circleMarker([zone.lat, zone.lon], {
      radius: 11,
      weight: 2,
      color: "#ffffff",
      fillColor: severityColor(zone.severity.id),
      fillOpacity: state.visibleLayers.has("risk-index") ? 0.92 : 0.25,
    }).addTo(state.layerGroups.markers);
    marker.bindTooltip(`${zone.label} · ${zone.riskScore}/100`, { direction: "top", offset: [0, -8] });
    marker.on("click", () => selectZone(zone.id));
    state.zoneMarkers[zone.id] = marker;

    if (state.visibleLayers.has("priority-zones") && ["warning", "immediate"].includes(zone.actionStatus.id)) {
      L.circle([zone.lat, zone.lon], {
        radius: 22000,
        weight: 1.5,
        color: severityColor(zone.severity.id),
        fillColor: severityColor(zone.severity.id),
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(state.layerGroups.priority);
    }

    if (state.visibleLayers.has("alert-signals") && ["warning", "immediate"].includes(zone.actionStatus.id)) {
      L.marker([zone.lat + 0.1, zone.lon], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<div style="width:24px;height:24px;border-radius:999px;background:#fff;border:1px solid rgba(17,33,28,.12);display:grid;place-items:center;box-shadow:0 6px 12px rgba(17,33,28,.14);font-size:14px;">⚠</div>`,
          iconSize: [24, 24],
        }),
      }).addTo(state.layerGroups.alerts);
    }

    if (state.visibleLayers.has("settlement-exposure")) {
      L.circle([zone.lat, zone.lon], {
        radius: 12000,
        weight: 1,
        color: "#315d4f",
        fillColor: "#315d4f",
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(state.layerGroups.settlement);
    }

    if (state.visibleLayers.has("terrain-exposure")) {
      L.circle([zone.lat, zone.lon], {
        radius: 15000,
        weight: 1,
        dashArray: "5 4",
        color: "#7c6b54",
        fillOpacity: 0,
        interactive: false,
      }).addTo(state.layerGroups.terrain);
    }

    if (state.visibleLayers.has("drought-pressure")) {
      L.circle([zone.lat, zone.lon], {
        radius: 18000,
        weight: 1,
        color: "#cf7b4d",
        fillOpacity: 0,
        interactive: false,
      }).addTo(state.layerGroups.drought);
    }
  });

  if (state.visibleLayers.has("live-fire-signals")) {
    (state.bootstrap.incidentMarkers || []).forEach((incident) => {
      const lifecycle = incident.lifecycleState || "active";
      const severity = incident.severityLevel || "major";
      const lifecycleLabel = ({
        suspected: "S",
        active: "A",
        contained: "CT",
        closed: "CL",
      })[lifecycle] || "I";
      const severityLabel = ({
        minor: "m",
        major: "M",
        critical: "C",
      })[severity] || "M";
      const markerHtml = `<div style="width:24px;height:24px;border-radius:999px;background:rgba(32,71,61,.10);border:1px solid rgba(32,71,61,.28);display:grid;place-items:center;color:#20473d;box-shadow:0 4px 12px rgba(23,36,31,.10);font-size:8px;font-weight:600;">${escapeHtml(lifecycleLabel)}·${escapeHtml(severityLabel)}</div>`;
      L.marker([incident.location.latitude, incident.location.longitude], {
        interactive: false,
        keyboard: false,
        zIndexOffset: -5,
        icon: L.divIcon({
          className: "",
          html: markerHtml,
          iconSize: [24, 24],
        }),
      }).addTo(state.layerGroups.incidents);
    });

    (state.bootstrap.fireSignalMarkers || []).forEach((signal) => {
      const isCitizen = signal.sourceClass === "human_reported";
      const isOperational = signal.sourceClass === "verified_operational";
      const markerHtml = isCitizen
        ? `<div style="width:20px;height:20px;border-radius:999px;background:rgba(198,141,69,.16);border:1px solid rgba(198,141,69,.32);display:grid;place-items:center;color:#8c5f1b;box-shadow:0 4px 10px rgba(23,36,31,.08);font-size:10px;">C</div>`
        : isOperational
          ? `<div style="width:20px;height:20px;border-radius:999px;background:rgba(60,104,91,.14);border:1px solid rgba(60,104,91,.34);display:grid;place-items:center;color:#2f564a;box-shadow:0 4px 10px rgba(23,36,31,.08);font-size:10px;">O</div>`
          : `<div style="width:20px;height:20px;border-radius:999px;background:rgba(197,88,73,.14);border:1px solid rgba(197,88,73,.32);display:grid;place-items:center;color:#9b3f32;box-shadow:0 4px 10px rgba(23,36,31,.08);font-size:11px;">🔥</div>`;
      L.marker([signal.location.latitude, signal.location.longitude], {
        interactive: false,
        keyboard: false,
        zIndexOffset: -10,
        icon: L.divIcon({
          className: "",
          html: markerHtml,
          iconSize: [20, 20],
        }),
      }).addTo(state.layerGroups.fireSignals);
    });
  }

  renderMapSelection();
}

function renderMapSelection() {
  Object.entries(state.zoneMarkers).forEach(([zoneId, marker]) => {
    const isSelected = state.selectedZoneId === zoneId;
    marker.setStyle({
      radius: isSelected ? 14 : 11,
      weight: isSelected ? 3 : 2,
      color: "#ffffff",
      fillOpacity: state.visibleLayers.has("risk-index") ? 0.92 : 0.25,
    });
  });
}

function layerById(layerId) {
  return state.bootstrap.layers.find((item) => item.id === layerId);
}

function zoneDistanceToViewport(zone, bounds) {
  if (!bounds) {
    return Number.POSITIVE_INFINITY;
  }
  const center = bounds.getCenter();
  const dx = zone.lon - center.lng;
  const dy = zone.lat - center.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

function getRelevantZones() {
  const zones = [...state.bootstrap.zones];
  const bounds = state.map ? state.map.getBounds() : null;
  const visible = [];
  const nearby = [];
  const highRisk = [...zones].sort((a, b) => b.riskScore - a.riskScore);
  const ordered = [];
  const seen = new Set();

  const pushZone = (zone) => {
    if (!zone || seen.has(zone.id) || ordered.length >= 6) {
      return;
    }
    seen.add(zone.id);
    ordered.push(zone);
  };

  zones.forEach((zone) => {
    if (bounds && bounds.contains([zone.lat, zone.lon])) {
      visible.push(zone);
    } else {
      nearby.push(zone);
    }
  });

  nearby.sort((a, b) => zoneDistanceToViewport(a, bounds) - zoneDistanceToViewport(b, bounds));

  if (state.selectedZoneId) {
    pushZone(zones.find((zone) => zone.id === state.selectedZoneId));
  }

  visible.forEach(pushZone);
  nearby.forEach(pushZone);
  highRisk.forEach(pushZone);

  return ordered;
}

function toggleLayer(layerId) {
  const layer = layerById(layerId);
  if (!layer || layer.status !== "live") {
    return;
  }
  if (state.visibleLayers.has(layerId)) {
    state.visibleLayers.delete(layerId);
  } else {
    state.visibleLayers.add(layerId);
  }
  renderLayersPanel();
  renderMap();
}

function normalizePanelPositions() {
  document.querySelectorAll(".floating-panel").forEach((panel) => {
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  });
}

function initPanelDragging() {
  document.querySelectorAll(".floating-panel").forEach((panel) => {
    const handle = panel.querySelector("[data-drag-handle]");
    if (!handle) {
      return;
    }
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    handle.addEventListener("pointerdown", (event) => {
      startX = event.clientX;
      startY = event.clientY;
      originX = parseFloat(panel.style.left || "0");
      originY = parseFloat(panel.style.top || "0");
      handle.setPointerCapture(event.pointerId);

      const move = (moveEvent) => {
        const nextX = originX + (moveEvent.clientX - startX);
        const nextY = originY + (moveEvent.clientY - startY);
        panel.style.left = `${Math.max(8, Math.min(nextX, window.innerWidth - panel.offsetWidth - 8))}px`;
        panel.style.top = `${Math.max(112, Math.min(nextY, window.innerHeight - panel.offsetHeight - 8))}px`;
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  });
}

function bindGlobalEvents() {
  els.changeRoleButton.addEventListener("click", () => {
    els.roleOverlay.classList.add("open");
  });
}

async function boot() {
  bindGlobalEvents();
  await loadBootstrap(state.roleId);
  if (!localStorage.getItem("gory_role")) {
    els.roleOverlay.classList.add("open");
  }
}

boot().catch((error) => {
  console.error(error);
  els.decisionContent.innerHTML = `<div class="empty-card">Не успяхме да заредим Decision Core: ${escapeHtml(error.message)}</div>`;
});
