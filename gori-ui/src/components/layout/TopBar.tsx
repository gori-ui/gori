function TopBar() {
  return (
    <header className="border-b border-border bg-[#0d1218]/96 px-3 py-2 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.3em] text-accent">
              Emergency Operations Console
            </p>
            <h1 className="m-0 mt-1 text-sm font-semibold tracking-[0.22em] text-ink">
              GORI
            </h1>
          </div>
          <span className="hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300 sm:inline-flex">
            Live telemetry
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-border bg-panel px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300"
          >
            Report incident
          </button>
          <button
            type="button"
            className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-orange-100"
          >
            Demo mode on
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-panel px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300"
          >
            Reset demo
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
