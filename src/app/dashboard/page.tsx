import { Topbar } from '@/components/layout/Topbar'

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Vatch Dashboard" subtitle="VICENT SES管理プラットフォーム" />
      <main className="flex-1 overflow-y-auto p-5">
        <p className="text-vatch-muted">Dashboard loading...</p>
      </main>
    </>
  )
}
