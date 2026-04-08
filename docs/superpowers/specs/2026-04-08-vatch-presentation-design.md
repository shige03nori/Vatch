# Vatch 営業用プレゼンテーション 設計書

## 目的

見込み客に Vatch の機能・画面を紹介するための HTML プレゼンテーション資料を自動生成する。

## 出力物

- `presentation/vatch-presentation.html` — キーボード操作で切り替えられる HTML スライド
- `presentation/screenshots/` — 各画面のスクリーンショット（PNG）

## 実装ステップ

### Step 1: テストデータ投入

`prisma/seed.ts` は既に実装済みで、以下のデータが定義されている。`npx prisma db seed` を実行するだけでよい。

**既存シードデータ概要**
- ユーザー 3名（admin: s.nita@vicent.co.jp、STAFF×2）
- 案件 12件（EC、基幹、AI、IoT など多彩な業種）
- 人材 多数（Java、Python、Swift 等スキルバラエティあり）
- マッチング・提案・契約・メール データ含む

### Step 2: Playwright スクリーンショット撮影

`scripts/capture-screenshots.ts` を作成し以下を実装する。

1. Playwright でブラウザを起動
2. ログインページで seed ユーザー（admin）として認証
3. 各画面に遷移してスクリーンショットを撮影
4. `presentation/screenshots/{page-name}.png` に保存

**撮影対象（12画面）**

| ファイル名 | URL | 画面タイトル |
|-----------|-----|------------|
| dashboard.png | /dashboard | ダッシュボード |
| cases.png | /cases | 案件管理 |
| talents.png | /talents | 人材管理 |
| matching.png | /matching | マッチング |
| proposals.png | /proposals | 提案管理 |
| contracts.png | /contracts | 契約管理 |
| sales.png | /sales | 営業管理（パイプライン） |
| progress.png | /progress | 営業進捗 |
| emails.png | /emails | メール管理 |
| overview.png | /overview | 概要 |
| settings.png | /settings | 設定 |
| email-sources.png | /settings/email-sources | メールソース設定 |

解像度: 1440×900（Retina スケール1倍）

### Step 3: HTML プレゼンテーション生成

`scripts/generate-presentation.ts` を作成し以下を実装する。

**スライド構成**

1. **表紙** — "Vatch" タイトル、キャッチコピー「ITエンジニア案件・人材マッチング管理システム」
2. **システム概要** — メール取り込み→人材登録→案件登録→AI マッチング→提案→契約 のフロー図
3. **各画面スライド（12枚）** — 左60%にスクリーンショット、右40%に機能箇条書き
4. **まとめ** — 主要メリット3点

**各画面の機能説明（右カラム）**

| 画面 | 機能箇条書き |
|------|------------|
| ダッシュボード | 稼働中案件数・人材数・提案数を一覧 / 今月のKPI表示 / 最近のアクティビティ |
| 案件管理 | 案件の登録・編集・削除 / スキル・単価・稼働スタイルで絞り込み / 担当者アサイン |
| 人材管理 | 人材の登録・編集・削除 / スキル・経験年数・ステータスで絞り込み / 経歴書アップロード |
| マッチング | AI による案件×人材の自動スコアリング / スコア・粗利率でソート / 提案メール自動生成 |
| 提案管理 | 提案ステータス管理（DRAFT→SENT→REPLIED） / メール本文プレビュー / 返答記録 |
| 契約管理 | 契約の登録・終了日管理 / 稼働中・終了予定の一覧 / 粗利集計 |
| 営業管理 | パイプライン全体をかんばん形式で管理 / ステータス別件数・金額表示 |
| 営業進捗 | 月別提案数・成約数・粗利グラフ / KPI（前月比）表示 / 担当者別実績 |
| メール管理 | IMAP 自動取り込み / メールから案件・人材を自動解析 / 未処理メール一覧 |
| 概要 | 全体サマリー / 直近アクティビティ |
| 設定 | ユーザー管理 / システム設定 |
| メールソース設定 | IMAP サーバー設定 / 自動取り込みスケジュール |

**ナビゲーション**
- 左右矢印キー / クリックでスライド切替
- スライド番号表示（右下）
- プログレスバー（上部）

**スタイル**
- ダークテーマ（Vatch のデザインに合わせて #0f0f0f 背景）
- アクセントカラー: cyan (#22d3ee)

## 技術仕様

- テストデータ投入: `npx prisma db seed`（`prisma/seed.ts` は既存、既に豊富なデータ定義済み）
- スクリーンショット撮影: `npx ts-node --project tsconfig.json scripts/capture-screenshots.ts`
- プレゼンテーション生成: Node.js スクリプト（`scripts/generate-presentation.js`）
- Playwright: `@playwright/test` を devDependencies に追加し `npx playwright install chromium` でブラウザをインストール
- ログイン: Credentials プロバイダー（パスワード検証なし）でメールアドレス `s.nita@vicent.co.jp` を使用

## 前提条件

- `flyctl proxy 5432 -a vatch-db` が起動中であること
- `npm run dev` (localhost:3000) が起動中であること
- `.env.local` に有効な `DATABASE_URL` が設定されていること
