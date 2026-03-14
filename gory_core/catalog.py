from __future__ import annotations

from copy import deepcopy

SEVERITY_MODEL = [
    {
        "id": "low",
        "label": "Нисък",
        "range": [0, 19],
        "color": "#d9e6d5",
        "textColor": "#264034",
        "operationalAction": "наблюдение",
        "responseText": "Поддържай наблюдение и потвърждавай сигналите периодично.",
    },
    {
        "id": "moderate",
        "label": "Умерен",
        "range": [20, 39],
        "color": "#ecdfb8",
        "textColor": "#5d4714",
        "operationalAction": "внимание",
        "responseText": "Ограничи рисковите дейности и наблюдавай промяната в условията.",
    },
    {
        "id": "high",
        "label": "Висок",
        "range": [40, 59],
        "color": "#f1c08f",
        "textColor": "#6f3913",
        "operationalAction": "ограничаване на риск",
        "responseText": "Намали източниците на запалване и подготви локална реакция.",
    },
    {
        "id": "very-high",
        "label": "Много висок",
        "range": [60, 79],
        "color": "#e78a71",
        "textColor": "#67231a",
        "operationalAction": "подготовка",
        "responseText": "Подготви екипи, предупреди засегнатите и следи зоната без прекъсване.",
    },
    {
        "id": "critical",
        "label": "Критичен",
        "range": [80, 100],
        "color": "#c55849",
        "textColor": "#ffffff",
        "operationalAction": "незабавни мерки",
        "responseText": "Задействай незабавни мерки и работи по приоритетен кризисен режим.",
    },
]

ACTION_STATUS_MODEL = {
    "monitor": {
        "id": "monitor",
        "label": "Наблюдение",
        "tone": "calm",
        "description": "Няма непосредствена ескалация, но зоната трябва да се следи.",
    },
    "warning": {
        "id": "warning",
        "label": "Предупреждение",
        "tone": "elevated",
        "description": "Налице е повишен риск и са нужни превантивни действия.",
    },
    "immediate": {
        "id": "immediate",
        "label": "Незабавна реакция",
        "tone": "critical",
        "description": "Условията предполагат спешно координирано действие.",
    },
}

ROLE_ORDER = ["citizen", "guide", "farmer", "field", "official", "explore"]

ROLES = {
    "citizen": {
        "id": "citizen",
        "label": "Гражданин",
        "description": "Личен режим за бърза ориентация, предупреждения и инструкции.",
        "icon": "🏠",
        "audience": "Публични",
        "operationalLevel": "public",
        "recommended": True,
        "defaultLayers": ["risk-index", "alert-signals", "priority-zones"],
        "visibleWidgets": ["decision-strip", "legend", "decision-panel", "layers-panel"],
        "priorityActions": ["Виж инструкции", "Покажи близки пожари", "Сподели предупреждение"],
        "decisionWording": {
            "monitor": "Следи района и избягвай рискови дейности на открито.",
            "warning": "Ограничи открития огън и информирай близките, ако си в засегната зона.",
            "immediate": "Подготви се за бърза реакция и следвай указанията на местните власти.",
        },
    },
    "guide": {
        "id": "guide",
        "label": "Екскурзовод",
        "description": "Оценка на маршрут и групова безопасност в природни зони.",
        "icon": "🥾",
        "audience": "Публични",
        "operationalLevel": "public-plus",
        "recommended": False,
        "defaultLayers": ["risk-index", "priority-zones", "terrain-exposure"],
        "visibleWidgets": ["decision-strip", "legend", "decision-panel", "layers-panel"],
        "priorityActions": ["Прегледай маршрутния риск", "Отвори приоритетни зони", "Подготви алтернатива"],
        "decisionWording": {
            "monitor": "Маршрутът остава допустим, но следи промените и дръж резервен план.",
            "warning": "Ограничи достъпа до изложени участъци и прецени алтернативен маршрут.",
            "immediate": "Отложи или пренасочи придвижването през засегнатата зона.",
        },
    },
    "farmer": {
        "id": "farmer",
        "label": "Земеделец",
        "description": "Фокус върху полета, суша, вятър и планиране на работа на терен.",
        "icon": "🌾",
        "audience": "Публични",
        "operationalLevel": "sector",
        "recommended": False,
        "defaultLayers": ["risk-index", "drought-pressure", "terrain-exposure"],
        "visibleWidgets": ["decision-strip", "legend", "decision-panel", "layers-panel"],
        "priorityActions": ["Ограничи дейности на открито", "Провери вятър и суша", "Планирай работа по часове"],
        "decisionWording": {
            "monitor": "Поддържай наблюдение и избягвай ненужно палене и искрообразуване.",
            "warning": "Ограничи рисковите дейности по полетата и подготви техника за първа реакция.",
            "immediate": "Прекрати рисковите дейности и осигури готовност за защита на площите.",
        },
    },
    "field": {
        "id": "field",
        "label": "Горски / пожарен екип",
        "description": "Оперативен режим за екипи на терен и първа реакция.",
        "icon": "🚒",
        "audience": "Професионални",
        "operationalLevel": "operational",
        "recommended": False,
        "defaultLayers": ["risk-index", "priority-zones", "alert-signals", "live-fire-signals"],
        "visibleWidgets": ["decision-strip", "legend", "decision-panel", "layers-panel", "alerts-panel"],
        "priorityActions": ["Прегледай сигнали", "Маркирай за наблюдение", "Подготви екип"],
        "decisionWording": {
            "monitor": "Поддържай наблюдение на зоната и валидирай наличните сигнали.",
            "warning": "Премини към повишено наблюдение и подготви екип за евентуална намеса.",
            "immediate": "Насочи първичен ресурс и потвърди най-бързия достъп до зоната.",
        },
    },
    "official": {
        "id": "official",
        "label": "Държавен служител",
        "description": "Обобщен режим за координация, приоритети и насочване на ресурси.",
        "icon": "🏛",
        "audience": "Професионални",
        "operationalLevel": "strategic",
        "recommended": False,
        "defaultLayers": ["risk-index", "priority-zones", "settlement-exposure", "alert-signals", "live-fire-signals"],
        "visibleWidgets": ["decision-strip", "legend", "decision-panel", "layers-panel", "alerts-panel"],
        "priorityActions": ["Прегледай критични зони", "Виж препоръчани мерки", "Насочи ресурс по региони"],
        "decisionWording": {
            "monitor": "Поддържай наблюдение и подготви кратък briefing за регионалния статус.",
            "warning": "Активирай превантивна координация и информирай засегнатите общини.",
            "immediate": "Насочи ресурсите към зоната и координирай незабавно публично предупреждение.",
        },
    },
    "explore": {
        "id": "explore",
        "label": "Пълна карта",
        "description": "Технически изглед с всички налични и подготвени слоеве.",
        "icon": "🗺",
        "audience": "Технически",
        "operationalLevel": "technical",
        "recommended": False,
        "defaultLayers": ["risk-index", "priority-zones", "settlement-exposure", "terrain-exposure", "alert-signals", "live-fire-signals"],
        "visibleWidgets": ["decision-strip", "legend", "decision-panel", "layers-panel", "alerts-panel"],
        "priorityActions": ["Виж всички слоеве", "Сравни статути", "Провери capabilities"],
        "decisionWording": {
            "monitor": "Следи базовите сигнали и сравнявай наличните слоеве.",
            "warning": "Провери кои live слоеве потвърждават ескалацията и кои са още prepared.",
            "immediate": "Работи по зоната като приоритетна и изолира липсващите integration points.",
        },
    },
}

LAYER_GROUPS = [
    {
        "id": "environment",
        "label": "Environment",
        "description": "Метео и теренни фактори, които влияят на риска.",
    },
    {
        "id": "vegetation",
        "label": "Vegetation",
        "description": "Сухост на горивото и натрупване на леснозапалима растителност.",
    },
    {
        "id": "fire-activity",
        "label": "Fire Activity",
        "description": "Индекси и сигнали за вероятност от пожар или активност.",
    },
    {
        "id": "human-exposure",
        "label": "Human Exposure",
        "description": "Експозиция на населени места, маршрути и човешки натиск.",
    },
]

LAYERS = [
    {
        "id": "risk-index",
        "label": "BFRI / Fire Probability Index",
        "groupId": "fire-activity",
        "status": "live",
        "dataBasis": "scenario-engine",
        "description": "Показва rules-based вероятност за пожар 0-100 за избраните зони.",
        "whyItMatters": "Това е основният decision layer в тази фаза.",
        "usefulFor": "Всички роли",
        "explanation": "Rules-based индекс върху структурирани драйвери; не е learned AI модел.",
    },
    {
        "id": "priority-zones",
        "label": "Priority Zones",
        "groupId": "fire-activity",
        "status": "live",
        "dataBasis": "decision-engine",
        "description": "Подчертава зоните, които изискват наблюдение, предупреждение или реакция.",
        "whyItMatters": "Съкращава времето за сканиране и насочва вниманието.",
        "usefulFor": "Професионални роли и Пълна карта",
        "explanation": "Изчислява се от severity и action status модела.",
    },
    {
        "id": "alert-signals",
        "label": "Alert Signals",
        "groupId": "fire-activity",
        "status": "live",
        "dataBasis": "decision-engine",
        "description": "Показва активните alert objects за зоните с ескалация.",
        "whyItMatters": "Превежда риска в сигнал и препоръчано действие.",
        "usefulFor": "Гражданин, Горски / пожарен екип, Държавен служител",
        "explanation": "Сигналите са генерирани от decision core, не от външен alert feed.",
    },
    {
        "id": "live-fire-signals",
        "label": "Live Wildfire Signals",
        "groupId": "fire-activity",
        "status": "prepared",
        "dataBasis": "live-feed",
        "description": "Показва live markers за wildfire signals, включително remote sensing events, citizen smoke reports и operational confirmations.",
        "whyItMatters": "Добавя реални wildfire signals към decision core без да симулира hotspot detection, dispatch или command center logic.",
        "usefulFor": "Професионални роли и Пълна карта",
        "explanation": "Strategic target е Copernicus / EFFIS; текущият runtime source може да е honest fallback.",
    },
    {
        "id": "drought-pressure",
        "label": "Drought Pressure",
        "groupId": "vegetation",
        "status": "live",
        "dataBasis": "scenario-engine",
        "description": "Оценява натиска от суша и суха растителност в зоната.",
        "whyItMatters": "Подпомага планиране на работа на терен и ограничаване на риска.",
        "usefulFor": "Земеделец, Държавен служител, Пълна карта",
        "explanation": "В тази фаза използва структурирани scenario inputs.",
    },
    {
        "id": "terrain-exposure",
        "label": "Terrain & Access",
        "groupId": "environment",
        "status": "live",
        "dataBasis": "scenario-engine",
        "description": "Показва експозиция на терен и усложнен достъп в чувствителни зони.",
        "whyItMatters": "Влияе на времето за реакция и трудността на терен.",
        "usefulFor": "Екскурзовод, Горски / пожарен екип, Пълна карта",
        "explanation": "Представя достъпността като operational hint, без route engine.",
    },
    {
        "id": "settlement-exposure",
        "label": "Settlement Exposure",
        "groupId": "human-exposure",
        "status": "live",
        "dataBasis": "scenario-engine",
        "description": "Отразява близост до населени места и потенциална обществена експозиция.",
        "whyItMatters": "Подкрепя решения за предупреждение и координация.",
        "usefulFor": "Гражданин, Държавен служител, Пълна карта",
        "explanation": "В тази фаза експозицията е структурирана по zone catalog.",
    },
    {
        "id": "copernicus",
        "label": "Copernicus Layer",
        "groupId": "fire-activity",
        "status": "prepared",
        "dataBasis": "integration-ready",
        "description": "Подготвен слот за Copernicus / Sentinel-based imagery or products.",
        "whyItMatters": "Критичен е за Earth Observation надграждане и EU проектова логика.",
        "usefulFor": "Професионални роли и Пълна карта",
        "explanation": "Integration point е наличен, но tile source не е конфигуриран.",
    },
]

CAPABILITIES = {
    "liveNow": [
        {
            "id": "operational-legend",
            "label": "Operational Risk Legend",
            "status": "live",
            "note": "5-tier severity model с action mapping.",
        },
        {
            "id": "decision-panel",
            "label": "Decision Panel",
            "status": "live",
            "note": "Decision-first flow с риск, причини и действие.",
        },
        {
            "id": "role-engine",
            "label": "Role Engine",
            "status": "live",
            "note": "Реален role config, не само различни текстове.",
        },
        {
            "id": "live-meteo",
            "label": "Live Meteo Inputs",
            "status": "live",
            "note": "Температура, влажност и вятър от реален meteo source.",
        },
    ],
    "prepared": [
        {
            "id": "copernicus-integration",
            "label": "Copernicus Integration",
            "status": "prepared",
            "note": "Подготвен integration point без конфигуриран source.",
        },
        {
            "id": "effis-fire-feed",
            "label": "Copernicus / EFFIS fire feed",
            "status": "prepared",
            "note": "Primary strategic target за fire signal layer, но feature-level live event reliability още не е потвърдена.",
        },
        {
            "id": "live-data",
            "label": "Live national data feeds",
            "status": "prepared",
            "note": "UI и decision payload са готови, но live data sources още не са свързани.",
        },
    ],
}

ZONE_CATALOG = [
    {
        "id": "struma-southwest",
        "label": "Струмски югозападен коридор",
        "region": "Благоевград",
        "lat": 41.95,
        "lon": 23.13,
        "type": "Горско-урбанизиран интерфейс",
        "drivers": {
            "dryness": 0.74,
            "heat": 0.71,
            "wind": 0.58,
            "vegetation": 0.69,
            "human_pressure": 0.63,
            "terrain": 0.64,
            "settlement_exposure": 0.57,
            "fire_signal": 0.26,
        },
        "basis": ["meteo scenario", "vegetation stress", "terrain exposure", "historical pressure"],
    },
    {
        "id": "rhodope-foothills",
        "label": "Родопски предпланински пояс",
        "region": "Смолян",
        "lat": 41.62,
        "lon": 24.72,
        "type": "Планинска зона с туристически натиск",
        "drivers": {
            "dryness": 0.61,
            "heat": 0.56,
            "wind": 0.41,
            "vegetation": 0.76,
            "human_pressure": 0.47,
            "terrain": 0.73,
            "settlement_exposure": 0.35,
            "fire_signal": 0.11,
        },
        "basis": ["vegetation stress", "terrain exposure", "tourism pressure"],
    },
    {
        "id": "sakar-border-belt",
        "label": "Сакарски граничен пояс",
        "region": "Хасково",
        "lat": 41.88,
        "lon": 26.12,
        "type": "Открит терен с висока чувствителност към вятър",
        "drivers": {
            "dryness": 0.86,
            "heat": 0.83,
            "wind": 0.79,
            "vegetation": 0.59,
            "human_pressure": 0.38,
            "terrain": 0.48,
            "settlement_exposure": 0.44,
            "fire_signal": 0.34,
        },
        "basis": ["meteo scenario", "dry fuel load", "wind exposure"],
    },
    {
        "id": "burgas-coastal-belt",
        "label": "Бургаски крайморски пояс",
        "region": "Бургас",
        "lat": 42.52,
        "lon": 27.47,
        "type": "Крайбрежна зона с сезонен човешки натиск",
        "drivers": {
            "dryness": 0.68,
            "heat": 0.65,
            "wind": 0.52,
            "vegetation": 0.63,
            "human_pressure": 0.81,
            "terrain": 0.39,
            "settlement_exposure": 0.74,
            "fire_signal": 0.22,
        },
        "basis": ["human pressure", "settlement exposure", "vegetation stress"],
    },
    {
        "id": "central-balkan-interface",
        "label": "Централен Балкан интерфейс",
        "region": "Габрово",
        "lat": 42.82,
        "lon": 25.28,
        "type": "Горски масив с усложнен достъп",
        "drivers": {
            "dryness": 0.72,
            "heat": 0.69,
            "wind": 0.46,
            "vegetation": 0.81,
            "human_pressure": 0.29,
            "terrain": 0.82,
            "settlement_exposure": 0.28,
            "fire_signal": 0.19,
        },
        "basis": ["terrain exposure", "vegetation stress", "response difficulty"],
    },
    {
        "id": "danube-plains-east",
        "label": "Източен дунавски равнинен пояс",
        "region": "Русе",
        "lat": 43.84,
        "lon": 26.01,
        "type": "Земеделска зона с открити ветрови условия",
        "drivers": {
            "dryness": 0.57,
            "heat": 0.52,
            "wind": 0.61,
            "vegetation": 0.43,
            "human_pressure": 0.54,
            "terrain": 0.18,
            "settlement_exposure": 0.49,
            "fire_signal": 0.09,
        },
        "basis": ["wind exposure", "field activity", "dryness trend"],
    },
]

ZONE_ADJACENCY = {
    "struma-southwest": ["rhodope-foothills", "central-balkan-interface", "sakar-border-belt"],
    "rhodope-foothills": ["struma-southwest", "central-balkan-interface", "sakar-border-belt", "burgas-coastal-belt"],
    "sakar-border-belt": ["struma-southwest", "rhodope-foothills", "burgas-coastal-belt", "danube-plains-east"],
    "burgas-coastal-belt": ["rhodope-foothills", "sakar-border-belt", "central-balkan-interface", "danube-plains-east"],
    "central-balkan-interface": ["struma-southwest", "rhodope-foothills", "burgas-coastal-belt", "danube-plains-east"],
    "danube-plains-east": ["central-balkan-interface", "burgas-coastal-belt", "sakar-border-belt"],
}


def clone(data):
    return deepcopy(data)


def list_roles():
    return [clone(ROLES[role_id]) for role_id in ROLE_ORDER]


def get_role(role_id: str):
    return clone(ROLES.get(role_id, ROLES["citizen"]))


def list_layer_groups():
    return clone(LAYER_GROUPS)


def list_layers():
    return clone(LAYERS)


def get_severity_model():
    return clone(SEVERITY_MODEL)


def get_action_status_model():
    return clone(ACTION_STATUS_MODEL)


def get_capabilities():
    return clone(CAPABILITIES)


def list_zones():
    return clone(ZONE_CATALOG)


def get_zone(zone_id: str):
    for zone in ZONE_CATALOG:
        if zone["id"] == zone_id:
            return clone(zone)
    return None


def get_zone_neighbors(zone_id: str):
    return clone(ZONE_ADJACENCY.get(zone_id, []))
