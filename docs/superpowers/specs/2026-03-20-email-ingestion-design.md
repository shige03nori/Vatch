# メール取込・AI解析・DB自動登録 設計ドキュメント

**作成日**: 2026-03-20
**対象フェーズ**: Phase 2 中核機能
**ステータス**: 承認済み（v2 - レビュー指摘修正後）

---

## 概要

特定のメールアドレスから受信したメールの本文をClaude APIで解析し、案件（Case）または人材（Talent）情報を抽出してDBに自動登録する機能を実装する。

UIは既存の `/emails` ページが存在するが、静的ダミーデータを使用しているため、実際のDB連携に切り替える。

---

## 全体アーキテクチャ

```
[fly.io Scheduled Machines] ──HTTP POST→ /api/emails/fetch
                                              │
[UIボタン「今すぐ取込」] ──HTTP POST→ /api/emails/fetch
                                              │
                              ① EmailSource テーブルから
                                 取込対象アドレス一覧を取得（isActive=true）
                                              │
                              ② IMAP接続（imap-simple / imaps）
                                 各アカウントの未読メールを取得
                                 Message-IDで重複チェック
                                              │
                              ③ Email レコードを PENDING / UNKNOWN で DB 保存
                                 （type は AI解析前は UNKNOWN、解析後に更新）
                                              │
                              ④ Claude API（tool_use）で本文解析
                                 - 種別判定（CASE / TALENT / UNKNOWN）
                                 - 構造化情報抽出
                                 - Email status を PARSING に更新
                                              │
                              ⑤ Case or Talent レコードを DB 作成
                                 Email の type・status を更新（PARSED / ERROR）
                                 （UNKNOWN の場合はCase/Talent作成しない、status=PARSED）
                                              │
                              ⑥ ActivityLog に EMAIL_RECEIVED + EMAIL_PARSED を記録
```

---

## データモデル

### 新規追加：EmailSource テーブル

```prisma
model EmailSource {
  id        String   @id @default(cuid())
  label     String              // 表示名（例：「BP取込用」）
  imapHost  String              // IMAPサーバーホスト（例：imap.gmail.com）
  imapPort  Int      @default(993)
  imapUser  String              // IMAPログインユーザー（メールアドレス）
  imapPass  String              // AES-256-GCMで暗号化して保存（環境変数キー使用）
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**`EmailSource.imapUser` について**: このフィールドが受信ボックスのアドレスと取込対象アドレスを兼ねる。IMAPで接続するアカウント＝取込対象の受信ボックスとして扱う。

### 既存モデルへの変更

**1. `EmailType` enum に `UNKNOWN` を追加**

```prisma
enum EmailType {
  CASE
  TALENT
  UNKNOWN    // 追加：AI解析で種別不明 or 解析前の初期値
}
```

**2. `Email` モデルに `messageId` フィールドを追加**

```prisma
model Email {
  // ... 既存フィールド ...
  messageId String?  @unique  // RFC2822 Message-ID ヘッダー（重複防止）
  // ...
}
```

**3. `ActivityLog` モデルに `emailId` フィールドを追加（双方向リレーション）**

```prisma
model ActivityLog {
  // ... 既存フィールド ...
  emailId  String?  // 追加
  email    Email?   @relation(fields: [emailId], references: [id])
  // ...
}

// Email モデル側にも逆リレーションを追加（Prisma双方向リレーション要件）
model Email {
  // ... 既存フィールド ...
  activities ActivityLog[]  // 追加
}
```

**Prismaマイグレーション**: 上記の変更を1つのマイグレーションで実施。

**デプロイ順序**: スキーママイグレーション実行 → コードデプロイ の順序を厳守すること（逆順だと UNKNOWN type を参照するコードが先にデプロイされてランタイムエラーが発生する）。

---

## 新規パッケージ

| パッケージ | 用途 |
|---|---|
| `imap-simple` | IMAP接続・メール取得 |
| `@types/imap-simple` | 型定義 |
| `mailparser` | メール本文のパース（RFC2822→テキスト） |
| `@types/mailparser` | 型定義 |
| `@anthropic-ai/sdk` | Claude API呼び出し |

**node-cronは使用しない**（後述の定期実行を参照）。

---

## AI解析ロジック

### Claude API呼び出し方式：tool_use（JSON強制）

LLMが任意テキストを返すリスクを防ぐため、`tool_use` 方式でJSONを強制する。

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',  // 実装時点の最新有効モデルIDを使用すること
  max_tokens: 1024,
  tools: [{
    name: 'extract_email_info',
    description: 'メール本文から案件または人材情報を抽出する',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['CASE', 'TALENT', 'UNKNOWN'] },
        confidence: { type: 'number', minimum: 0, maximum: 100 },
        extractedName: { type: 'string' },
        skills: { type: 'array', items: { type: 'string' } },
        case: { /* Case用フィールド */ },
        talent: { /* Talent用フィールド */ },
      },
      required: ['type', 'confidence', 'skills'],
    },
  }],
  tool_choice: { type: 'tool', name: 'extract_email_info' },
  messages: [{ role: 'user', content: emailBodyText }],
})
```

**トークン上限対策**: メール本文が長大な場合は先頭3000文字に切り詰めてAPIに送る。

**リトライ**: API呼び出し失敗時は1回リトライ。2回失敗したらEmail.status = ERROR。

### 抽出スキーマ

```json
{
  "type": "CASE" | "TALENT" | "UNKNOWN",
  "confidence": 0-100,
  "extractedName": "案件名 or 人材名（任意）",
  "skills": ["スキル1", "スキル2"],

  "case": {
    "title": "案件名",
    "client": "顧客名",
    "clientEmail": "メールアドレス（任意）",
    "unitPrice": 700000,      // 月額円（整数）。不明な場合は0
    "startDate": "2026-04-01T00:00:00Z",  // 不明な場合は現在から1ヶ月後
    "workStyle": "REMOTE" | "ONSITE" | "HYBRID"  // 不明な場合はONSITE
  },

  "talent": {
    "name": "氏名またはイニシャル",
    "experience": 3,           // 経験年数（整数）。不明な場合は0
    "desiredRate": 600000,     // 希望月額円（整数）。不明な場合は0
    "location": "東京都",
    "workStyle": "REMOTE" | "ONSITE" | "HYBRID"  // 不明な場合はHYBRID
  }
}
```

### エラーハンドリング

| 状況 | 処理 |
|---|---|
| tool_use でJSON取得成功 | 通常フロー |
| API呼び出し失敗（1回目） | 1回リトライ |
| API呼び出し失敗（2回目） | Email.status = ERROR |
| type = UNKNOWN | Email.status = PARSED、type = UNKNOWN、Case/Talent作成しない |
| Case/Talent必須フィールド欠損 | デフォルト値で補完（上記スキーマ参照） |

### assignedUserId の決定

```typescript
const adminUser = await prisma.user.findFirst({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'asc' },
})
if (!adminUser) {
  // ADMINユーザーが存在しない場合はCase/Talent作成をスキップ
  // Email.status = ERROR、エラーメッセージをログに記録
  throw new Error('No ADMIN user found. Cannot assign Case/Talent.')
}
```

---

## 重複取込防止

1. **第1防衛ライン（Message-ID）**: IMAPから取得したメールの `Message-ID` ヘッダーを `Email.messageId` に保存。`@unique` 制約により重複挿入がDBレベルで防止される。
2. **第2防衛ライン（未読フラグ）**: IMAP取得時に `\Seen` フラグを確認し、未読のみ取得する。取得後に既読マークをつける。
3. Message-IDが存在しないメール（稀）は件名+送信元+受信日（UTC日付）の組み合わせで重複チェックする。

---

## APIエンドポイント

### 既存エンドポイント（変更なし）

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/emails` | GET | メール一覧（DB連携済み） |
| `/api/emails` | POST | メール手動作成 |

### 新規エンドポイント

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/api/emails/fetch` | POST | ADMIN | メール取込実行（同期・最大60秒） |
| `/api/email-sources` | GET | STAFF以上 | 取込設定一覧 |
| `/api/email-sources` | POST | ADMIN | 取込設定追加 |
| `/api/email-sources/[id]` | PATCH | ADMIN | 更新・有効/無効切替 |
| `/api/email-sources/[id]` | DELETE | ADMIN | 削除 |

**`/api/emails/fetch` のレスポンス**:
```json
{
  "success": true,
  "data": {
    "fetched": 5,     // 取得した新規メール数
    "parsed": 3,      // 解析成功数
    "errors": 1,      // エラー数
    "unknown": 1      // UNKNOWN判定数
  }
}
```

---

## ファイル構成

### 新規作成

```
src/
  lib/
    email-fetcher.ts       # IMAP接続・メール取得ロジック
    email-parser.ts        # Claude API解析ロジック
    email-ingestion.ts     # 取込フロー全体のオーケストレーター
    crypto.ts              # IMAPパスワードの暗号化・復号
    schemas/
      email-source.ts      # EmailSource の Zod スキーマ
  app/
    api/
      emails/
        fetch/
          route.ts         # POST /api/emails/fetch
      email-sources/
        route.ts           # GET, POST /api/email-sources
        [id]/
          route.ts         # PATCH, DELETE /api/email-sources/[id]
    (main)/
      settings/
        email-sources/
          page.tsx         # EmailSource 管理画面（新規）
```

### 変更ファイル

```
src/app/(main)/emails/page.tsx    # ダミーデータ→API連携に切り替え
prisma/schema.prisma              # EmailType.UNKNOWN追加、messageId追加、ActivityLog.emailId追加
```

---

## UI変更

### `/emails/page.tsx`

- `@/data/emails` の静的データを削除
- `useEffect` + `fetch('/api/emails')` でDB連携
- 「今すぐ取込」ボタン → `POST /api/emails/fetch` を呼び出し、完了後にリスト再取得・件数サマリー表示

### `/settings/email-sources`（新規）

- EmailSource の一覧表示（ラベル、IMAPホスト、ユーザー、有効/無効）
- 追加フォーム：ラベル、IMAPホスト、ポート、ユーザー名、パスワード（マスク入力）
- 有効/無効トグル
- 削除ボタン
- パスワードは画面に表示しない（保存済みの場合は「••••••••」表示）

---

## 定期実行

### 方式：fly.io Scheduled Machines（node-cronは使用しない）

fly.io の `min_machines_running = 0` / `auto_stop_machines = 'stop'` 設定のため、プロセス内 node-cron は機能しない。代わりに fly.io の Scheduled Machines を使って `/api/emails/fetch` を定期的にHTTP POSTする。

**設定方法（実装フェーズで確定）**: `fly.toml` には Scheduled Machines 専用のキーは存在しないため、CLI または Machine API で設定する。

```sh
# 参考：CLIでのScheduled Machine登録イメージ（実際のコマンドはfly.ioドキュメント参照）
fly machine run --app vatch \
  --schedule "*/30 * * * *" \
  --image registry.fly.io/vatch:latest \
  -- curl -X POST -H "Authorization: Bearer ${INTERNAL_API_KEY}" \
     https://vatch.fly.dev/api/emails/fetch
```

`/api/emails/fetch` には内部APIキー認証を追加する（セッションなしで呼び出し可能にするため）。実装フェーズで fly.io の最新ドキュメントを参照して実際のコマンドを確定すること。

---

## セキュリティ

### IMAPパスワードの暗号化

- `imapPass` はDBに暗号化して保存（AES-256-GCM）
- 暗号化キーは環境変数 `EMAIL_SOURCE_ENCRYPTION_KEY` で管理
- `src/lib/crypto.ts` に `encrypt` / `decrypt` 関数を実装
- API応答では `imapPass` フィールドを除外する

### `/api/emails/fetch` の認証

- 通常: NextAuth セッション（ADMIN必須）
- cron実行時: `Authorization: Bearer ${INTERNAL_API_KEY}` ヘッダーでの内部キー認証も許可

---

## ActivityLog 記録方針

```typescript
// EMAIL_RECEIVED: メール保存時
await prisma.activityLog.create({
  data: {
    type: 'EMAIL_RECEIVED',
    description: `メール取込: ${email.subject}`,
    userId: null,        // cron実行時はnull（システム操作）
    emailId: email.id,   // 追加フィールド
  },
})

// EMAIL_PARSED: 解析完了時
await prisma.activityLog.create({
  data: {
    type: 'EMAIL_PARSED',
    description: `AI解析完了: ${email.type} - ${email.extractedName ?? '不明'}`,
    userId: null,
    emailId: email.id,
    caseId: createdCase?.id,       // Caseが作成された場合
    talentId: createdTalent?.id,   // Talentが作成された場合
  },
})
```

---

## テスト方針

- `email-fetcher.ts`: IMAPクライアントをモックしてユニットテスト
- `email-parser.ts`: Anthropic SDKをモックしてユニットテスト（tool_use形式のレスポンスをモック）
- `email-ingestion.ts`: 統合テストでPrismaをモックしDB書き込みフローを検証
- `/api/emails/fetch`: 既存のAPIテスト方針に従いrouteテストを追加

---

## 実装スコープ（今回）

1. Prismaスキーマ変更・マイグレーション（EmailType.UNKNOWN追加、messageId、emailId、Email.activities逆リレーション）
2. パッケージ追加：`imap-simple` / `@types/imap-simple` / `mailparser` / `@types/mailparser` / `@anthropic-ai/sdk`
3. `src/lib/crypto.ts` 実装（AES-256-GCM暗号化）
4. `src/lib/email-fetcher.ts` 実装（IMAP取得・重複チェック）
5. `src/lib/email-parser.ts` 実装（Claude API / tool_use）
6. `src/lib/email-ingestion.ts` 実装（オーケストレーター）
7. `/api/emails/fetch` ルート実装（内部APIキー認証含む）
8. `/api/email-sources` CRUD ルート実装
9. `/emails/page.tsx` DB連携切り替え（EmailType.UNKNOWN の表示ガードを含む）
9a. EmailType を参照している既存ファイル全体を確認し、UNKNOWN ケースを追加（型安全の担保）
10. `/settings/email-sources` 管理画面実装
11. fly.io Scheduled Machines の設定（実装フェーズで確定）

---

## 将来拡張

- 添付ファイル（PDF・Word）のAI解析（Amazon Textract連携）
- AI解析結果の手動修正UI
- UNKNOWN メールの手動分類UI
- 取込ログの詳細表示
- スキル正規化（スキルマスタ連携）
