# 設計書: 提案メール送信時の経歴書添付ロジック

**日付**: 2026-04-17  
**ステータス**: 承認済み

---

## 概要

提案メール送信API（`/api/emails/send`）を改修し、Proposal IDを受け取って必要な情報をDBから取得・送信する形に変更する。`Talent.resumeKey` が存在する場合はファイルを読み込んで添付情報をログ出力する（メール送信は引き続きconsole.logスタブ）。送信後は `Proposal.status`・`Proposal.sentAt`・`Matching.status` をDBに反映する。

---

## スコープ

### 対象

- `src/app/api/emails/send/route.ts` の改修

### スコープ外

- 実際のSMTP/Gmail API送信（別タスク）
- 経歴書ダウンロード/プレビューUI
- S3ストレージ実装

---

## APIエンドポイント

### `POST /api/emails/send`

**リクエスト変更前:**
```ts
{ to: string; cc?: string; subject: string; bodyText: string }
```

**リクエスト変更後:**
```ts
{ proposalId: string }  // CUID形式
```

**バリデーション（Zod）:**
```ts
const SendEmailSchema = z.object({
  proposalId: z.string().cuid(),
})
```

---

## 処理フロー

```
POST /api/emails/send { proposalId }
  1. 認証チェック（requireAuth）
  2. SendEmailSchema でバリデーション → 失敗時 422
  3. Proposal を DB から取得（matching.case, matching.talent をinclude）
     → not found 時 404
  4. 権限チェック（isAdmin または matching.case.assignedUserId === session.user.id）
     → 不一致時 403
  5. talent.resumeKey がある場合:
     a. getFileStorage().getUrl(resumeKey) でファイルパスを取得
     b. fs.readFile() でバッファ読み込み
     c. 失敗した場合: 警告ログのみ、添付なしで続行
  6. console.log でメール内容を出力（to/cc/subject/bodyText + 添付ファイル名）
  7. Proposal を更新: status = SENT, sentAt = new Date()
  8. Matching を更新: status = SENT
  9. { sent: true } を返却
```

---

## エラーハンドリング

| シナリオ | 挙動 |
|---------|------|
| `proposalId` が不正形式 | 422 Unprocessable Entity |
| Proposal not found | 404 Not Found |
| 権限なし（他人のProposal） | 403 Forbidden |
| `resumeKey` あり・ファイル読み取り失敗 | 警告ログのみ、添付なしで送信続行 |
| DB更新失敗 | 500 Internal Server Error |

経歴書ファイルの読み取り失敗は非クリティカルとして扱う（`email-ingestion.ts` と同方針）。

---

## DB更新

送信成功後（console.log出力後）に以下を更新する：

```ts
await Promise.all([
  prisma.proposal.update({
    where: { id: proposalId },
    data: { status: 'SENT', sentAt: new Date() },
  }),
  prisma.matching.update({
    where: { id: proposal.matchingId },
    data: { status: 'SENT' },
  }),
])
```

---

## テスト方針

`src/app/api/emails/__tests__/route.test.ts` に以下のケースを追加：

| ケース | 期待結果 |
|--------|---------|
| 正常系・経歴書あり | `sent: true`、Proposal/Matching が SENT に更新、ログに添付ファイル名 |
| 正常系・経歴書なし | `sent: true`、Proposal/Matching が SENT に更新 |
| 正常系・ファイル読み取り失敗 | `sent: true`（添付なしで継続）、警告ログ出力 |
| Proposal not found | 404 |
| 権限なし（他人のProposal） | 403 |
| `proposalId` が不正形式 | 422 |
