import type { MatchingCandidate } from '@/types'

const skillColors: Record<string, string> = {
  blue:   'bg-[#1e3a5f] text-sky-400',
  cyan:   'bg-[#1a2e45] text-blue-400',
  purple: 'bg-[#2d1e3a] text-purple-400',
  green:  'bg-[#1a3a2e] text-green-400',
}

type Props = { candidates: MatchingCandidate[] }

export function MatchingPanel({ candidates }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-cyan" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">AIマッチング候補</span>
        <span className="ml-auto text-[10px] text-vatch-cyan font-semibold bg-[#0c2d5a] px-2 py-0.5 rounded">
          {candidates.length}件
        </span>
      </div>
      <div>
        {candidates.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[#090f20] hover:bg-[#0b1628] transition-colors last:border-none">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${skillColors[c.skillColor] ?? skillColors.blue}`}>
              {c.skill}
            </span>
            <span className="text-[11px] text-slate-300 w-16 truncate">{c.talentName}</span>
            <span className="text-[10px] text-vatch-muted flex-1 truncate">{c.caseName}</span>
            <div className="w-14">
              <div className="w-full h-[3px] bg-vatch-border rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${c.score}%`,
                    background: c.score >= 85
                      ? 'linear-gradient(90deg,#38bdf8,#4ade80)'
                      : c.score >= 70
                      ? 'linear-gradient(90deg,#3b82f6,#38bdf8)'
                      : 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                  }}
                />
              </div>
            </div>
            <span className={`text-[11px] font-black w-8 text-right ${
              c.score >= 85 ? 'text-green-400' : c.score >= 70 ? 'text-sky-400' : 'text-purple-400'
            }`}>
              {c.score}%
            </span>
            <span className={`text-[9px] font-semibold w-10 ${c.grossProfitOk ? 'text-green-400' : 'text-amber-400'}`}>
              {c.grossProfitOk ? '粗利✓' : '粗利△'}
            </span>
            <button className="text-[9px] px-2 py-1 rounded border border-vatch-border-light text-vatch-cyan font-semibold hover:bg-[#0c2d5a] transition-colors">
              提案
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
