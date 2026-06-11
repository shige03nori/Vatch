# Vatch プロジェクト ガイドライン

## プロジェクト概要

SES/人材紹介会社向けの営業支援 SaaS。メールを自動取込・AI 解析して人材・案件を登録し、マッチング〜提案メール送信〜営業管理までを一元管理する。

### 技術スタック

| 分類 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) / React 19 / TypeScript |
| スタイリング | Tailwind CSS |
| DB | PostgreSQL + Prisma ORM |
| 認証 | NextAuth v5 |
| AI | Anthropic Claude API（メール解析・提案文生成） |
| メール送受信 | nodemailer（送信）/ imap-simple（受信） |
| テスト | Jest / Playwright |
| デプロイ | Fly.io（本番: `vatch` / ステージング: `vatch-staging`） |

---

## よく使うコマンド

### 開発

```bash
npm run dev          # 開発サーバー起動（localhost:3000）
npm run build        # 本番ビルド
npm test             # テスト実行（Jest）
npm run lint         # ESLint
```

### DB 操作

```bash
npm run db:migrate   # マイグレーション実行（開発用）
npm run db:generate  # Prisma Client 再生成
npm run db:seed      # シードデータ投入
npm run db:studio    # Prisma Studio（ブラウザで DB 確認）
npm run db:reset     # DB リセット（開発用）
```

### デプロイ

```bash
fly deploy --config fly.staging.toml   # ステージングへデプロイ
fly deploy                              # 本番へデプロイ
```

ステージングは deploy 時に migrate + seed が自動実行される。本番は migrate のみ。

---

## 実装状況

> この節はすべての変更が ClaudeCode 経由で行われるため、ソースを読み直さずに現状を把握するために維持する。
> 実装が完了・変更されたタイミングで必ずこの節を更新すること。

### 機能一覧

| 機能 | 状態 | 備考 |
|------|------|------|
| メール取込（IMAP → AI解析 → 人材/案件登録） | ✅ 完了 | 複数フォルダ対応・UNSEEN制限撤廃(SINCE 3日)・markSeen:false・Re:メール除外 |
| 経歴書ファイル保存（PDF/DOCX） | ✅ 完了 | `Talent.resumeKey / resumeFilename` |
| DOCX経歴書 → AI自動抽出 | ✅ 完了 | `/api/proper/extract` |
| AIマッチング自動生成 | ✅ 完了 | スコアリング・自動送信候補フラグ |
| 提案メール文章生成（AI） | ✅ 完了 | Claude Haiku で生成 |
| 提案メール送信（NOW/SCHEDULED） | ✅ 完了 | `sendEmail()` 実装済み。経歴書テキスト(mammoth)もプロンプトに渡す |
| 提案メール送信時の経歴書添付 | ✅ 完了 | `getLocalPath()` でパス解決・存在確認後に添付 |
| メール自動スケジュール送信（Cron） | ✅ 完了 | Cron ジョブ実装済み。sendEmail() 実装完了で有効化 |
| 案件管理 | ✅ 完了 | CRUD・検索・ステータス管理 |
| 人材管理 | ✅ 完了 | CRUD・検索・ステータス管理 |
| 正社員管理（proper） | ✅ 完了 | 一覧・登録・編集・パスワードリセット |
| 契約管理 | ✅ 完了 | CRUD・月別サマリー・残日数アラート |
| 営業パイプライン | ✅ 完了 | ステージ管理・商談メモ・契約紐付け |
| 営業進捗ダッシュボード | ✅ 完了 | KPI・月別推移・担当者別実績 |
| メールソース設定（IMAP設定） | ✅ 完了 | 複数フォルダ管理UI追加（`imapFolders` フィールド・タグ形式で編集可） |

### 残課題（TODO）

| 課題 | 場所 | 優先度 |
|------|------|--------|
| ~~`sendEmail()` 呼び出しのコメントアウトを外す~~ | ✅ 完了 (c053879) | - |
| ~~`Talent.cv` テキストをメール生成プロンプトに渡す~~ | ✅ 完了 (c053879) | - |
| 返信メールの自動解析 | ✅ 完了 | Re:件名+送信先マッチ→AI分類→ステータス自動更新 |
| AI精度フィードバック学習 | 未実装（スコープ外） | 低 |
| 売上予測・レポート | ✅ 完了 | 進捗ページに今後3ヶ月予測セクション追加 |
| メール取込期間を設定画面から変更できるようにする | `EmailSource` テーブルに `fetchDays` フィールド追加 → メール取込設定画面でUI提供。現状は `email-fetcher.ts` に `3` がハードコード | 中 |

---

## MCP ツール

以下の MCP が利用可能。積極的に活用すること。

### GitHub MCP（`mcp__github__*`）

- リポジトリ: `shige03nori/Vatch`
- Issue の作成・参照・更新、PR の作成・レビュー・マージ、ファイルの取得・プッシュなどが可能
- コード変更を GitHub に反映する際や Issue 管理には Bash の `git` / `gh` コマンドではなく MCP を優先する

### PostgreSQL MCP（`mcp__postgres__query`）

- 接続先: Vatch の PostgreSQL DB（PostgreSQL 15.17）
- 読み取り専用クエリのみ実行可能
- DB の現状確認・デバッグ・データ検証に使う（書き込みは Prisma 経由で行う）

---

## ブランチ運用

マージは必ず以下の順番で行う:

```
develop → staging → master
```

- `develop` から直接 `master` にマージしない
- `develop` → `staging` → `master` の順番を厳守する
