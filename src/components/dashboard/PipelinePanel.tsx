import type { PipelineItem } from '@/types'

type Props = { items: PipelineItem[] }

export function PipelinePanel({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-purple" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">営業パイプライン</span>
      </div>
      <div className="px-3.5 py-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 py-2 border-b border-[#090f20] last:border-none">
            <span className="text-[10px] text-vatch-muted w-[72px] flex-shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 bg-vatch-border rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${item.percentage}%`, background: item.color }}
              />
            </div>
            <span className="text-[11px] font-black w-6 text-right" style={{ color: item.color }}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
