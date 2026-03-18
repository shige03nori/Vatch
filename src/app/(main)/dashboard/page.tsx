import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MatchingPanel } from '@/components/dashboard/MatchingPanel'
import { AutoSendQueue } from '@/components/dashboard/AutoSendQueue'
import { AlertPanel } from '@/components/dashboard/AlertPanel'
import { PipelinePanel } from '@/components/dashboard/PipelinePanel'
import { ActivityLog } from '@/components/dashboard/ActivityLog'
import {
  kpiItems, matchingCandidates, autoSendQueue,
  alerts, pipeline, activityLog,
} from '@/data/dashboard'

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Vatch Dashboard" subtitle="VICENT SES管理プラットフォーム" />
      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {/* KPIs */}
        <div className="grid grid-cols-6 gap-2.5">
          {kpiItems.map((item) => <KpiCard key={item.id} {...item} />)}
        </div>
        {/* Main 2-col */}
        <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
          <MatchingPanel candidates={matchingCandidates} />
          <AutoSendQueue items={autoSendQueue} />
        </div>
        {/* Bottom 3-col */}
        <div className="grid grid-cols-3 gap-3.5">
          <AlertPanel items={alerts} />
          <PipelinePanel items={pipeline} />
          <ActivityLog items={activityLog} />
        </div>
      </main>
    </>
  )
}
