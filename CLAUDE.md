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

## ブランチ運用

マージは必ず以下の順番で行う:

```
develop → staging → master
```

- `develop` から直接 `master` にマージしない
- `develop` → `staging` → `master` の順番を厳守する
