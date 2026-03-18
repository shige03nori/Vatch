import type { ActivityItem } from '@/types'

type Props = { items: ActivityItem[] }

export function ActivityLog({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">最近の活動</span>
      </div>
      <div>
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 px-3.5 py-2 border-b border-[#090f20] last:border-none">
            <span className="text-[10px] text-vatch-muted-dark w-9 flex-shrink-0 font-mono mt-0.5">{item.time}</span>
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: item.color }} />
            <span className="text-[10px] text-vatch-muted leading-relaxed">
              {item.text}<strong className="text-vatch-text-dim">{item.highlight}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
