// prisma/seed.ts
import {
  PrismaClient,
  WorkStyle,
  CaseStatus,
  TalentStatus,
  MatchingStatus,
  ProposalStatus,
  ContractStatus,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

/** 今日を基準に n ヶ月前の day 日を返す */
function mAgo(months: number, day = 15): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - months, day)
}

async function main() {
  console.log('🌱 シード開始...')

  // ── クリア（依存関係の逆順）──
  await prisma.activityLog.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.proposal.deleteMany()
  await prisma.matching.deleteMany()
  await prisma.talent.deleteMany()
  await prisma.case.deleteMany()
  await prisma.email.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  // ── ユーザー（3名）──
  const [adminUser, staffUser1, staffUser2] = await Promise.all([
    prisma.user.create({
      data: { name: '山田 太郎', email: 's.nita@vicent.co.jp', role: 'ADMIN' },
    }),
    prisma.user.create({
      data: { name: '田中 花子', email: 'hanako@vicent.co.jp', role: 'STAFF' },
    }),
    prisma.user.create({
      data: { name: '鈴木 一郎', email: 'ichiro@vicent.co.jp', role: 'STAFF' },
    }),
  ])
  console.log('✅ ユーザー作成: 3名')

  // ── 案件（12件）──
  // cases[0-3]: adminUser, cases[4-7]: staffUser1, cases[8-11]: staffUser2
  const cases = await Promise.all([
    // admin (0-3)
    prisma.case.create({ data: { title: 'ECサイトリニューアル開発', client: '株式会社アルファコマース', clientEmail: 'saiyou@alpha-commerce.co.jp', skills: ['React', 'TypeScript', 'Node.js'], unitPrice: 85, startDate: mAgo(4, 1), workStyle: WorkStyle.REMOTE, status: CaseStatus.PROPOSING, assignedUserId: adminUser.id } }),
    prisma.case.create({ data: { title: '基幹システムマイグレーション', client: '東日本製造株式会社', clientEmail: 'hr@higashinihon.co.jp', skills: ['Java', 'Spring Boot', 'Oracle'], unitPrice: 95, startDate: mAgo(3, 1), workStyle: WorkStyle.HYBRID, status: CaseStatus.INTERVIEWING, assignedUserId: adminUser.id } }),
    prisma.case.create({ data: { title: 'データ分析基盤構築', client: 'ビッグデータソリューションズ株式会社', clientEmail: 'recruit@bigdata-sol.co.jp', skills: ['Python', 'Spark', 'BigQuery'], unitPrice: 100, startDate: mAgo(2, 1), workStyle: WorkStyle.HYBRID, status: CaseStatus.INTERVIEWING, assignedUserId: adminUser.id } }),
    prisma.case.create({ data: { title: 'クラウドインフラ移行', client: '中央システム株式会社', clientEmail: 'tech@chuo-sys.co.jp', skills: ['AWS', 'Terraform', 'Docker'], unitPrice: 90, startDate: mAgo(1, 1), workStyle: WorkStyle.REMOTE, status: CaseStatus.MATCHING, assignedUserId: adminUser.id } }),
    // staff1 (4-7)
    prisma.case.create({ data: { title: 'モバイルアプリ開発', client: '株式会社デジタルモバイル', clientEmail: 'adopt@dgmobile.co.jp', skills: ['Swift', 'Kotlin', 'Firebase'], unitPrice: 80, startDate: mAgo(3, 1), workStyle: WorkStyle.REMOTE, status: CaseStatus.PROPOSING, assignedUserId: staffUser1.id } }),
    prisma.case.create({ data: { title: 'ERP導入支援', client: '関西製造株式会社', clientEmail: 'it@kansai-mfg.co.jp', skills: ['SAP', 'ABAP', 'HANA'], unitPrice: 85, startDate: mAgo(5, 1), workStyle: WorkStyle.ONSITE, status: CaseStatus.CONTRACTED, assignedUserId: staffUser1.id } }),
    prisma.case.create({ data: { title: 'セキュリティ監査対応', client: '金融テクノロジー株式会社', clientEmail: 'security@fintec.co.jp', skills: ['CISSP', 'ペネトレーションテスト', 'SIEM'], unitPrice: 75, startDate: mAgo(4, 1), workStyle: WorkStyle.HYBRID, status: CaseStatus.CONTRACTED, assignedUserId: staffUser1.id } }),
    prisma.case.create({ data: { title: 'DX推進コンサルティング', client: '東京デジタル商事', clientEmail: 'dx@tdshoji.co.jp', skills: ['PMO', 'Agile', 'Jira'], unitPrice: 90, startDate: mAgo(4, 1), workStyle: WorkStyle.HYBRID, status: CaseStatus.CONTRACTED, assignedUserId: staffUser1.id } }),
    // staff2 (8-11)
    prisma.case.create({ data: { title: '機械学習プラットフォーム構築', client: 'AIイノベーション株式会社', clientEmail: 'ml@ai-innov.co.jp', skills: ['Python', 'TensorFlow', 'Kubernetes'], unitPrice: 110, startDate: mAgo(3, 1), workStyle: WorkStyle.REMOTE, status: CaseStatus.CONTRACTED, assignedUserId: staffUser2.id } }),
    prisma.case.create({ data: { title: 'IoTシステム開発', client: 'スマートファクトリー株式会社', clientEmail: 'iot@smartfactory.co.jp', skills: ['Embedded C', 'MQTT', 'Azure IoT'], unitPrice: 95, startDate: mAgo(2, 1), workStyle: WorkStyle.HYBRID, status: CaseStatus.CONTRACTED, assignedUserId: staffUser2.id } }),
    prisma.case.create({ data: { title: 'ブロックチェーン決済基盤', client: 'フィンテックジャパン株式会社', clientEmail: 'dev@fintechjp.co.jp', skills: ['Solidity', 'Ethereum', 'Web3.js'], unitPrice: 90, startDate: mAgo(6, 1), workStyle: WorkStyle.REMOTE, status: CaseStatus.CONTRACTED, assignedUserId: staffUser2.id } }),
    prisma.case.create({ data: { title: 'デジタルマーケティング支援', client: 'オムニチャネル株式会社', clientEmail: 'mktg@omnichannel.co.jp', skills: ['GA4', 'SEO', 'Tableau'], unitPrice: 75, startDate: mAgo(5, 1), workStyle: WorkStyle.REMOTE, status: CaseStatus.CONTRACTED, assignedUserId: staffUser2.id } }),
  ])
  console.log('✅ 案件作成: 12件')

  // ── 人材（12名）──
  // talents[0-3]: adminUser, talents[4-7]: staffUser1, talents[8-11]: staffUser2
  const talents = await Promise.all([
    // admin (0-3)
    prisma.talent.create({ data: { name: '田中 康介', skills: ['Java', 'Spring Boot', 'AWS', 'PostgreSQL'], experience: 8, desiredRate: 85, location: '東京都', workStyle: WorkStyle.REMOTE, status: TalentStatus.ACTIVE, availableFrom: mAgo(3, 1), agencyEmail: 'tanaka@agency1.co.jp', assignedUserId: adminUser.id } }),
    prisma.talent.create({ data: { name: '佐藤 美咲', skills: ['React', 'TypeScript', 'Next.js', 'GraphQL'], experience: 5, desiredRate: 70, location: '神奈川県', workStyle: WorkStyle.HYBRID, status: TalentStatus.AVAILABLE, availableFrom: mAgo(2, 1), agencyEmail: 'sato@agency2.co.jp', assignedUserId: adminUser.id } }),
    prisma.talent.create({ data: { name: '鈴木 龍一', skills: ['PM', 'Agile', 'Jira', 'Confluence'], experience: 12, desiredRate: 100, location: '東京都', workStyle: WorkStyle.ONSITE, status: TalentStatus.NEGOTIATING, availableFrom: mAgo(4, 1), agencyEmail: 'suzuki@agency3.co.jp', assignedUserId: adminUser.id } }),
    prisma.talent.create({ data: { name: '高橋 健一', skills: ['Python', 'Machine Learning', 'TensorFlow', 'GCP'], experience: 7, desiredRate: 90, location: '大阪府', workStyle: WorkStyle.REMOTE, status: TalentStatus.AVAILABLE, availableFrom: mAgo(1, 1), agencyEmail: 'takahashi@agency4.co.jp', assignedUserId: adminUser.id } }),
    // staff1 (4-7)
    prisma.talent.create({ data: { name: '伊藤 さゆり', skills: ['iOS', 'Swift', 'Objective-C', 'Firebase'], experience: 6, desiredRate: 75, location: '東京都', workStyle: WorkStyle.REMOTE, status: TalentStatus.AVAILABLE, availableFrom: mAgo(3, 1), agencyEmail: 'ito@agency5.co.jp', assignedUserId: staffUser1.id } }),
    prisma.talent.create({ data: { name: '渡辺 拓也', skills: ['SAP', 'ABAP', 'SAP HANA', 'SD/MM'], experience: 10, desiredRate: 85, location: '大阪府', workStyle: WorkStyle.ONSITE, status: TalentStatus.ACTIVE, availableFrom: mAgo(6, 1), agencyEmail: 'watanabe@agency6.co.jp', assignedUserId: staffUser1.id } }),
    prisma.talent.create({ data: { name: '中村 明', skills: ['CISSP', 'ペネトレーションテスト', 'Splunk', 'FortiGate'], experience: 9, desiredRate: 80, location: '東京都', workStyle: WorkStyle.HYBRID, status: TalentStatus.ACTIVE, availableFrom: mAgo(5, 1), agencyEmail: 'nakamura@agency7.co.jp', assignedUserId: staffUser1.id } }),
    prisma.talent.create({ data: { name: '小林 優花', skills: ['PMO', 'コンサルティング', 'PRINCE2', 'MS Project'], experience: 8, desiredRate: 90, location: '東京都', workStyle: WorkStyle.HYBRID, status: TalentStatus.ACTIVE, availableFrom: mAgo(5, 1), agencyEmail: 'kobayashi@agency8.co.jp', assignedUserId: staffUser1.id } }),
    // staff2 (8-11)
    prisma.talent.create({ data: { name: '加藤 雄太', skills: ['Python', 'TensorFlow', 'PyTorch', 'MLOps'], experience: 6, desiredRate: 95, location: '東京都', workStyle: WorkStyle.REMOTE, status: TalentStatus.ACTIVE, availableFrom: mAgo(4, 1), agencyEmail: 'kato@agency9.co.jp', assignedUserId: staffUser2.id } }),
    prisma.talent.create({ data: { name: '吉田 和也', skills: ['Embedded C', 'RTOS', 'MQTT', 'Azure IoT Hub'], experience: 11, desiredRate: 90, location: '愛知県', workStyle: WorkStyle.HYBRID, status: TalentStatus.ACTIVE, availableFrom: mAgo(3, 1), agencyEmail: 'yoshida@agency10.co.jp', assignedUserId: staffUser2.id } }),
    prisma.talent.create({ data: { name: '山本 翔', skills: ['Solidity', 'Ethereum', 'Web3.js', 'Hardhat'], experience: 5, desiredRate: 85, location: '東京都', workStyle: WorkStyle.REMOTE, status: TalentStatus.AVAILABLE, availableFrom: mAgo(1, 1), agencyEmail: 'yamamoto@agency11.co.jp', assignedUserId: staffUser2.id } }),
    prisma.talent.create({ data: { name: '松本 彩', skills: ['GA4', 'SEO', 'Tableau', 'Marketo'], experience: 7, desiredRate: 70, location: '東京都', workStyle: WorkStyle.REMOTE, status: TalentStatus.AVAILABLE, availableFrom: mAgo(2, 1), agencyEmail: 'matsumoto@agency12.co.jp', assignedUserId: staffUser2.id } }),
  ])
  console.log('✅ 人材作成: 12名')

  // ── マッチング（20件）──
  // ユニーク制約 @@unique([caseId, talentId]) に注意
  //   SENT:         cases[0-4]  × talents[0-4]
  //   REPLIED:      cases[5-9]  × talents[5-9]
  //   INTERVIEWING: cases[0-4]  × talents[5-9]
  //   CONTRACTED:   cases[5-9]  × talents[0-4]
  const matchings = await Promise.all([
    // SENT (5件)
    prisma.matching.create({ data: { caseId: cases[0].id, talentId: talents[0].id, score: 82, skillMatchRate: 85, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 75, sellPrice: 85,  grossProfitRate: 11.8, grossProfitOk: true,  status: MatchingStatus.SENT, reason: 'Java経験豊富、ECサイト経験あり' } }),
    prisma.matching.create({ data: { caseId: cases[1].id, talentId: talents[1].id, score: 75, skillMatchRate: 78, unitPriceOk: true, timingOk: true, locationOk: false, costPrice: 70, sellPrice: 85,  grossProfitRate: 17.6, grossProfitOk: true,  status: MatchingStatus.SENT, reason: 'React実績豊富、Java案件にも意欲的' } }),
    prisma.matching.create({ data: { caseId: cases[2].id, talentId: talents[2].id, score: 79, skillMatchRate: 80, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 88, sellPrice: 100, grossProfitRate: 12.0, grossProfitOk: true,  status: MatchingStatus.SENT, reason: 'PM経験でプロジェクト推進力あり' } }),
    prisma.matching.create({ data: { caseId: cases[3].id, talentId: talents[3].id, score: 84, skillMatchRate: 88, unitPriceOk: true, timingOk: true, locationOk: false, costPrice: 82, sellPrice: 90,  grossProfitRate: 8.9,  grossProfitOk: false, status: MatchingStatus.SENT, reason: 'Python/GCPスキルがクラウド移行に最適' } }),
    prisma.matching.create({ data: { caseId: cases[4].id, talentId: talents[4].id, score: 91, skillMatchRate: 93, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 68, sellPrice: 80,  grossProfitRate: 15.0, grossProfitOk: true,  status: MatchingStatus.SENT, reason: 'iOS/Swift専門、モバイル開発に最適' } }),
    // REPLIED (5件)
    prisma.matching.create({ data: { caseId: cases[5].id, talentId: talents[5].id, score: 95, skillMatchRate: 97, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 72, sellPrice: 85,  grossProfitRate: 15.3, grossProfitOk: true, status: MatchingStatus.REPLIED, reason: 'SAP ABAP10年、ERP導入の即戦力' } }),
    prisma.matching.create({ data: { caseId: cases[6].id, talentId: talents[6].id, score: 89, skillMatchRate: 91, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 62, sellPrice: 75,  grossProfitRate: 17.3, grossProfitOk: true, status: MatchingStatus.REPLIED, reason: 'CISSP保有、セキュリティ診断の専門家' } }),
    prisma.matching.create({ data: { caseId: cases[7].id, talentId: talents[7].id, score: 87, skillMatchRate: 89, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 76, sellPrice: 90,  grossProfitRate: 15.6, grossProfitOk: true, status: MatchingStatus.REPLIED, reason: 'PMO経験でDX推進プロジェクトに最適' } }),
    prisma.matching.create({ data: { caseId: cases[8].id, talentId: talents[8].id, score: 92, skillMatchRate: 94, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 95, sellPrice: 110, grossProfitRate: 13.6, grossProfitOk: true, status: MatchingStatus.REPLIED, reason: 'ML/MLOps専門、プラットフォーム構築経験あり' } }),
    prisma.matching.create({ data: { caseId: cases[9].id, talentId: talents[9].id, score: 88, skillMatchRate: 90, unitPriceOk: true, timingOk: true, locationOk: false, costPrice: 70, sellPrice: 85,  grossProfitRate: 17.6, grossProfitOk: true, status: MatchingStatus.REPLIED, reason: 'Embedded/IoT専門11年、Azure IoT実績' } }),
    // INTERVIEWING (5件)
    prisma.matching.create({ data: { caseId: cases[0].id, talentId: talents[5].id, score: 72, skillMatchRate: 74, unitPriceOk: true, timingOk: true, locationOk: false, costPrice: 78, sellPrice: 90,  grossProfitRate: 13.3, grossProfitOk: true, status: MatchingStatus.INTERVIEWING, reason: 'SAP経験者がEC案件に挑戦、ポテンシャル評価' } }),
    prisma.matching.create({ data: { caseId: cases[1].id, talentId: talents[6].id, score: 78, skillMatchRate: 80, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 68, sellPrice: 80,  grossProfitRate: 15.0, grossProfitOk: true, status: MatchingStatus.INTERVIEWING, reason: 'セキュリティ観点での基幹移行支援として評価' } }),
    prisma.matching.create({ data: { caseId: cases[2].id, talentId: talents[7].id, score: 83, skillMatchRate: 85, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 80, sellPrice: 95,  grossProfitRate: 15.8, grossProfitOk: true, status: MatchingStatus.INTERVIEWING, reason: 'PMOとしてデータ分析プロジェクト推進に貢献' } }),
    prisma.matching.create({ data: { caseId: cases[3].id, talentId: talents[8].id, score: 86, skillMatchRate: 88, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 85, sellPrice: 100, grossProfitRate: 15.0, grossProfitOk: true, status: MatchingStatus.INTERVIEWING, reason: 'MLエンジニアがクラウドMLパイプライン担当' } }),
    prisma.matching.create({ data: { caseId: cases[4].id, talentId: talents[9].id, score: 80, skillMatchRate: 82, unitPriceOk: true, timingOk: true, locationOk: false, costPrice: 63, sellPrice: 75,  grossProfitRate: 16.0, grossProfitOk: true, status: MatchingStatus.INTERVIEWING, reason: 'IoT経験者がモバイルIoT連携案件を担当' } }),
    // CONTRACTED (5件)
    prisma.matching.create({ data: { caseId: cases[5].id, talentId: talents[0].id, score: 86, skillMatchRate: 88, unitPriceOk: true, timingOk: true, locationOk: false, costPrice: 70, sellPrice: 85,  grossProfitRate: 17.6,  grossProfitOk: true, status: MatchingStatus.CONTRACTED, reason: 'Java経験者がERP連携システム担当で稼働中' } }),
    prisma.matching.create({ data: { caseId: cases[6].id, talentId: talents[1].id, score: 81, skillMatchRate: 83, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 65, sellPrice: 80,  grossProfitRate: 18.75, grossProfitOk: true, status: MatchingStatus.CONTRACTED, reason: 'Reactエンジニアがセキュリティダッシュボード担当' } }),
    prisma.matching.create({ data: { caseId: cases[7].id, talentId: talents[2].id, score: 93, skillMatchRate: 95, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 74, sellPrice: 90,  grossProfitRate: 17.8,  grossProfitOk: true, status: MatchingStatus.CONTRACTED, reason: 'PMがDX推進PMOとして稼働中' } }),
    prisma.matching.create({ data: { caseId: cases[8].id, talentId: talents[3].id, score: 90, skillMatchRate: 92, unitPriceOk: true, timingOk: true, locationOk: true,  costPrice: 90, sellPrice: 110, grossProfitRate: 18.2,  grossProfitOk: true, status: MatchingStatus.CONTRACTED, reason: 'PythonエンジニアがMLプラットフォーム担当で稼働中' } }),
    prisma.matching.create({ data: { caseId: cases[9].id, talentId: talents[4].id, score: 85, skillMatchRate: 87, unitPriceOk: true, timingOk: true, locationOk: false, costPrice: 78, sellPrice: 95,  grossProfitRate: 17.9,  grossProfitOk: true, status: MatchingStatus.CONTRACTED, reason: 'iOSエンジニアがIoTアプリUI担当で稼働中' } }),
  ])
  console.log('✅ マッチング作成: 20件')

  // ── 提案（15件）── sentAt を必ず設定する
  await Promise.all([
    // REPLIED matchings用 (m[5-9])
    prisma.proposal.create({ data: { matchingId: matchings[5].id,  to: cases[5].clientEmail!, subject: '【ご提案】SAP ABAPエンジニア ご紹介の件',    bodyText: 'ERP導入支援にSAP専門エンジニアをご提案します。',               status: ProposalStatus.REPLIED, sentAt: mAgo(5, 10), costPrice: 72, sellPrice: 85,  grossProfitRate: 15.3 } }),
    prisma.proposal.create({ data: { matchingId: matchings[6].id,  to: cases[6].clientEmail!, subject: '【ご提案】セキュリティエンジニア ご紹介の件',  bodyText: 'セキュリティ監査対応にCISSP保有エンジニアをご提案します。',   status: ProposalStatus.REPLIED, sentAt: mAgo(4,  8), costPrice: 62, sellPrice: 75,  grossProfitRate: 17.3 } }),
    prisma.proposal.create({ data: { matchingId: matchings[7].id,  to: cases[7].clientEmail!, subject: '【ご提案】PMOコンサルタント ご紹介の件',      bodyText: 'DX推進プロジェクトにPMOコンサルタントをご提案します。',       status: ProposalStatus.SENT,    sentAt: mAgo(3, 12), costPrice: 76, sellPrice: 90,  grossProfitRate: 15.6 } }),
    prisma.proposal.create({ data: { matchingId: matchings[8].id,  to: cases[8].clientEmail!, subject: '【ご提案】MLエンジニア ご紹介の件',           bodyText: '機械学習プラットフォームにMLOps専門エンジニアをご提案します。', status: ProposalStatus.REPLIED, sentAt: mAgo(4, 20), costPrice: 95, sellPrice: 110, grossProfitRate: 13.6 } }),
    prisma.proposal.create({ data: { matchingId: matchings[9].id,  to: cases[9].clientEmail!, subject: '【ご提案】IoTエンジニア ご紹介の件',          bodyText: 'IoTシステム開発に組込み専門エンジニアをご提案します。',        status: ProposalStatus.SENT,    sentAt: mAgo(5, 25), costPrice: 70, sellPrice: 85,  grossProfitRate: 17.6 } }),
    // INTERVIEWING matchings用 (m[10-14])
    prisma.proposal.create({ data: { matchingId: matchings[10].id, to: cases[0].clientEmail!, subject: '【ご提案】エンジニア ご紹介の件（追加）',      bodyText: 'ECサイトリニューアルに追加人材をご提案します。',               status: ProposalStatus.SENT,    sentAt: mAgo(3,  5), costPrice: 78, sellPrice: 90,  grossProfitRate: 13.3 } }),
    prisma.proposal.create({ data: { matchingId: matchings[11].id, to: cases[1].clientEmail!, subject: '【ご提案】エンジニア ご紹介の件（追加）',      bodyText: '基幹システム移行にセキュリティ視点を加えたエンジニアをご提案します。', status: ProposalStatus.REPLIED, sentAt: mAgo(2, 15), costPrice: 68, sellPrice: 80,  grossProfitRate: 15.0 } }),
    prisma.proposal.create({ data: { matchingId: matchings[12].id, to: cases[2].clientEmail!, subject: '【ご提案】PMOコンサルタント ご紹介の件（追加）', bodyText: 'データ分析プロジェクト管理にPMOを追加提案します。',            status: ProposalStatus.SENT,    sentAt: mAgo(2, 22), costPrice: 80, sellPrice: 95,  grossProfitRate: 15.8 } }),
    prisma.proposal.create({ data: { matchingId: matchings[13].id, to: cases[3].clientEmail!, subject: '【ご提案】MLエンジニア ご紹介の件（追加）',    bodyText: 'クラウドインフラのMLパイプラインにエンジニアをご提案します。',  status: ProposalStatus.REPLIED, sentAt: mAgo(0, 10), costPrice: 85, sellPrice: 100, grossProfitRate: 15.0 } }),
    prisma.proposal.create({ data: { matchingId: matchings[14].id, to: cases[4].clientEmail!, subject: '【ご提案】エンジニア ご紹介の件（追加）',      bodyText: 'モバイルIoT連携案件にエンジニアをご提案します。',              status: ProposalStatus.SENT,    sentAt: mAgo(1, 18), costPrice: 63, sellPrice: 75,  grossProfitRate: 16.0 } }),
    // CONTRACTED matchings用 (m[15-19])
    prisma.proposal.create({ data: { matchingId: matchings[15].id, to: cases[5].clientEmail!, subject: '【ご提案】Javaエンジニア ご紹介の件',         bodyText: 'ERP連携システムにJavaエンジニアをご提案します。',              status: ProposalStatus.REPLIED, sentAt: mAgo(5,  3), costPrice: 70, sellPrice: 85,  grossProfitRate: 17.6  } }),
    prisma.proposal.create({ data: { matchingId: matchings[16].id, to: cases[6].clientEmail!, subject: '【ご提案】Reactエンジニア ご紹介の件',        bodyText: 'セキュリティダッシュボードにReactエンジニアをご提案します。',  status: ProposalStatus.REPLIED, sentAt: mAgo(4, 14), costPrice: 65, sellPrice: 80,  grossProfitRate: 18.75 } }),
    prisma.proposal.create({ data: { matchingId: matchings[17].id, to: cases[7].clientEmail!, subject: '【ご提案】PMコンサルタント ご紹介の件',       bodyText: 'DX推進にPMコンサルタントをご提案します。',                    status: ProposalStatus.REPLIED, sentAt: mAgo(3, 20), costPrice: 74, sellPrice: 90,  grossProfitRate: 17.8  } }),
    prisma.proposal.create({ data: { matchingId: matchings[18].id, to: cases[8].clientEmail!, subject: '【ご提案】Pythonエンジニア ご紹介の件',       bodyText: 'MLプラットフォームにPythonエンジニアをご提案します。',          status: ProposalStatus.REPLIED, sentAt: mAgo(0,  5), costPrice: 90, sellPrice: 110, grossProfitRate: 18.2  } }),
    prisma.proposal.create({ data: { matchingId: matchings[19].id, to: cases[9].clientEmail!, subject: '【ご提案】iOSエンジニア ご紹介の件',          bodyText: 'IoTアプリUI担当にiOSエンジニアをご提案します。',              status: ProposalStatus.REPLIED, sentAt: mAgo(1, 25), costPrice: 78, sellPrice: 95,  grossProfitRate: 17.9  } }),
  ])
  console.log('✅ 提案作成: 15件（sentAt 設定済み）')

  // ── 契約（8件）── createdAt を明示的に過去日付で設定
  await Promise.all([
    // ACTIVE (staff1 が担当)
    prisma.contract.create({ data: { caseId: cases[5].id, talentId: talents[0].id, assignedUserId: staffUser1.id, startDate: mAgo(4, 1), unitPrice: 85,  costPrice: 70, grossProfitRate: 17.6,  status: ContractStatus.ACTIVE, createdAt: mAgo(4) } }),
    prisma.contract.create({ data: { caseId: cases[6].id, talentId: talents[1].id, assignedUserId: staffUser1.id, startDate: mAgo(3, 1), unitPrice: 80,  costPrice: 65, grossProfitRate: 18.75, status: ContractStatus.ACTIVE, createdAt: mAgo(3) } }),
    prisma.contract.create({ data: { caseId: cases[7].id, talentId: talents[2].id, assignedUserId: staffUser1.id, startDate: mAgo(3, 1), unitPrice: 90,  costPrice: 74, grossProfitRate: 17.8,  status: ContractStatus.ACTIVE, createdAt: mAgo(3, 15) } }),
    // ACTIVE (staff2 が担当)
    prisma.contract.create({ data: { caseId: cases[8].id, talentId: talents[3].id, assignedUserId: staffUser2.id, startDate: mAgo(2, 1), unitPrice: 110, costPrice: 90, grossProfitRate: 18.2,  status: ContractStatus.ACTIVE, createdAt: mAgo(2) } }),
    prisma.contract.create({ data: { caseId: cases[9].id, talentId: talents[4].id, assignedUserId: staffUser2.id, startDate: mAgo(1, 1), unitPrice: 95,  costPrice: 78, grossProfitRate: 17.9,  status: ContractStatus.ACTIVE, createdAt: mAgo(1) } }),
    // ENDED (staff2 が担当) - 古い案件
    prisma.contract.create({ data: { caseId: cases[10].id, talentId: talents[10].id, assignedUserId: staffUser2.id, startDate: mAgo(6, 1), endDate: mAgo(1, 28), unitPrice: 90, costPrice: 75, grossProfitRate: 16.7, status: ContractStatus.ENDED, createdAt: mAgo(5) } }),
    // ENDED (admin が担当) - 古い案件
    prisma.contract.create({ data: { caseId: cases[11].id, talentId: talents[11].id, assignedUserId: adminUser.id, startDate: mAgo(5, 1), endDate: mAgo(2, 28), unitPrice: 75, costPrice: 62, grossProfitRate: 17.3, status: ContractStatus.ENDED, createdAt: mAgo(4, 15) } }),
    // ACTIVE (admin が担当) - 今月成約
    prisma.contract.create({ data: { caseId: cases[10].id, talentId: talents[11].id, assignedUserId: adminUser.id, startDate: mAgo(0, 1), unitPrice: 85, costPrice: 70, grossProfitRate: 17.6, status: ContractStatus.ACTIVE, createdAt: mAgo(0, 10) } }),
  ])
  console.log('✅ 契約作成: 8件（createdAt 明示設定済み）')

  // ── 活動ログ ──
  await prisma.activityLog.createMany({
    data: [
      { type: 'CASE_CREATED',    description: 'テストデータ: 案件12件作成完了',    userId: adminUser.id },
      { type: 'MATCHING_CREATED', description: 'テストデータ: マッチング20件作成完了', userId: adminUser.id },
    ],
  })

  console.log('✅ 活動ログ作成')
  console.log('🎉 シード完了!')
  console.log('')
  console.log('📊 期待される /progress KPI（今月=3月・前月=2月）:')
  console.log('  - 今月提案数: 2件 | 前月比 ±0件')
  console.log('  - 今月成約数: 1件 | 前月比 ±0件')
  console.log('  - 成約率: 50.0% | 前月比 +0.0pt')
  console.log('  - 今月粗利: 15万 | 前月比 -2万')
  console.log('  パイプライン: SENT×5, REPLIED×5, INTERVIEWING×5, CONTRACTED×5')
  console.log('  担当者別: 山田太郎(提案4/成約2), 田中花子(提案8/成約3), 鈴木一郎(提案4/成約3)')
}

main()
  .catch((e) => {
    console.error('❌ シードエラー:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
