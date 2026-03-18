import type { KpiItem } from '@/types'

const colorMap = {
  blue:  { bar: 'from-sky-600 to-sky-400',        val: 'text-sky-400'   },
  green: { bar: 'from-emerald-600 to-green-400',   val: 'text-green-400' },
  amber: { bar: 'from-amber-600 to-amber-400',     val: 'text-amber-400' },
  red:   { bar: 'from-red-600 to-red-400',         val: 'text-red-400'   },
}

export function KpiCard({ value, label, change, color }: KpiItem) {
  const c = colorMap[color]
  return (
    <div className="relative bg-vatch-surface border border-vatch-border rounded-lg p-3 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${c.bar}`} />
      <div className={`text-[22px] font-black leading-none font-mono ${c.val}`}>{value}</div>
      <div className="text-[9px] text-vatch-muted uppercase tracking-wider mt-1">{label}</div>
      <div className="text-[10px] font-semibold mt-1 text-vatch-text-dim">{change}</div>
    </div>
  )
}
