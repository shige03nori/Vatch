// prisma/seed.ts
import { PrismaClient, WorkStyle, CaseStatus, TalentStatus, EmailType, EmailStatus, MatchingStatus, ProposalStatus, ContractStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 シード開始...');

  // 既存データをクリア（開発用）
  await prisma.activityLog.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.matching.deleteMany();
  await prisma.talent.deleteMany();
  await prisma.case.deleteMany();
  await prisma.email.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // ── ユーザー作成 ──
  const adminUser = await prisma.user.create({
    data: {
      name: '山田 太郎',
      email: 'yamada@vicent.co.jp',
      role: 'ADMIN',
    },
  });
  console.log('✅ ユーザー作成:', adminUser.email);

  // ── 案件作成 ──
  const cases = await Promise.all([
    prisma.case.create({
      data: {
        title: 'ECサイトリニューアル開発',
        client: '株式会社アルファコマース',
        clientEmail: 'saiyou@alpha-commerce.co.jp',
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        unitPrice: 85,
        startDate: new Date('2026-04-01'),
        workStyle: WorkStyle.REMOTE,
        status: CaseStatus.OPEN,
        assignedUserId: adminUser.id,
      },
    }),
    prisma.case.create({
      data: {
        title: '基幹システムマイグレーション',
        client: '東日本製造株式会社',
        skills: ['Java', 'Spring Boot', 'Oracle', 'AWS'],
        unitPrice: 95,
        startDate: new Date('2026-05-01'),
        workStyle: WorkStyle.HYBRID,
        status: CaseStatus.MATCHING,
        assignedUserId: adminUser.id,
      },
    }),
    prisma.case.create({
      data: {
        title: 'データ分析基盤構築',
        client: 'ビッグデータソリューションズ株式会社',
        skills: ['Python', 'Spark', 'Airflow', 'BigQuery'],
        unitPrice: 100,
        startDate: new Date('2026-04-01'),
        workStyle: WorkStyle.HYBRID,
        status: CaseStatus.INTERVIEWING,
        assignedUserId: adminUser.id,
      },
    }),
  ]);
  console.log('✅ 案件作成:', cases.length, '件');

  // ── 人材作成 ──
  const talents = await Promise.all([
    prisma.talent.create({
      data: {
        name: '田中 康介',
        skills: ['Java', 'Spring Boot', 'AWS', 'PostgreSQL'],
        experience: 8,
        desiredRate: 85,
        location: '東京都',
        workStyle: WorkStyle.REMOTE,
        status: TalentStatus.ACTIVE,
        availableFrom: new Date('2026-05-01'),
        agencyEmail: 'tanaka@agency1.co.jp',
        assignedUserId: adminUser.id,
      },
    }),
    prisma.talent.create({
      data: {
        name: '佐藤 美咲',
        skills: ['React', 'TypeScript', 'Next.js', 'GraphQL'],
        experience: 5,
        desiredRate: 70,
        location: '神奈川県',
        workStyle: WorkStyle.HYBRID,
        status: TalentStatus.AVAILABLE,
        availableFrom: new Date('2026-03-25'),
        agencyEmail: 'sato@agency2.co.jp',
        assignedUserId: adminUser.id,
      },
    }),
    prisma.talent.create({
      data: {
        name: '鈴木 龍一',
        skills: ['PM', 'Agile', 'Jira', 'Confluence'],
        experience: 12,
        desiredRate: 100,
        location: '東京都',
        workStyle: WorkStyle.ONSITE,
        status: TalentStatus.NEGOTIATING,
        availableFrom: new Date('2026-04-01'),
        agencyEmail: 'suzuki@agency3.co.jp',
        assignedUserId: adminUser.id,
      },
    }),
  ]);
  console.log('✅ 人材作成:', talents.length, '名');

  // ── マッチング作成 ──
  const matching1 = await prisma.matching.create({
    data: {
      caseId: cases[1].id,       // 基幹システムマイグレーション
      talentId: talents[0].id,   // 田中 康介（Java）
      score: 94,
      skillMatchRate: 96,
      unitPriceOk: true,
      timingOk: true,
      locationOk: true,
      costPrice: 85,
      sellPrice: 95,
      grossProfitRate: 10.5,
      grossProfitOk: true,
      reason: 'Java/Spring経験10年以上、金融系実績あり。スキル・単価・時期すべて適合。',
      isAutoSend: true,
      status: MatchingStatus.UNPROPOSED,
    },
  });

  const matching2 = await prisma.matching.create({
    data: {
      caseId: cases[0].id,       // ECサイトリニューアル
      talentId: talents[1].id,   // 佐藤 美咲（React）
      score: 88,
      skillMatchRate: 90,
      unitPriceOk: true,
      timingOk: true,
      locationOk: false,
      costPrice: 70,
      sellPrice: 85,
      grossProfitRate: 17.6,
      grossProfitOk: true,
      reason: 'React/TypeScript実績豊富。リモート希望だが週1出社要件あり、要確認。',
      isAutoSend: true,
      status: MatchingStatus.PENDING_AUTO,
    },
  });
  console.log('✅ マッチング作成: 2件');

  // ── 提案メール作成 ──
  await prisma.proposal.create({
    data: {
      matchingId: matching2.id,
      to: 'saiyou@alpha-commerce.co.jp',
      cc: 'yamada@vicent.co.jp',
      subject: '【ご提案】Reactエンジニア ご紹介の件',
      bodyText: `株式会社アルファコマース 採用担当 様

お世話になっております。VICENT株式会社の山田でございます。

この度は、ECサイトリニューアル案件に対して、弊社にてご支援できる人材をご紹介させていただきたく、ご連絡いたしました。

【ご紹介人材】
氏名: 佐藤 美咲 様
スキル: React / TypeScript / Next.js / GraphQL
経験年数: 5年

よろしくお願いいたします。

VICENT株式会社 山田 太郎`,
      status: ProposalStatus.PENDING_AUTO,
      isAutoSend: true,
      costPrice: 70,
      sellPrice: 85,
      grossProfitRate: 17.6,
    },
  });
  console.log('✅ 提案メール作成: 1件');

  // ── 契約作成 ──
  await prisma.contract.create({
    data: {
      caseId: cases[2].id,       // データ分析基盤構築
      talentId: talents[2].id,   // 鈴木 龍一
      assignedUserId: adminUser.id,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-03-31'),
      unitPrice: 95,
      costPrice: 82,
      grossProfitRate: 13.7,
      status: ContractStatus.ENDING_SOON,
    },
  });
  console.log('✅ 契約作成: 1件');

  // ── 活動ログ ──
  await prisma.activityLog.createMany({
    data: [
      {
        type: 'CASE_CREATED',
        description: 'ECサイトリニューアル案件を登録',
        userId: adminUser.id,
        caseId: cases[0].id,
      },
      {
        type: 'MATCHING_CREATED',
        description: 'AIマッチング実行: 基幹システム × 田中 康介 (94点)',
        userId: adminUser.id,
        caseId: cases[1].id,
        talentId: talents[0].id,
        matchingId: matching1.id,
      },
    ],
  });
  console.log('✅ 活動ログ作成: 2件');

  console.log('🎉 シード完了!');
}

main()
  .catch((e) => {
    console.error('❌ シードエラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
