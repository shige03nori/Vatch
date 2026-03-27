# 設計書: メール添付ファイル（経歴書）保存機能

**日付**: 2026-03-27
**ステータス**: 承認済み

---

## 概要

SES営業メールの取込時に添付されている経歴書・レジュメ（PDF / DOCX）を保存し、後の提案メール送信時に再利用できるようにする。添付ファイルからの情報抽出は行わない。

---

## 要件

- 対応フォーマット: PDF (`.pdf`) / Word (`.docx`)
- `Talent` 1レコードにつき1ファイル（`resumeKey` は作成時に1度だけセット）
- ストレージはローカル（開発）と S3（本番）を `STORAGE_BACKEND` 環境変数で切り替え可能
- ファイル保存失敗時も Talent 登録自体は成功させる（非クリティカル）
- ファイルサイズ上限: 10 MB（超過は警告ログのみ、保存しない）

### 「上書き」に関する補足

現在の取込フローでは `Talent.sourceEmailId` に `@unique` 制約があるため、メール1通につき Talent レコードが1件作成される。よって「上書き」は実運用上発生しない（同一人物の新しいメールは新しい Talent レコードになる）。`Talent` モデルに `resumeKey` フィールドを追加するが、更新ロジックは不要。

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

export function getFileStorage(): StorageBackend { ... }
```

| 実装 | 保存先 | 条件 |
|------|--------|------|
| LocalStorage | `./uploads/resumes/` | `STORAGE_BACKEND=local`（デフォルト） |
| S3Storage | AWS S3 バケット | `STORAGE_BACKEND=s3`（将来実装） |

- キー形式: `resumes/<talentId>-<timestamp>.<ext>`（`talentId` は `prisma.talent.create()` が返す Cuid）
- ローカルの保存先は `public/` 外（直接公開しない）
- ローカルのベースディレクトリは `path.join(process.cwd(), 'uploads', 'resumes')`（`process.cwd()` = Next.js 起動時のプロジェクトルート）
- `save()` 時に `fs.mkdir(baseDir, { recursive: true })` でディレクトリを自動作成
- `getUrl()` の返り値は今回のスコープでは使用しない（提案メール送信機能で利用予定）

### 変更ファイル

#### `src/lib/email-fetcher.ts`

`FetchedEmail` 型に添付ファイルを追加：

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

添付ファイルの抽出条件（いずれかを満たすもの）:
1. `contentType` が `application/pdf` → PDF として採用
2. `contentType` が `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → DOCX として採用
3. `contentType` が `application/octet-stream` または `application/zip` かつファイル名が `.docx` で終わる → DOCX として採用（MUAによっては DOCX を octet-stream で送るため）

上記以外の contentType は無視する。

`fetchOptions` の `bodies` は既存の `['HEADER', 'TEXT', '']` のまま（`''` で全体を取得するため `mailparser` が添付ファイルを含むマルチパートを正しく解析できる）。

#### `src/lib/email-ingestion.ts`

Talent 作成時の処理に添付ファイル保存を追加：

```
type === TALENT && parsed.talent の場合:
  1. Talent を DB に作成（resumeKey=null, resumeFilename=null で）
     → createdTalent.id (Cuid) を取得
  2. fetched.attachments から mailparser パース順で先頭の PDF/DOCX 1件を取得
  3. ファイルがあり、かつサイズが 10MB 以下の場合:
     a. key = `resumes/${createdTalent.id}-${Date.now()}.${ext}`
     b. fileStorage.save(key, buffer)  ← 失敗した場合はステップ4へ
     c. prisma.talent.update({ resumeKey: key, resumeFilename: filename })
        ← 失敗した場合: fileStorage.delete(key) をベストエフォートで実行後、エラーログ
  4. サイズ超過時 or ファイル保存失敗時: エラー/警告ログのみ、Talent 登録は維持（resumeKey=null）
```

- 複数添付がある場合は `mailparser` のパース順で先頭の PDF/DOCX 1件のみ採用（PDF と DOCX の優先順位は設けない）
- CASE メールの添付は無視

---

## データフロー

```
IMAP受信
  └─ email-fetcher: bodyText + attachments[] を取得
       └─ email-ingestion: AI解析（本文のみ）
            └─ type=TALENT の場合:
                 ├─ Talent 作成（resumeKey=null）
                 └─ PDF/DOCX attachment あり && サイズ ≤ 10MB？
                      ├─ YES: file-storage.save() → Talent.resumeKey/resumeFilename 更新
                      └─ NO:  resumeKey = null のまま
```

---

## エラーハンドリング

| シナリオ | 挙動 |
|---------|------|
| ファイル保存失敗 | エラーログ出力、Talent 登録は成功扱い（resumeKey=null） |
| DB更新失敗（resumeKey の update）| ファイルを `delete()` でベストエフォート削除後エラーログ、Talent 登録は成功扱い |
| サポート外フォーマット | 無視（添付なし扱い） |
| ファイルサイズ > 10MB | 警告ログ、保存しない |
| 添付が複数ある | mailparser パース順で先頭の PDF/DOCX 1件のみ採用 |
| CASE メールに添付あり | 無視 |
| `uploads/resumes/` ディレクトリ未存在 | `save()` 内で自動作成（`mkdir recursive`） |
| `contentType=octet-stream` で拡張子 `.docx` | DOCX として採用 |

---

## スコープ外

- 添付ファイルからの情報抽出（AIパース）
- 提案メール送信時の添付ロジック（別途実装）
- 経歴書のプレビュー / ダウンロードUI（`/api/resumes/<key>` APIルートも含む）
- S3 実装（ローカル実装のみ今回対象）

---

## テスト方針

- `email-fetcher.ts`: PDF / DOCX 添付の抽出を単体テスト（contentType 正常系・octet-stream フォールバック・サポート外フォーマットの除外）
- `file-storage.ts`: LocalStorage の save/getUrl/delete を単体テスト（ディレクトリ未存在からの初回 save を含む）
- `email-ingestion.ts`: 以下のケースを統合テスト（DB + ファイルシステムをモック）
  - 添付あり（PDF）: Talent 作成 + resumeKey セット
  - 添付あり（DOCX、octet-stream）: Talent 作成 + resumeKey セット
  - 添付なし: Talent 作成 + resumeKey = null
  - ファイルサイズ超過: Talent 作成 + resumeKey = null + 警告ログ
  - ファイル保存失敗: Talent 作成成功 + resumeKey = null + エラーログ
  - DB更新失敗: ファイル削除（ベストエフォート）+ Talent 作成成功 + resumeKey = null + エラーログ
  - CASE メール + 添付あり: 添付無視
