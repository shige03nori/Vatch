export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-vatch-bg">
      <header className="border-b border-vatch-border bg-vatch-surface px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[18px] font-black text-amber-400 tracking-widest">VATCH</div>
          <div className="text-[9px] text-slate-600 tracking-wide">PORTAL</div>
        </div>
        <nav className="flex gap-1">
          <a href="/portal" className="px-3 py-1.5 text-xs text-vatch-muted hover:text-white rounded-md hover:bg-vatch-border transition-colors">案件一覧</a>
          <a href="/portal/favorites" className="px-3 py-1.5 text-xs text-vatch-muted hover:text-white rounded-md hover:bg-vatch-border transition-colors">お気に入り</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
