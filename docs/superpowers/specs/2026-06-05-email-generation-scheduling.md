# AIメール文章生成・スケジュール送信 設計書

**日付**: 2026-06-05  
**ステータス**: 承認済み

---

## 概要

提案（Proposal）をクライアントに送信する際、Claude AI API（Haiku）を使用してメール文章を自動生成し、即送信またはスケジュール送信する機能。メール生成時は提案情報・契約情報・人材情報を統合し、経歴書を自動添付。送信履歴・状態・スケジュール情報をすべて記録。

---

## 1. アーキテクチャ

### 1-1. ワークフロー

```
1. ユーザーが「メール送信」をクリック
   ↓
2. フロントエンド: POST /api/proposals/:id/send-email (生成リクエスト)
   ↓
3. バックエンド: メール送信ジョブ作成 → DB に保存 → 即座に応答 (jobId 返却)
   ↓
4. フロントエンド: 生成状態をポーリング GET /api/proposals/:id/email-jobs/:jobId
   ↓
5. バックエンド: 別プロセス（Node.js Worker/Cron）で実行
   - Claude Haiku でメール文章生成
   - 経歴書 PDF 取得
   - メール送信（SMTP）またはスケジュール登録
   ↓
6. ジョブ完了 → DB に記録 → フロントエンド通知
```

### 1-2. 非同期ジョブ処理

- メール生成・送信は非同期で実行
- UI ブロック無し
- スケール可能
- ポーリング（30秒間隔）でジョブ状態取得

---

## 2. データベーススキーマ

```prisma
model EmailJob {
  id              String    @id @default(cuid())
  proposalId      String
  proposal        Proposal  @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  
  status          String    // PENDING, GENERATING, SENDING, SENT, FAILED, SCHEDULED
  generatedContent String?  // 生成されたメール本文（暗号化）
  
  sendType        String    // NOW, SCHEDULED
  scheduledAt     DateTime? // 送信予定日時（SCHEDULED の場合）
  sentAt          DateTime? // 実際の送信日時
  
  attachmentPath  String?   // 経歴書ファイルパス
  
  errorMessage    String?   // 失敗時のエラーメッセージ
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([proposalId])
  @@index([status])
  @@index([scheduledAt])
}
```

**Proposal モデルへの追加:**
```prisma
model Proposal {
  // ... 既存フィールド
  emailJobs EmailJob[]
}
```

---

## 3. API 設計

### 3-1. POST /api/proposals/:id/send-email

**リクエスト:**
```json
{
  "sendType": "NOW" | "SCHEDULED",
  "scheduledAt": "2026-06-10T09:00:00Z"
}
```

**レスポンス (即座に応答):**
```json
{
  "success": true,
  "jobId": "job_xxx",
  "status": "PENDING"
}
```

**仕様:**
- 提案の所有者（営業担当者）のみ実行可能
- 即座に応答、バックグラウンド処理開始
- `sendType: SCHEDULED` の場合、`scheduledAt` は現在時刻より後の指定が必須

### 3-2. GET /api/proposals/:id/email-jobs/:jobId

**レスポンス:**
```json
{
  "id": "job_xxx",
  "status": "GENERATING" | "SENDING" | "SENT" | "FAILED" | "SCHEDULED",
  "generatedContent": "メール本文...",
  "sentAt": "2026-06-05T14:30:00Z",
  "errorMessage": null,
  "scheduledAt": "2026-06-10T09:00:00Z"
}
```

**用途:** フロントエンドがポーリングでジョブ完了を確認

### 3-3. DELETE /api/proposals/:id/email-jobs/:jobId

**条件:**
- `status: SCHEDULED` のジョブのみ削除可能（送信前の取消）
- `SENDING` 以降は削除不可

---

## 4. フロントエンド UI フロー

### 4-1. 提案詳細モーダル

```
モーダルヘッダー: [人材名] [案件名]
...既存コンテンツ...
...フッター...
[メール送信ボタン]
  ↓
メール生成・送信モーダルが開く
  状態1（生成中）:
    - 「メール文章を生成中...」（ローディングスピナー）
  
  状態2（生成完了）:
    - メール本文プレビュー表示
    - 「今すぐ送信」ボタン
    - 「スケジュール指定」チェックボックス
    
  状態3（スケジュール指定選択時）:
    - 日時ピッカー表示
    - 「送信」ボタン
  
  状態4（送信中/完了）:
    - ✅ 送信完了通知
    - モーダル自動閉じる（2秒後）
```

### 4-2. 提案一覧

```
テーブル行:
[提案] [クライアント] [人材] [状態] [操作]

操作カラム:
- [メール送信ボタン]
  ↓ クリック時、詳細モーダルと同じフロー
```

### 4-3. ジョブ状態表示

- ⏳ 生成中（GENERATING）
- 📧 送信中（SENDING）
- ✅ 送信済み（SENT）
- ❌ 失敗（FAILED）
- 📅 スケジュール済み（SCHEDULED） → 「2026-06-10 09:00 に送信予定」

---

## 5. メール生成ロジック

### 5-1. 入力データ

```typescript
{
  proposal: {
    id: string,
    title: string,
    client: string,
    amount: number,
    startDate: Date
  },
  contract: {
    unitPrice: number,
    costPrice: number,
    grossProfitRate: number,
    status: string
  },
  talent: {
    name: string,
    email: string,
    skills: string[],
    experience: string,
    cv: string  // 経歴書テキスト
  }
}
```

### 5-2. Claude Haiku API 呼び出し

**モデル:** `claude-3-5-haiku-20241022`

**プロンプト（日本語）:**

```
以下の情報をもとに、提案メール本文を生成してください。
メールは営業担当者がクライアントに送るものです。

【提案情報】
- 案件名：{proposal.title}
- クライアント：{proposal.client}
- 提案人材：{talent.name}
- スキル：{talent.skills.join(', ')}
- 経験：{talent.experience}

【契約条件】
- 契約売値：{contract.unitPrice}万円
- 契約開始日：{proposal.startDate}

メール本文は以下の構成で作成してください：
1. 挨拶
2. 提案人材の紹介（スキル・経験を活かした説明）
3. 契約条件の確認
4. 経歴書添付の案内
5. 締めくくり

【指定:**
- トーン：ビジネスライク、誠実、簡潔
- 言語：日本語
- 文字数：300〜500字程度
```

**出力:** メール本文（plain text）

---

## 6. スケジュール送信機構

### 6-1. Cron ジョブ実装

```typescript
// src/jobs/email-scheduler.ts
// 毎分実行
schedule.scheduleJob('* * * * *', async () => {
  // status: SCHEDULED で scheduledAt が現在時刻を過ぎたジョブ
  const jobs = await db.emailJob.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() }
    },
    include: { proposal: { include: { talent: true } } }
  })

  for (const job of jobs) {
    try {
      // メール送信処理
      await sendEmail({
        to: job.proposal.client.email,
        subject: `【提案】${job.proposal.title}`,
        body: job.generatedContent,
        attachments: [job.attachmentPath]
      })
      
      // ジョブ更新
      await db.emailJob.update({
        where: { id: job.id },
        data: { status: 'SENT', sentAt: new Date() }
      })
    } catch (error) {
      // 失敗時：3回までリトライ
      await updateJobWithRetry(job.id, error)
    }
  }
})
```

### 6-2. リトライ戦略

- 初回失敗 → 1分後にリトライ
- 2回目失敗 → 5分後にリトライ
- 3回目失敗 → 通知・手動対応
- 最大3回リトライ後は `FAILED` → ユーザーに通知

---

## 7. エラーハンドリング

| シナリオ | ステータス | 対応 |
|---------|-----------|------|
| Claude API 失敗 | FAILED | ユーザー通知、手動リトライ可能 |
| メール送信失敗（SMTP） | FAILED | 最大3回自動リトライ後、通知 |
| 経歴書ファイル取得失敗 | SENDING | メール本文のみ送信、ファイル情報をエラーログに記録 |
| スケジュール時刻が過去 | — | バリデーションエラー、リクエスト段階で拒否 |

---

## 8. セキュリティ & 監査

### 8-1. アクセス制御
- メール送信ジョブ作成：提案の所有者のみ
- ジョブ状態取得：提案へのアクセス権を確認

### 8-2. データ保護
- `EmailJob.generatedContent` は暗号化保存（PII 含む）
- ログ：送信先メールアドレスは末尾3文字マスク記録

### 8-3. 監査ログ
- すべてのメール送信を `EmailJob` に記録
- 送信失敗時は Slack 通知（オプション）

---

## 9. 実装ファイル構成

```
src/app/api/
  proposals/:id/
    send-email/
      route.ts                   ← ジョブ作成 API
    email-jobs/
      [jobId]/
        route.ts                 ← ジョブ状態取得・削除 API

src/lib/
  email-generator.ts             ← Claude Haiku 統合
  email-sender.ts                ← SMTP 送信
  email-encryptor.ts             ← メール内容の暗号化/復号

src/jobs/
  email-scheduler.ts             ← Cron ジョブ

src/components/
  proposals/
    EmailSendModal.tsx            ← メール生成・送信 UI モーダル

database/
  migrations/
    YYYYMMDDHHMMSS_add_email_job.sql  ← DB スキーマ
```

---

## 10. スコープ外

- メールテンプレートの管理画面
- メール配信完了の自動確認（SMTPレシート）
- 複数メール一括送信
- メール内容の A/B テスト

---

## 11. 成功基準

- ✅ 「メール送信」ボタンで非同期ジョブ作成
- ✅ Claude Haiku でメール文章自動生成（提案・契約・人材情報を統合）
- ✅ 経歴書 PDF 自動添付
- ✅ 「今すぐ」「スケジュール指定」の選択肢
- ✅ Cron ジョブでスケジュール送信実行
- ✅ ポーリングでジョブ状態をリアルタイム表示
- ✅ 送信履歴・エラーログ完全記録
