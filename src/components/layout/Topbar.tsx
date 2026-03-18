type TopbarProps = {
  title: string
  subtitle?: string
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <header className="h-[52px] flex-shrink-0 flex items-center gap-3 px-5 bg-vatch-surface border-b border-vatch-border">
      <div>
        <span className="text-sm font-bold text-vatch-text-bright">{title}</span>
        {subtitle && (
          <span className="ml-2 text-[11px] text-vatch-muted-dark">{subtitle}</span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          LIVE
        </div>
        <span className="text-[11px] text-vatch-muted-dark">{today}</span>
        <div className="w-7 h-7 rounded-full bg-vatch-border-light flex items-center justify-center text-[10px] text-vatch-cyan font-bold">
          山
        </div>
      </div>
    </header>
  )
}
