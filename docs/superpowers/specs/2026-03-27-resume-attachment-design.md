# 設計書: メール添付ファイル（経歴書）保存機能

**日付**: 2026-03-27
**ステータス**: 承認済み

---

## 概要

SES営業メールの取込時に添付されている経歴書・レジュメ（PDF / DOCX）を保存し、後の提案メール送信時に再利用できるようにする。添付ファイルからの情報抽出は行わない。

---

## 要件

- 対応フォーマット: PDF (`.pdf`) / Word (`.docx`)
- 人材1人につき最新の1ファイルのみ保持（新しいメールで上書き）
- ストレージはローカル（開発）と S3（本番）を `STORAGE_BACKEND` 環境変数で切り替え可能
- ファイル保存失敗時も Talent 登録自体は成功させる（非クリティカル）

---

## データモデル変更

### `Talent` モデルに2フィールドを追加

```prisma
model Talent {
  // 既存フィールド省略
  resumeKey      String?  // ストレージキー例: resumes/cuid-1711500000000.pdf
  resumeFilename String?  // 元ファイル名例: 田中太郎_経歴書.pdf
}
```

- `resumeKey === null` → 経歴書なし
- 既存 Talent への影響なし（nullable）

### マイグレーション

```sql
ALTER TABLE "Talent" ADD COLUMN "resumeKey" TEXT;
ALTER TABLE "Talent" ADD COLUMN "resumeFilename" TEXT;
```

---

## アーキテクチャ

### 新規ファイル

#### `src/lib/file-storage.ts`

ストレージ抽象レイヤー。環境変数 `STORAGE_BACKEND` で実装を切り替える。

```typescript
type StorageBackend = {
  save(key: string, buffer: Buffer): Promise<void>
  getUrl(key: string): string
  delete(key: string): Promise<void>
}
```

| 実装 | 保存先 | 条件 |
|------|--------|------|
| LocalStorage | `./uploads/resumes/` | `STORAGE_BACKEND=local`（デフォルト） |
| S3Storage | AWS S3 バケット | `STORAGE_BACKEND=s3` |

- キー形式: `resumes/<cuid>-<timestamp>.<ext>`
- ローカルのファイルは `public/` 外に配置（直接公開しない）
- ローカルの `getUrl` は `/api/resumes/<key>` 形式のAPIルートを想定

### 変更ファイル

#### `src/lib/email-fetcher.ts`

`FetchedEmail` 型に添付ファイル配列を追加：

```typescript
type FetchedEmail = {
  messageId: string | null
  from: string
  fromEmail: string
  subject: string
  bodyText: string
  receivedAt: Date
  attachments: {
    filename: string
    content: Buffer
    contentType: string
  }[]
}
```

- `mailparser` の `parsed.attachments` から PDF / DOCX のみ抽出
- `contentType` で判定: `application/pdf` / `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- 添付なしの場合は空配列 `[]`

#### `src/lib/email-ingestion.ts`

Talent 作成時の処理に添付ファイル保存を追加：

```
type === TALENT && parsed.talent の場合:
  1. Talent をDBに作成（resumeKey=null で）
  2. attachments から最初の PDF/DOCX を取得
  3. ファイルがあれば:
     a. key = `resumes/${talent.id}-${Date.now()}.${ext}`
     b. fileStorage.save(key, buffer)
     c. Talent.resumeKey / resumeFilename を更新
  4. ファイル保存失敗はログのみ（Talent登録は維持）
```

- 複数添付がある場合は先頭1件のみ採用
- CASE メールの添付は無視

---

## データフロー

```
IMAP受信
  └─ email-fetcher: bodyText + attachments[] を取得
       └─ email-ingestion: AI解析（本文のみ）
            └─ type=TALENT の場合:
                 ├─ Talent 作成
                 └─ attachment あり？
                      ├─ YES: file-storage.save() → Talent.resumeKey 更新
                      └─ NO:  Talent.resumeKey = null のまま
```

---

## エラーハンドリング

| シナリオ | 挙動 |
|---------|------|
| ファイル保存失敗 | エラーログ出力、Talent 登録は成功扱い |
| サポート外フォーマット | 無視（添付なし扱い） |
| 添付が複数ある | 先頭の PDF/DOCX 1件のみ採用 |
| CASE メールに添付あり | 無視 |

---

## スコープ外

- 添付ファイルからの情報抽出（AIパース）
- 提案メール送信時の添付ロジック（別途実装）
- 経歴書のプレビュー / ダウンロードUI
- S3 実装（ローカル実装のみ今回対象）

---

## テスト方針

- `email-fetcher.ts`: PDF / DOCX 添付の抽出を単体テスト
- `file-storage.ts`: LocalStorage の save/getUrl/delete を単体テスト
- `email-ingestion.ts`: 添付あり・なし両ケースの統合テスト（DB + ファイルシステムをモック）
