# 提案メール送信時の経歴書添付 — 設計書

## 概要

提案メール送信時に、Talent の経歴書ファイル（PDF/DOCX）をメールに添付する。
経歴書が存在しない場合はエラーにせず、添付なしでメールを送信する。

## 変更ファイル

`src/app/api/proposals/[id]/send-email/route.ts` のみ

## 変更内容

### 1. インポート追加

```ts
import { getFileStorage } from '@/lib/file-storage'
import fs from 'fs'
```

### 2. `startDate` の修正

`processEmailJob` 内のメール生成パラメータで、現在日時のハードコードをやめ Case の実際の開始日を使う。

```ts
// Before
startDate: new Date(), // TODO: Case.startDate から取得

// After
startDate: proposal.matching.case.startDate,
```

### 3. `attachmentPath` の解決

```ts
// Before
const attachmentPath = null  // dummy、実装は別タスク

// After
const resumeKey = proposal.matching.talent.resumeKey
let attachmentPath: string | null = null
if (resumeKey) {
  const resolvedPath = getFileStorage().getUrl(resumeKey)
  if (fs.existsSync(resolvedPath)) {
    attachmentPath = resolvedPath
  }
}
```

## データフロー

```
Talent.resumeKey
  └─ getFileStorage().getUrl(key) → ローカルファイルパス
       └─ fs.existsSync() → 存在確認
            ├─ true  → attachmentPath = resolvedPath（nodemailer が添付）
            └─ false → attachmentPath = null（添付なしで送信）
```

## 既存コードとの関係

- `email-sender.ts` の `sendEmail({ attachmentPath })` は変更不要。`attachmentPath` が null の場合は添付なし、パスがあれば自動で添付する実装済み。
- `EmailJob.attachmentPath` フィールドへの保存コードは既存のまま活用。
- `Talent.cv` テキストフィールドはスキーマに存在しないため、メール生成への `cv: ''` は空文字のまま維持。

## エラーハンドリング

- `resumeKey` が null → 添付なしで送信（既存動作と同じ）
- ファイルが存在しない → 添付なしで送信（`fs.existsSync` でフォールバック）
- ファイルパス取得は try/catch 不要（`getUrl` は同期・例外なし）

## 対象外

- `Talent.cv` テキストフィールドの追加（スキーマ変更を伴うため別タスク）
- S3 等の外部ストレージへの対応（`STORAGE_BACKEND` 拡張は既存設計で対応済み）
