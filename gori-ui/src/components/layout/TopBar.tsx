import { t, translateMode } from '../../lib/translations'
import type { AppLanguage, AppMode, OperatorSummaryApi } from '../../types/gori'

type TopBarProps = {
  mode: AppMode
  language: AppLanguage
  summary: OperatorSummaryApi | null
  onToggleMode: () => void
  onResetDemo: () => void
  onToggleLanguage: () => void
}

function TopBar({
  mode,
  language,
  summary,
  onToggleMode,
  onResetDemo,
  onToggleLanguage,
}: TopBarProps) {
  const liveCount = summary?.activeIncidentsCount ?? 0

  return (
    <header className="h-14 border-b border-border bg-[#0d1218]/96 px-3 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.3em] text-accent">
              {t(language, 'topbarTitle')}
            </p>
            <h1 className="m-0 mt-1 text-sm font-semibold tracking-[0.22em] text-ink">
              {t(language, 'topbarSubtitle')}
            </h1>
          </div>
          <span className="hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300 sm:inline-flex">
            {mode === 'live'
              ? `${t(language, 'liveModeReady')} · ${liveCount}`
              : t(language, 'demoMode')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="rounded-md border border-border bg-panel px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300"
          >
            {t(language, 'languageLabel')}: {language.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={onToggleMode}
            className={`rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
              mode === 'demo'
                ? 'border-accent/30 bg-accent/10 text-orange-100'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {t(language, 'modeLabel')}: {translateMode(language, mode)}
          </button>
          <button
            type="button"
            onClick={onResetDemo}
            disabled={mode !== 'demo'}
            className="rounded-md border border-border bg-panel px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t(language, 'resetDemo')}
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
