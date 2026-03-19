# メール取込・AI解析・DB自動登録 設計ドキュメント

**作成日**: 2026-03-20
**対象フェーズ**: Phase 2 中核機能
**ステータス**: 承認済み

---

## 概要

特定のメールアドレスから受信したメールの本文をClaude APIで解析し、案件（Case）または人材（Talent）情報を抽出してDBに自動登録する機能を実装する。

UIは既存の `/emails` ページが存在するが、静的ダミーデータを使用しているため、実際のDB連携に切り替える。

---

## 全体アーキテクチャ

```
[fly.io cron / node-cron] ──HTTP POST→ /api/emails/fetch
                                              │
[UIボタン「今すぐ取込」] ──HTTP POST→ /api/emails/fetch
                                              │
                              ① EmailSource テーブルから
                                 取込対象アドレス一覧を取得（isActive=true）
                                              │
                              ② IMAP接続（imap-simple）
                                 各アカウントの未読メールを取得
                                              │
                              ③ Email レコードを PENDING で DB 保存
                                 （重複チェック：同件名+同送信元+同日は除外）
                                              │
                              ④ Claude API で本文解析（1リクエスト）
                                 - 種別判定（CASE / TALENT / UNKNOWN）
                                 - 構造化情報抽出
                                 - Email status を PARSING に更新
                                              │
                              ⑤ Case or Talent レコードを DB 作成
                                 Email の status を PARSED に更新
                                 （UNKNOWN の場合はスキップ、ERROR は status=ERROR）
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
  email     String   @unique    // 取込対象のメールアドレス（フィルタ用）
  isActive  Boolean  @default(true)

  // IMAP接続設定
  imapHost  String
  imapPort  Int      @default(993)
  imapUser  String
  imapPass  String   // 本番では環境変数または暗号化推奨

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 既存モデル変更

なし。Email・Case・Talentのスキーマはそのまま使用。

---

## 新規パッケージ

| パッケージ | 用途 |
|---|---|
| `imap-simple` | IMAP接続・メール取得 |
| `mailparser` | メール本文のパース（RFC2822→テキスト） |
| `@anthropic-ai/sdk` | Claude API呼び出し |
| `node-cron` | 定期実行（サーバー起動時に登録） |

---

## AI解析ロジック

### Claude APIへのリクエスト

メール本文を1回のAPI呼び出しで解析し、以下のJSONを期待する：

```json
{
  "type": "CASE" | "TALENT" | "UNKNOWN",
  "confidence": 0-100,
  "extractedName": "案件名 or 人材名",
  "skills": ["スキル1", "スキル2"],

  "case": {
    "title": "",
    "client": "",
    "clientEmail": "",
    "unitPrice": 0,
    "startDate": "2026-04-01T00:00:00Z",
    "workStyle": "REMOTE" | "ONSITE" | "HYBRID"
  },

  "talent": {
    "name": "",
    "experience": 0,
    "desiredRate": 0,
    "location": "",
    "workStyle": "REMOTE" | "ONSITE" | "HYBRID"
  }
}
```

`case` / `talent` は `type` に対応するものだけ返す。

### エラーハンドリング

| 状況 | 処理 |
|---|---|
| JSONパース失敗 | Email.status = ERROR、Case/Talent作成しない |
| type = UNKNOWN | Email.status = PARSED（ただしCase/Talent作成しない） |
| Claude APIタイムアウト・エラー | Email.status = ERROR |
| 必須フィールド欠損 | 可能な限りデフォルト値で補完、不可能なら ERROR |

### assignedUserId の決定

DBからADMINロールの最初のユーザー（`createdAt` 昇順）を取得して割り当て。

---

## APIエンドポイント

### 既存エンドポイント

| エンドポイント | メソッド | 変更内容 |
|---|---|---|
| `/api/emails` | GET | 変更なし（DB連携済み） |

### 新規エンドポイント

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/api/emails/fetch` | POST | ADMIN | メール取込実行 |
| `/api/email-sources` | GET | STAFF以上 | 取込対象アドレス一覧 |
| `/api/email-sources` | POST | ADMIN | 追加 |
| `/api/email-sources/[id]` | PATCH | ADMIN | 更新・有効/無効切替 |
| `/api/email-sources/[id]` | DELETE | ADMIN | 削除 |

---

## ファイル構成

### 新規作成

```
src/
  lib/
    email-fetcher.ts       # IMAP接続・メール取得ロジック
    email-parser.ts        # Claude API解析ロジック
    email-ingestion.ts     # 取込フロー全体のオーケストレーター
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
src/server.ts (or similar)        # node-cron の登録（Next.js custom server）
fly.toml                          # cron設定（必要に応じて）
prisma/schema.prisma              # EmailSource モデル追加
```

---

## UI変更

### `/emails/page.tsx`

- `@/data/emails` の静的データを削除
- `useEffect` + `fetch('/api/emails')` でDB連携
- 「今すぐ取込」ボタン → `POST /api/emails/fetch` を呼び出し、完了後にリスト再取得

### `/settings/email-sources`（新規）

- EmailSource の一覧表示
- 追加フォーム：ラベル、メールアドレス、IMAPホスト、ポート、ユーザー名、パスワード
- 有効/無効トグル
- 削除ボタン

---

## 定期実行

### 方式：node-cron（Next.js カスタムサーバー）

`server.ts` でNext.jsアプリ起動と同時に `node-cron` を登録し、30分ごとに `/api/emails/fetch` を内部HTTPリクエストで呼び出す。

```
スケジュール: */30 * * * * （30分おき）
```

fly.io の `[services]` または `[processes]` で別途cronジョブを設定することも可能だが、初期実装はnode-cronで統一する。

---

## セキュリティ考慮

- IMAPパスワードはDBに平文保存（初期実装）。本番移行前に環境変数化または暗号化を検討
- `/api/emails/fetch` および EmailSource CRUD は ADMIN のみアクセス可能
- IMAP接続はSSL（ポート993）を使用

---

## テスト方針

- `email-fetcher.ts`: IMAPクライアントをモックしてユニットテスト
- `email-parser.ts`: Claude APIレスポンスをモックしてユニットテスト
- `email-ingestion.ts`: 統合テストでDB書き込みを検証
- `/api/emails/fetch`: 既存のAPIテスト方針に従いrouteテストを追加

---

## 実装スコープ（今回）

1. Prismaスキーマ：`EmailSource` 追加・マイグレーション
2. パッケージ追加：`imap-simple` / `mailparser` / `@anthropic-ai/sdk` / `node-cron`
3. `email-fetcher.ts` 実装
4. `email-parser.ts` 実装
5. `email-ingestion.ts` 実装
6. `/api/emails/fetch` ルート実装
7. `/api/email-sources` CRUD ルート実装
8. `/emails/page.tsx` DB連携切り替え
9. `/settings/email-sources` 管理画面実装
10. node-cron 定期実行設定

---

## 将来拡張

- IMAPパスワードの暗号化保存
- 添付ファイル（PDF・Word）のAI解析（Amazon Textract連携）
- AI解析結果の手動修正UI
- UNKNOWN メールの手動分類UI
- 取込ログの詳細表示
