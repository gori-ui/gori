function TopBar() {
  return (
    <header className="border-b border-border bg-panel/92 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="m-0 text-lg font-semibold tracking-[0.2em] text-ink">
            GORI
          </h1>
          <span className="text-sm text-slate-400">Operator Console</span>
        </div>

        <div className="text-sm text-slate-400">Live prototype</div>
      </div>
    </header>
  )
}

export default TopBar
