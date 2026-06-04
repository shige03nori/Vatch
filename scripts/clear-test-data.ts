// scripts/clear-test-data.ts
// テストデータを削除し、ADMINとPROPER人材のみ残す

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🗑️  テストデータを削除します...\n')

  // 削除前の件数確認
  const [
    caseCount, talentExtCount, matchingCount,
    proposalCount, contractCount, activityCount,
    emailCount, staffCount,
  ] = await Promise.all([
    prisma.case.count(),
    prisma.talent.count({ where: { talentType: 'EXTERNAL' } }),
    prisma.matching.count(),
    prisma.proposal.count(),
    prisma.contract.count(),
    prisma.activityLog.count(),
    prisma.email.count(),
    prisma.user.count({ where: { role: 'STAFF' } }),
  ])

  console.log('【削除対象】')
  console.log(`  案件:           ${caseCount} 件`)
  console.log(`  外部タレント:   ${talentExtCount} 名`)
  console.log(`  マッチング:     ${matchingCount} 件`)
  console.log(`  提案:           ${proposalCount} 件`)
  console.log(`  契約:           ${contractCount} 件`)
  console.log(`  活動ログ:       ${activityCount} 件`)
  console.log(`  受信メール:     ${emailCount} 件`)
  console.log(`  STAFF ユーザー: ${staffCount} 名`)

  // PROPERユーザーの確認
  const properCount = await prisma.user.count({ where: { role: 'PROPER' } })
  const adminUser   = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { name: true, email: true } })
  console.log('\n【保持するデータ】')
  console.log(`  ADMIN: ${adminUser?.name} (${adminUser?.email})`)
  console.log(`  PROPER ユーザー: ${properCount} 名`)

  console.log('\n削除を開始します...')

  // 依存関係の逆順で削除
  const [del1] = await Promise.all([prisma.activityLog.deleteMany()])
  console.log(`  ✓ 活動ログ: ${del1.count} 件削除`)

  const [del2] = await Promise.all([prisma.contract.deleteMany()])
  console.log(`  ✓ 契約: ${del2.count} 件削除`)

  const [del3] = await Promise.all([prisma.proposal.deleteMany()])
  console.log(`  ✓ 提案: ${del3.count} 件削除`)

  const [del4] = await Promise.all([prisma.matching.deleteMany()])
  console.log(`  ✓ マッチング: ${del4.count} 件削除`)

  const [del5] = await Promise.all([prisma.case.deleteMany()])
  console.log(`  ✓ 案件: ${del5.count} 件削除`)

  const [del6] = await Promise.all([
    prisma.talent.deleteMany({ where: { talentType: 'EXTERNAL' } }),
  ])
  console.log(`  ✓ 外部タレント: ${del6.count} 名削除`)

  const [del7] = await Promise.all([prisma.email.deleteMany()])
  console.log(`  ✓ 受信メール: ${del7.count} 件削除`)

  // STAFF ユーザーを削除（ADMIN と PROPER は保持）
  const [del8] = await Promise.all([
    prisma.user.deleteMany({ where: { role: 'STAFF' } }),
  ])
  console.log(`  ✓ STAFF ユーザー: ${del8.count} 名削除`)

  // 削除後の確認
  const remaining = await Promise.all([
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'PROPER' } }),
    prisma.talent.count({ where: { talentType: 'PROPER' } }),
  ])

  console.log('\n【残存データ確認】')
  console.log(`  ADMIN:           ${remaining[0]} 名 ✅`)
  console.log(`  PROPER ユーザー: ${remaining[1]} 名 ✅`)
  console.log(`  PROPER タレント: ${remaining[2]} 名 ✅`)
  console.log('\n🎉 テストデータの削除が完了しました')
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
