import type { AutoSendItem } from '@/types'

const statusConfig = {
  auto:  { label: '自動',   className: 'bg-green-900 text-green-400' },
  check: { label: '要確認', className: 'bg-amber-900 text-amber-400' },
  draft: { label: '下書き', className: 'bg-[#1e3a5f] text-sky-400'  },
}

type Props = { items: AutoSendItem[] }

export function AutoSendQueue({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-amber" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">自動送信キュー</span>
        <span className="ml-auto text-[10px] text-vatch-amber font-semibold bg-amber-900/40 px-2 py-0.5 rounded">
          {items.length}件
        </span>
      </div>
      <div>
        {items.map((item) => {
          const st = statusConfig[item.status]
          const isLow = item.grossProfitRate < 10
          return (
            <div key={item.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[#090f20] last:border-none">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${st.className}`}>
                {st.label}
              </span>
              <span className="text-[11px] text-slate-300 flex-1 truncate">{item.label}</span>
              <span className={`text-[11px] font-black ${isLow ? 'text-amber-400' : 'text-green-400'}`}>
                {item.grossProfitRate}%
              </span>
            </div>
          )
        })}
      </div>
      <div className="p-3">
        <button className="w-full py-2 rounded-md bg-gradient-to-r from-sky-700 to-sky-600 text-white text-[11px] font-bold hover:from-sky-600 hover:to-sky-500 transition-all">
          ⚡ 一括確認・送信
        </button>
      </div>
    </div>
  )
}
