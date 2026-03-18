# Vatch DB設計仕様書

**作成日:** 2026-03-18
**対象フェーズ:** Phase 2（バックエンド基盤）
**目的:** ローカルPostgreSQL + Prisma によるデータベース基盤の設計

---

## 1. 技術選定

| 項目 | 選定 | 理由 |
|---|---|---|
| DB | PostgreSQL（ローカル） | 開発しやすい。本番はAurora PostgreSQLに移行 |
| ORM | Prisma | 型安全・スキーマファースト・Next.jsとの相性◎ |
| 認証 | NextAuth.js | User/Account/Sessionテーブルを自動管理 |
| スキル型 | `String[]`（PostgreSQL配列） | 現ダミーデータ型と一致。後でSkillテーブルに切り出し可能 |

---

## 2. エンティティ全体像

```
User ─────────── Case ──────── Matching ──── Proposal ──── Contract
                   │                │
                 Email           Talent

ActivityLog（横断ログ）
```

### テーブル一覧

| テーブル | 役割 |
|---|---|
| `User` | 担当者アカウント（NextAuth.js対応） |
| `Account` | NextAuth.js OAuthプロバイダー情報 |
| `Session` | NextAuth.js セッション |
| `VerificationToken` | NextAuth.js メール認証トークン |
| `Email` | 受信メール・AI解析結果 |
| `Case` | 案件（メールから生成 or 手動登録） |
| `Talent` | 人材（メールから生成 or 手動登録） |
| `Matching` | 案件×人材のAIマッチング結果 |
| `Proposal` | 提案メール（Matchingから生成） |
| `Contract` | 成約後の契約・売上管理 |
| `ActivityLog` | 全操作の活動ログ |

---

## 3. Prismaスキーマ定義

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// NextAuth.js 必須テーブル
// ─────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  role          Role      @default(STAFF)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts   Account[]
  sessions   Session[]
  cases      Case[]
  talents    Talent[]
  contracts  Contract[]
  activities ActivityLog[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

enum Role { ADMIN STAFF }

// ─────────────────────────────────────────
// ビジネスデータ
// ─────────────────────────────────────────

model Email {
  id            String      @id @default(cuid())
  receivedAt    DateTime
  from          String      // 送信元会社名
  fromEmail     String      // 送信元メールアドレス
  subject       String
  bodyText      String      @db.Text
  type          EmailType
  status        EmailStatus
  skills        String[]
  extractedName String?
  confidence    Int?        // AI信頼度 0-100
  s3Key         String?     // 将来: S3保存パス

  // 1通のメールから1案件 or 1人材が生成される（1:1）
  case     Case?   @relation("EmailToCase")
  talent   Talent? @relation("EmailToTalent")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum EmailType   { CASE TALENT }
enum EmailStatus { PENDING PARSING PARSED ERROR }

model Case {
  id             String     @id @default(cuid())
  title          String
  client         String
  clientEmail    String?
  skills         String[]
  unitPrice      Int        // 万円/月（売値）
  startDate      DateTime
  workStyle      WorkStyle
  status         CaseStatus @default(OPEN)
  assignedUserId String

  // 1通のメールから生成された場合の参照（任意）
  sourceEmailId  String?    @unique
  sourceEmail    Email?     @relation("EmailToCase", fields: [sourceEmailId], references: [id])

  assignedUser User        @relation(fields: [assignedUserId], references: [id])
  matchings    Matching[]
  contracts    Contract[]
  activities   ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}

enum WorkStyle  { REMOTE ONSITE HYBRID }
enum CaseStatus { OPEN MATCHING PROPOSING INTERVIEWING CONTRACTED CLOSED }

model Talent {
  id             String       @id @default(cuid())
  name           String
  skills         String[]
  experience     Int          // 経験年数
  desiredRate    Int          // 希望単価（万円）
  location       String
  workStyle      WorkStyle
  status         TalentStatus @default(AVAILABLE)
  availableFrom  DateTime?
  agencyEmail    String?      // 所属会社の連絡先メール（Proposal.to に使用）
  assignedUserId String

  // 1通のメールから生成された場合の参照（任意）
  sourceEmailId  String?      @unique
  sourceEmail    Email?       @relation("EmailToTalent", fields: [sourceEmailId], references: [id])

  assignedUser User        @relation(fields: [assignedUserId], references: [id])
  matchings    Matching[]
  contracts    Contract[]
  activities   ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}

enum TalentStatus { AVAILABLE ACTIVE NEGOTIATING ENDING_SOON INACTIVE }

model Matching {
  id              String         @id @default(cuid())
  caseId          String
  talentId        String
  score           Int            // AIスコア 0-100
  skillMatchRate  Int            // スキル一致率 0-100
  unitPriceOk     Boolean
  timingOk        Boolean
  locationOk      Boolean
  costPrice       Int            // 仕入値（万円/月）= Talent.desiredRate 相当
  sellPrice       Int            // 売値（万円/月）= Case.unitPrice 相当
  grossProfitRate Float          // (sellPrice - costPrice) / sellPrice * 100
  grossProfitOk   Boolean        // 10%以上かどうか
  reason          String?        @db.Text
  isAutoSend      Boolean        @default(false)
  status          MatchingStatus @default(UNPROPOSED)

  case       Case      @relation(fields: [caseId], references: [id])
  talent     Talent    @relation(fields: [talentId], references: [id])
  proposal   Proposal?
  activities ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([caseId, talentId])
  @@index([status])
}

enum MatchingStatus {
  UNPROPOSED    // 未提案
  PENDING_AUTO  // 自動送信待ち
  SENT          // 送信済み
  REPLIED       // 返信あり
  INTERVIEWING  // 面談中
  CONTRACTED    // 成約
  REJECTED      // 却下
}

model Proposal {
  id              String         @id @default(cuid())
  matchingId      String         @unique
  to              String         // 送信先（Talent.agencyEmail から自動引用）
  cc              String?
  subject         String
  bodyText        String         @db.Text
  status          ProposalStatus @default(DRAFT)
  isAutoSend      Boolean        @default(false)
  costPrice       Int            // 仕入値（万円/月）
  sellPrice       Int            // 売値（万円/月）
  grossProfitRate Float
  sentAt          DateTime?

  matching   Matching    @relation(fields: [matchingId], references: [id])
  contract   Contract?
  activities ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum ProposalStatus {
  DRAFT         // 下書き
  PENDING_AUTO  // 自動送信待ち（承認待ち）
  SENT          // 送信完了
  REPLIED       // 返信あり
  REJECTED      // 却下
}

model Contract {
  id              String         @id @default(cuid())
  caseId          String
  talentId        String
  assignedUserId  String
  proposalId      String?        @unique  // 成約元の提案メール
  startDate       DateTime
  endDate         DateTime?      // nullable: 終了日未定の場合あり
  unitPrice       Int            // 売値（万円/月）
  costPrice       Int            // 仕入値（万円/月）
  grossProfitRate Float
  status          ContractStatus @default(ACTIVE)

  case         Case      @relation(fields: [caseId], references: [id])
  talent       Talent    @relation(fields: [talentId], references: [id])
  assignedUser User      @relation(fields: [assignedUserId], references: [id])
  proposal     Proposal? @relation(fields: [proposalId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}

enum ContractStatus { ACTIVE ENDING_SOON ENDED RENEWAL_PENDING }

model ActivityLog {
  id          String          @id @default(cuid())
  type        ActivityLogType
  description String
  userId      String?
  caseId      String?
  talentId    String?
  matchingId  String?
  proposalId  String?

  user     User?     @relation(fields: [userId], references: [id])
  case     Case?     @relation(fields: [caseId], references: [id])
  talent   Talent?   @relation(fields: [talentId], references: [id])
  matching Matching? @relation(fields: [matchingId], references: [id])
  proposal Proposal? @relation(fields: [proposalId], references: [id])

  createdAt DateTime @default(now())
}

enum ActivityLogType {
  EMAIL_RECEIVED
  EMAIL_PARSED
  CASE_CREATED
  TALENT_CREATED
  MATCHING_CREATED
  PROPOSAL_SENT
  PROPOSAL_REPLIED
  CONTRACT_CREATED
  CONTRACT_RENEWED
}
```

---

## 4. リレーション設計のポイント

### Email → Case / Talent（1:1）
1通のメールから1案件 or 1人材が生成される（SES業務フロー）。FK は `Case.sourceEmailId` / `Talent.sourceEmailId` に配置し `@unique` で1:1を保証。手動登録の場合は `sourceEmailId = null`。

### Matching の一意制約
`@@unique([caseId, talentId])` により同一案件×人材ペアの重複を防止。

### Proposal と Matching の 1:1
`matchingId @unique` により1マッチング → 1提案を保証。

### Contract → Proposal の追跡
`proposalId @unique` により提案→成約の経路を追跡可能。提案なし（直接成約）の場合は `proposalId = null`。

### 粗利計算根拠
`Matching` に `costPrice` / `sellPrice` を保持し、Proposal 未生成状態でも粗利判定を可能にする。`grossProfitOk = grossProfitRate >= 10.0` をアプリケーション層で計算して保存。

---

## 5. 粗利ルール

| 条件 | 表示 | 自動送信 |
|---|---|---|
| grossProfitRate ≥ 10% | グリーン | 対象 |
| grossProfitRate < 10% | アンバー「要確認」 | 除外 |

---

## 6. ステータス遷移

### Case
`OPEN` → `MATCHING` → `PROPOSING` → `INTERVIEWING` → `CONTRACTED` → `CLOSED`

### Matching / Proposal の連動
| Matching | Proposal |
|---|---|
| `UNPROPOSED` | — |
| `PENDING_AUTO` | `PENDING_AUTO` |
| `SENT` | `SENT` |
| `REPLIED` | `REPLIED` |
| `CONTRACTED` | `SENT` or `REPLIED` |

---

## 7. 将来の拡張ポイント

- `skills` フィールドを `Skill` テーブルに正規化（スキルマスタ管理）
- `Email.s3Key` を使いAWS S3からメール本文を取得（Phase 3）
- `Contract` に月次売上スナップショットテーブルを追加
- Aurora PostgreSQL への接続切り替えは `DATABASE_URL` の変更のみ

---

## 8. 非機能要件

- すべてのテーブルに `createdAt` / `updatedAt` を付与（`ActivityLog` は `createdAt` のみ）
- 削除はソフトデリートではなくステータス管理で代替（シンプル優先）
- `status` フィールドには `@@index` を明示的に定義
- `Contract.endDate` は `DateTime?`（終了日未定ケースに対応）
