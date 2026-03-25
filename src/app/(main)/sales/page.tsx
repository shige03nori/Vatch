import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PipelineTable } from '@/components/sales/PipelineTable'
import type { PipelineMatching } from '@/types/pipeline'

export default async function SalesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'
  const where = isAdmin ? {} : { case: { assignedUserId: session.user.id } }

  const data = await prisma.matching.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      case: {
        include: { assignedUser: { select: { id: true, name: true } } },
      },
      talent: {
        select: { id: true, name: true, skills: true, experience: true, desiredRate: true },
      },
      proposal: {
        select: {
          id: true, status: true, to: true, cc: true,
          subject: true, bodyText: true, sentAt: true,
          grossProfitRate: true, costPrice: true, sellPrice: true,
        },
      },
    },
  })

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f]">
      <div className="px-6 py-4 border-b border-[#2a2a2a]">
        <h1 className="text-lg font-bold text-white">営業管理</h1>
        <p className="text-xs text-[#555] mt-0.5">マッチングベースのパイプライン管理</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <PipelineTable initialData={data as PipelineMatching[]} />
      </div>
    </div>
  )
}
