import type { AlertItem } from '@/types'

type Props = { items: AlertItem[] }

export function AlertPanel({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-red" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">要対応アラート</span>
      </div>
      <div>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[#090f20] last:border-none">
            <span className="text-xs">{item.icon}</span>
            <span className="text-[11px] text-slate-300 flex-1">{item.message}</span>
            <span className="text-[10px] text-vatch-muted">{item.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
