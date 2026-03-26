import type {
  AppLanguage,
  AppMode,
  ExposureTargetType,
  WindDirection,
} from '../types/gori'

type TranslationKey =
  | 'topbarTitle'
  | 'topbarSubtitle'
  | 'liveTelemetry'
  | 'reportIncident'
  | 'demoMode'
  | 'liveMode'
  | 'resetDemo'
  | 'sidebarTitle'
  | 'sidebarSubtitle'
  | 'sidebarEmpty'
  | 'noIncidentSelected'
  | 'incidentDetail'
  | 'executiveForecast'
  | 'firstThreatenedPlaces'
  | 'operationalStatus'
  | 'verification'
  | 'spreadContext'
  | 'signals'
  | 'timeline'
  | 'generateDecision'
  | 'decisionPlaceholder'
  | 'direction'
  | 'pressure'
  | 'wind'
  | 'windSupport'
  | 'status'
  | 'zone'
  | 'region'
  | 'incident'
  | 'source'
  | 'confidence'
  | 'update'
  | 'firstPlace'
  | 'recommendedAction'
  | 'map'
  | 'satellite'
  | 'liveIncidentFocus'
  | 'forecast'
  | 'selectAndGenerate'
  | 'affectedSettlements'
  | 'externalComparison'
  | 'compareExternally'
  | 'liveModeNote'
  | 'priorityWindow'
  | 'modeLabel'
  | 'languageLabel'
  | 'noConfirmedTargets'
  | 'shortForecast'
  | 'horizonsLabel'
  | 'exposureSummaryLabel'
  | 'currentSituation'
  | 'recommendedResponse'
  | 'placesAtRisk'
  | 'dataSources'
  | 'confidenceLevel'
  | 'lastUpdated'
  | 'whyThisMatters'
  | 'decisionPriority'
  | 'demoGuidance'
  | 'stepSelect'
  | 'stepDirection'
  | 'stepAction'
  | 'fireIntensity'
  | 'trustSignals'
  | 'reasoning'
  | 'liveModeReady'
  | 'priorityMonitor'
  | 'priorityPrepare'
  | 'priorityAct'

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  bg: {
    topbarTitle: 'Оперативен център',
    topbarSubtitle: 'GORI',
    liveTelemetry: 'Активни случаи',
    reportIncident: 'Подай сигнал',
    demoMode: 'Демо режим',
    liveMode: 'Жив режим',
    resetDemo: 'Нулирай демо',
    sidebarTitle: 'Инциденти',
    sidebarSubtitle: 'Водещият случай е откроен най-отгоре',
    sidebarEmpty: 'В момента няма активни инциденти.',
    noIncidentSelected: 'Няма избран инцидент.',
    incidentDetail: 'Инцидент',
    executiveForecast: 'Оперативна картина',
    firstThreatenedPlaces: 'Първи застрашени места',
    operationalStatus: 'Оперативен статус',
    verification: 'Достоверност',
    spreadContext: 'Поведение на пожара',
    signals: 'Източници на данни',
    timeline: 'Хронология',
    generateDecision: 'Покажи препоръка',
    decisionPlaceholder: 'Покажи препоръка, за да заредиш посоката на развитие.',
    direction: 'Посока',
    pressure: 'Интензитет',
    wind: 'Вятър',
    windSupport: 'Подкрепа от вятъра',
    status: 'Статус',
    zone: 'Зона',
    region: 'Район',
    incident: 'Инцидент',
    source: 'Източник',
    confidence: 'Увереност',
    update: 'Обновяване',
    firstPlace: 'Първо място',
    recommendedAction: 'Препоръчано действие',
    map: 'Карта',
    satellite: 'Сателит',
    liveIncidentFocus: 'Текуща ситуация',
    forecast: 'Кратка прогноза',
    selectAndGenerate: 'Избери инцидента и зареди препоръката, за да видиш направлението.',
    affectedSettlements: 'Засегнати населени места',
    externalComparison: 'Външна проверка',
    compareExternally: 'Сравни външно',
    liveModeNote: 'В жив режим се показват само реални backend данни.',
    priorityWindow: 'Прозорец',
    modeLabel: 'Режим',
    languageLabel: 'Език',
    noConfirmedTargets: 'Все още няма потвърдени назовани места в decision payload.',
    shortForecast: 'Кратка прогноза',
    horizonsLabel: 'Хоризонти',
    exposureSummaryLabel: 'Оценка на въздействието',
    currentSituation: 'Текуща ситуация',
    recommendedResponse: 'Препоръчана реакция',
    placesAtRisk: 'Места в риск',
    dataSources: 'Източници на данни',
    confidenceLevel: 'Ниво на увереност',
    lastUpdated: 'Последно обновяване',
    whyThisMatters: 'Защо е важно',
    decisionPriority: 'Приоритет на реакцията',
    demoGuidance: 'Как да четеш екрана',
    stepSelect: '1. Избран инцидент',
    stepDirection: '2. Посока на развитие',
    stepAction: '3. Препоръчано действие',
    fireIntensity: 'Интензитет на пожара',
    trustSignals: 'Достоверност',
    reasoning: 'Основания',
    liveModeReady: 'Живи данни',
    priorityMonitor: 'Наблюдение',
    priorityPrepare: 'Подготовка',
    priorityAct: 'Действие',
  },
  en: {
    topbarTitle: 'Operational Center',
    topbarSubtitle: 'GORI',
    liveTelemetry: 'Active cases',
    reportIncident: 'Report incident',
    demoMode: 'Demo mode',
    liveMode: 'Live mode',
    resetDemo: 'Reset demo',
    sidebarTitle: 'Incidents',
    sidebarSubtitle: 'Primary case highlighted first',
    sidebarEmpty: 'No active incidents currently detected.',
    noIncidentSelected: 'No incident selected.',
    incidentDetail: 'Incident',
    executiveForecast: 'Operational Picture',
    firstThreatenedPlaces: 'First Threatened Places',
    operationalStatus: 'Operational Status',
    verification: 'Credibility',
    spreadContext: 'Fire Behavior',
    signals: 'Data Sources',
    timeline: 'Timeline',
    generateDecision: 'Show Recommendation',
    decisionPlaceholder: 'Show recommendation to load the active spread corridor.',
    direction: 'Direction',
    pressure: 'Intensity',
    wind: 'Wind',
    windSupport: 'Wind support',
    status: 'Status',
    zone: 'Zone',
    region: 'Region',
    incident: 'Incident',
    source: 'Source',
    confidence: 'Confidence',
    update: 'Update',
    firstPlace: 'First place',
    recommendedAction: 'Recommended Action',
    map: 'Map',
    satellite: 'Satellite',
    liveIncidentFocus: 'Current Situation',
    forecast: 'Short Forecast',
    selectAndGenerate: 'Select the incident and load the recommendation to see the direction.',
    affectedSettlements: 'Affected Settlements',
    externalComparison: 'External Comparison',
    compareExternally: 'Compare externally',
    liveModeNote: 'Live mode shows backend incidents only.',
    priorityWindow: 'Window',
    modeLabel: 'Mode',
    languageLabel: 'Language',
    noConfirmedTargets: 'No confirmed named places in the decision payload yet.',
    shortForecast: 'Short Forecast',
    horizonsLabel: 'Horizons',
    exposureSummaryLabel: 'Exposure Summary',
    currentSituation: 'Current Situation',
    recommendedResponse: 'Recommended Response',
    placesAtRisk: 'Places at Risk',
    dataSources: 'Data Sources',
    confidenceLevel: 'Confidence Level',
    lastUpdated: 'Last Updated',
    whyThisMatters: 'Why This Matters',
    decisionPriority: 'Response Priority',
    demoGuidance: 'How to read this screen',
    stepSelect: '1. Incident selected',
    stepDirection: '2. Spread direction',
    stepAction: '3. Recommended action',
    fireIntensity: 'Fire Intensity',
    trustSignals: 'Credibility',
    reasoning: 'Reasoning',
    liveModeReady: 'Live data',
    priorityMonitor: 'Monitor',
    priorityPrepare: 'Prepare',
    priorityAct: 'Act',
  },
}

export function t(language: AppLanguage, key: TranslationKey) {
  return translations[language][key]
}

export function translateSeverity(language: AppLanguage, value: string) {
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      critical: 'критичен',
      major: 'значителен',
      minor: 'ограничен',
    },
    en: {
      critical: 'critical',
      major: 'major',
      minor: 'minor',
    },
  }
  return map[language][value] ?? value
}

export function translateLifecycle(language: AppLanguage, value: string) {
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      active: 'активен',
      stabilizing: 'стабилизиране',
      contained: 'овладян',
    },
    en: {
      active: 'active',
      stabilizing: 'stabilizing',
      contained: 'contained',
    },
  }
  return map[language][value] ?? value
}

export function translateSpreadPressure(language: AppLanguage, value: string) {
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      high: 'висок',
      elevated: 'повишен',
      moderate: 'умерен',
      low: 'нисък',
    },
    en: {
      high: 'high',
      elevated: 'elevated',
      moderate: 'moderate',
      low: 'low',
    },
  }
  return map[language][value] ?? value
}

export function translatePriorityCue(language: AppLanguage, value: string) {
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      Immediate: 'Незабавно',
      Priority: 'Приоритет',
      Monitor: 'Наблюдение',
      Watch: 'Следене',
    },
    en: {
      Immediate: 'Immediate',
      Priority: 'Priority',
      Monitor: 'Monitor',
      Watch: 'Watch',
    },
  }
  return map[language][value] ?? value
}

export function translateTargetType(language: AppLanguage, value: ExposureTargetType | string) {
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      settlement: 'населено място',
      road: 'път',
      farm: 'стопанство',
      utility: 'инфраструктура',
    },
    en: {
      settlement: 'settlement',
      road: 'road',
      farm: 'farm',
      utility: 'utility',
    },
  }
  return map[language][value] ?? value
}

export function translateSource(language: AppLanguage, value: string) {
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      verified_operational: 'Оперативен екип',
      human_reported: 'Граждански сигнал',
      automated_remote_sensing: 'Сателитно наблюдение',
      'Satellite hotspot': 'Сателитно наблюдение',
      'Citizen report': 'Граждански сигнал',
      'Operational confirmation': 'Оперативно потвърждение',
      'Thermal drift alert': 'Термален сигнал',
      'Patrol relay': 'Полеви екип',
      'Wind shift advisory': 'Предупреждение за вятър',
      'Ground crew telemetry': 'Наземна телеметрия',
      'Thermal persistence': 'Остатъчна топлина',
      'Operator validation': 'Оперативна проверка',
    },
    en: {
      verified_operational: 'Operational team',
      human_reported: 'Citizen report',
      automated_remote_sensing: 'Satellite observation',
    },
  }
  return map[language][value] ?? value
}

export function translateDirection(language: AppLanguage, value: WindDirection | string | null) {
  if (!value) {
    return language === 'bg' ? 'неуточнена' : 'unavailable'
  }
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      north: 'север',
      'north-east': 'североизток',
      east: 'изток',
      'south-east': 'югоизток',
      south: 'юг',
      'south-west': 'югозапад',
      west: 'запад',
      'north-west': 'северозапад',
    },
    en: {
      north: 'North',
      'north-east': 'North-east',
      east: 'East',
      'south-east': 'South-east',
      south: 'South',
      'south-west': 'South-west',
      west: 'West',
      'north-west': 'North-west',
    },
  }
  return map[language][value] ?? value
}

export function translateMode(language: AppLanguage, value: AppMode) {
  return value === 'demo' ? t(language, 'demoMode') : t(language, 'liveMode')
}

export function translateOperationalPriority(language: AppLanguage, value: string | null) {
  if (value === 'act') {
    return t(language, 'priorityAct')
  }
  if (value === 'prepare') {
    return t(language, 'priorityPrepare')
  }
  return t(language, 'priorityMonitor')
}

export function translateDecisionReason(language: AppLanguage, value: string) {
  const map: Record<AppLanguage, Record<string, string>> = {
    bg: {
      wind_supports_spread: 'Вятър подкрепя',
      fire_intensity_elevated: 'Интензитет висок',
      terrain_supports_spread: 'Терен усилва',
      near_term_target_exposed: 'Цел в +15 мин',
      corridor_target_exposed: 'Цел в коридора',
      wind_present: 'Вятър наличен',
      wind_aligned_with_spread: 'Вятър по посока',
      partial_meteo_context: 'Ограничен метео контекст',
    },
    en: {
      wind_supports_spread: 'Wind supports',
      fire_intensity_elevated: 'High intensity',
      terrain_supports_spread: 'Terrain amplifies',
      near_term_target_exposed: 'Target in +15 min',
      corridor_target_exposed: 'Target in corridor',
      wind_present: 'Wind present',
      wind_aligned_with_spread: 'Wind aligned',
      partial_meteo_context: 'Partial meteo context',
    },
  }

  return map[language][value] ?? value.replaceAll('_', ' ')
}

export function formatExposureSummary(
  language: AppLanguage,
  directionLabel: string,
  pressureLabel: string,
) {
  return language === 'bg'
    ? `Пожарът вероятно ще се развива към ${directionLabel} при ${pressureLabel} интензитет.`
    : `Fire is likely to spread toward ${directionLabel} under ${pressureLabel} intensity.`
}

export function formatExposureHorizons(language: AppLanguage, horizons: string[]) {
  const joined = horizons.join(' / ')
  return language === 'bg'
    ? `Кратък прогностичен прозорец: ${joined}.`
    : `Short forecast window: ${joined}.`
}
