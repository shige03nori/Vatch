# Vatch 営業用プレゼンテーション 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fly.io DB にテストデータを投入し、全12画面のスクリーンショットを Playwright で撮影して、キーボード操作で切り替えられる HTML プレゼンテーション資料を自動生成する。

**Architecture:** ① `prisma db seed` でテストデータ投入 → ② Playwright スクリプト (`scripts/capture-screenshots.js`) で全12画面を自動撮影（ログイン済み状態） → ③ Node.js スクリプト (`scripts/generate-presentation.js`) で HTML プレゼンテーション生成（スクリーンショットを base64 埋め込みで自己完結）

**Tech Stack:** Playwright (playwright パッケージ、Chromium), Node.js (fs/path/Buffer), Prisma seed (既存)

---

## 前提条件（実行前に確認）

- `flyctl proxy 5432 -a vatch-db` が起動中（別ターミナルで実行中）
- `npm run dev` が http://localhost:3000 で起動中
- `.env.local` の `DATABASE_URL` が `postgresql://postgres:3fXeWWjKY6zPh0v@localhost:5432/vatch?schema=public` になっていること

---

## ファイル構成

| ファイル | 種別 | 役割 |
|---------|------|------|
| `scripts/capture-screenshots.js` | 新規作成 | Playwright でログインし全12画面を撮影 |
| `scripts/generate-presentation.js` | 新規作成 | スクリーンショットを読み込み HTML を生成 |
| `presentation/screenshots/*.png` | 生成物 | 各画面のスクリーンショット（12枚） |
| `presentation/vatch-presentation.html` | 生成物 | キーボード操作可能な HTML スライド |

---

## Task 1: Playwright インストール & テストデータ投入

**Files:**
- Modify: `package.json` (devDependency 追加)

- [ ] **Step 1: Playwright をインストール**

```bash
npm install --save-dev playwright
```

期待出力: `added N packages` が表示される

- [ ] **Step 2: Chromium ブラウザをインストール**

```bash
npx playwright install chromium
```

期待出力: `Chromium X.X.X` がダウンロードされる

- [ ] **Step 3: presentation ディレクトリを作成**

```bash
mkdir -p presentation/screenshots
```

- [ ] **Step 4: テストデータを投入**

```bash
npx prisma db seed
```

期待出力:
```
🌱 シード開始...
✅ シード完了
```

- [ ] **Step 5: ブラウザでデータ確認**

http://localhost:3000/sales にアクセスし、マッチングデータが表示されることを確認する。

---

## Task 2: スクリーンショット撮影スクリプト作成・実行

**Files:**
- Create: `scripts/capture-screenshots.js`

- [ ] **Step 1: スクリプトファイルを作成**

`scripts/capture-screenshots.js` を以下の内容で作成:

```javascript
// scripts/capture-screenshots.js
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:3000'
const OUTPUT_DIR = path.join(__dirname, '..', 'presentation', 'screenshots')
const ADMIN_EMAIL = 's.nita@vicent.co.jp'
const ADMIN_PASSWORD = 'password'

const PAGES = [
  { name: 'dashboard',     url: '/dashboard',             title: 'ダッシュボード' },
  { name: 'cases',         url: '/cases',                 title: '案件管理' },
  { name: 'talents',       url: '/talents',               title: '人材管理' },
  { name: 'matching',      url: '/matching',              title: 'マッチング' },
  { name: 'proposals',     url: '/proposals',             title: '提案管理' },
  { name: 'contracts',     url: '/contracts',             title: '契約管理' },
  { name: 'sales',         url: '/sales',                 title: '営業管理（パイプライン）' },
  { name: 'progress',      url: '/progress',              title: '営業進捗' },
  { name: 'emails',        url: '/emails',                title: 'メール管理' },
  { name: 'overview',      url: '/overview',              title: 'システム概要' },
  { name: 'settings',      url: '/settings',              title: '設定' },
  { name: 'email-sources', url: '/settings/email-sources', title: 'メールソース設定' },
]

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  // ── ログイン ──────────────────────────────────────────
  console.log('ログイン中...')
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })
  console.log('✅ ログイン成功\n')

  // ── 各画面を撮影 ─────────────────────────────────────
  for (const { name, url, title } of PAGES) {
    process.stdout.write(`撮影中: ${title.padEnd(20)} `)
    await page.goto(`${BASE_URL}${url}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800) // アニメーション・データ描画完了待ち
    const outPath = path.join(OUTPUT_DIR, `${name}.png`)
    await page.screenshot({ path: outPath, fullPage: false })
    const size = Math.round(fs.statSync(outPath).size / 1024)
    console.log(`→ ${name}.png (${size}KB)`)
  }

  await browser.close()
  console.log('\n✅ 全スクリーンショット撮影完了！')
  console.log(`   保存先: ${OUTPUT_DIR}`)
}

main().catch(err => {
  console.error('❌ エラー:', err.message)
  process.exit(1)
})
```

- [ ] **Step 2: スクリプトを実行**

```bash
node scripts/capture-screenshots.js
```

期待出力:
```
ログイン中...
✅ ログイン成功

撮影中: ダッシュボード         → dashboard.png (XXX KB)
撮影中: 案件管理               → cases.png (XXX KB)
...（12行）
✅ 全スクリーンショット撮影完了！
```

- [ ] **Step 3: スクリーンショットを目視確認**

```bash
ls -la presentation/screenshots/
```

12ファイルが存在し、それぞれ数十KB以上あることを確認する（0KBや数KBの場合は空白ページになっている）。

---

## Task 3: HTML プレゼンテーション生成スクリプト作成・実行

**Files:**
- Create: `scripts/generate-presentation.js`
- Output: `presentation/vatch-presentation.html`

- [ ] **Step 1: 生成スクリプトを作成**

`scripts/generate-presentation.js` を以下の内容で作成:

```javascript
// scripts/generate-presentation.js
const fs = require('fs')
const path = require('path')

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'presentation', 'screenshots')
const OUTPUT_FILE = path.join(__dirname, '..', 'presentation', 'vatch-presentation.html')

// ── 各画面の情報・機能説明 ──────────────────────────────
const SCREEN_SLIDES = [
  {
    name: 'dashboard',
    title: 'ダッシュボード',
    icon: '📊',
    features: [
      'KPI サマリー（稼働中案件数・人材数・今月提案数・成約率）',
      'AIマッチング候補を即時確認・提案メールをワンクリック送信',
      '自動送信キュー（PENDING_AUTO 状態のメール一覧）',
      'アラートパネル（契約終了予定・対応が必要な案件）',
      'パイプライン進捗バー（ステータス別件数）',
      '直近アクティビティログ（操作履歴を時系列表示）',
    ],
  },
  {
    name: 'cases',
    title: '案件管理',
    icon: '📋',
    features: [
      '案件の登録・編集・削除（タイトル、クライアント、スキル、単価）',
      '稼働スタイル（リモート/オンサイト/ハイブリッド）・開始日管理',
      'ステータス管理（OPEN / PROPOSING / INTERVIEWING / CONTRACTED）',
      'スキルタグ・単価・ステータスで絞り込み検索',
      '担当者アサイン（ロールベースのアクセス制御）',
      'クライアントへのメールリンク',
    ],
  },
  {
    name: 'talents',
    title: '人材管理',
    icon: '👤',
    features: [
      '人材の登録・編集・削除（名前、スキル、経験年数、希望単価）',
      '稼働可能日・勤務スタイル・所在地管理',
      'ステータス管理（AVAILABLE / ACTIVE / NEGOTIATING / ENDING_SOON）',
      'スキルタグ・経験年数・ステータスで絞り込み検索',
      '経歴書（PDF/Word）アップロード・ダウンロード',
      'エージェントメールアドレス管理',
    ],
  },
  {
    name: 'matching',
    title: 'AIマッチング',
    icon: '🤖',
    features: [
      'AI による案件×人材の自動スコアリング（スキル適合・単価・タイミング）',
      '粗利率・スコア・ステータスで一覧ソート',
      'マッチング詳細（スキル適合率・単価可否・稼働時期・勤務地）',
      '提案メールをワンクリック自動生成・送信',
      'ステータス管理（未提案 / 提案中 / 返答待ち / 面談調整中 / 稼働中）',
      '担当者へのメモ記入・活動ログ自動記録',
    ],
  },
  {
    name: 'proposals',
    title: '提案管理',
    icon: '✉️',
    features: [
      '提案一覧（ステータス・送信日・担当案件・人材を一覧表示）',
      'ステータス管理（DRAFT / SENT / REPLIED / REJECTED）',
      'メール本文プレビュー（件名・To・CC・本文）',
      '経歴書を添付して送信',
      '返答記録・ステータス更新',
      '提案から契約への昇格処理',
    ],
  },
  {
    name: 'contracts',
    title: '契約管理',
    icon: '📝',
    features: [
      '稼働中・終了予定・終了済みの契約一覧',
      '契約期間（開始日・終了日）・単価・原価管理',
      '粗利額・粗利率の自動計算',
      'ステータス管理（ACTIVE / ENDING_SOON / ENDED / RENEWAL_PENDING）',
      '担当者別の契約一覧フィルタ',
      '契約終了予定アラート（ダッシュボードと連携）',
    ],
  },
  {
    name: 'sales',
    title: '営業管理（パイプライン）',
    icon: '🎯',
    features: [
      'マッチング全件をパイプライン形式で一覧管理',
      'ステータス別の件数・金額を即時把握',
      '案件詳細・人材詳細・提案詳細をインライン確認',
      'ステータス変更・メモ記入をその場で実行',
      '担当者フィルタ（管理者は全件、担当者は自分の案件のみ）',
      'スコア・更新日・粗利率でソート',
    ],
  },
  {
    name: 'progress',
    title: '営業進捗',
    icon: '📈',
    features: [
      'KPI サマリー（今月提案数・成約数・成約率・粗利）前月比表示',
      '営業パイプライン（ステータス別件数・見込み金額バー）',
      '月別推移テーブル（直近6ヶ月の提案数・成約数・粗利）',
      '担当者別実績テーブル（提案数・成約数・粗利・成約率）',
      '管理者は全担当者分、担当者は自分の数値のみ閲覧可能',
    ],
  },
  {
    name: 'emails',
    title: 'メール管理',
    icon: '📧',
    features: [
      'IMAP サーバーからのメール自動取り込み',
      'AI による案件・人材メールの自動分類',
      'メール本文から案件情報（スキル・単価・開始日）を自動解析',
      '未処理・処理済みメールの一覧管理',
      'メールから案件・人材を直接登録',
      '取り込みステータス管理（UNPROCESSED / PROCESSED / SKIPPED）',
    ],
  },
  {
    name: 'overview',
    title: 'システム概要',
    icon: '🗺️',
    features: [
      'メール受信→解析→案件・人材登録→AIマッチング→提案→契約 のフロー図',
      '各ステップの実装済み機能と今後の予定を一覧表示',
      'システム全体の設計思想と運用フローを可視化',
      '新規ユーザーへのオンボーディングガイドとして活用可能',
    ],
  },
  {
    name: 'settings',
    title: '設定',
    icon: '⚙️',
    features: [
      'ユーザー管理（ADMIN / STAFF ロール管理）',
      'システム全体の設定管理',
    ],
  },
  {
    name: 'email-sources',
    title: 'メールソース設定',
    icon: '📮',
    features: [
      'IMAP サーバーの接続設定（ホスト・ポート・メールアドレス）',
      '取り込み対象フォルダの設定',
      '自動取り込みスケジュール管理',
      '接続テスト・手動取り込みトリガー',
      '複数のメールソースを登録可能（案件用・人材用など分離運用）',
    ],
  },
]

// ── スクリーンショットを base64 で読み込む ────────────────
function loadScreenshot(name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`)
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  スクリーンショットが見つかりません: ${filePath}`)
    return null
  }
  const data = fs.readFileSync(filePath)
  return `data:image/png;base64,${data.toString('base64')}`
}

// ── スライド HTML を生成 ─────────────────────────────────
function buildTitleSlide() {
  return `
  <div class="slide" id="slide-0">
    <div class="title-slide">
      <div class="title-logo">VATCH</div>
      <div class="title-sub">VICENT SES</div>
      <h1 class="title-main">ITエンジニア案件・人材<br>マッチング管理システム</h1>
      <p class="title-catch">メール取り込みから契約まで、営業プロセスを一元管理</p>
      <div class="title-tags">
        <span class="tag">AI マッチング</span>
        <span class="tag">自動提案</span>
        <span class="tag">営業進捗管理</span>
        <span class="tag">メール自動解析</span>
      </div>
    </div>
  </div>`
}

function buildFlowSlide() {
  const steps = [
    { icon: '📧', label: 'メール受信', sub: '案件・人材情報を自動取り込み' },
    { icon: '📋', label: '情報登録', sub: 'AI解析で自動入力' },
    { icon: '🤖', label: 'AIマッチング', sub: 'スコアリング・最適提案' },
    { icon: '✉️', label: '提案メール', sub: 'ワンクリック自動生成・送信' },
    { icon: '🤝', label: '面談・契約', sub: '稼働まで一元管理' },
    { icon: '📈', label: '実績分析', sub: 'KPI・粗利をリアルタイム集計' },
  ]
  const stepsHtml = steps.flatMap((s, i) => {
    const item = `
    <div class="flow-item">
      <div class="flow-icon">${s.icon}</div>
      <div class="flow-label">${s.label}</div>
      <div class="flow-sub">${s.sub}</div>
    </div>`
    return i < steps.length - 1 ? [item, '<div class="flow-arrow">→</div>'] : [item]
  }).join('')

  return `
  <div class="slide" id="slide-overview">
    <div class="slide-header">
      <span class="slide-icon">🗺️</span>
      <h2 class="slide-title">業務フロー全体像</h2>
    </div>
    <div class="flow-diagram">${stepsHtml}</div>
    <div class="flow-caption">Vatch はこの6ステップを一つのシステムで完結させます</div>
  </div>`
}

function buildScreenSlide(slide, index) {
  const imgSrc = loadScreenshot(slide.name)
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" alt="${slide.title}" class="screen-image" />`
    : `<div class="screen-placeholder">スクリーンショットなし</div>`
  const featuresHtml = slide.features.map(f => `<li>${f}</li>`).join('\n          ')

  return `
  <div class="slide" id="slide-${index}">
    <div class="slide-header">
      <span class="slide-icon">${slide.icon}</span>
      <h2 class="slide-title">${slide.title}</h2>
    </div>
    <div class="slide-body">
      <div class="screen-col">
        ${imgHtml}
      </div>
      <div class="features-col">
        <h3 class="features-heading">主な機能</h3>
        <ul class="features-list">
          ${featuresHtml}
        </ul>
      </div>
    </div>
  </div>`
}

function buildSummarySlide() {
  return `
  <div class="slide" id="slide-summary">
    <div class="title-slide">
      <h2 style="font-size:2rem;color:#22d3ee;margin-bottom:2rem;">Vatch の主なメリット</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-icon">⚡</div>
          <h3>営業効率 3倍</h3>
          <p>メール解析からマッチング・提案メール生成まで自動化。手作業を大幅削減。</p>
        </div>
        <div class="summary-card">
          <div class="summary-icon">🤖</div>
          <h3>AI による最適提案</h3>
          <p>スキル・単価・タイミングを総合評価。粗利率を考慮した案件・人材マッチング。</p>
        </div>
        <div class="summary-card">
          <div class="summary-icon">📊</div>
          <h3>リアルタイム実績管理</h3>
          <p>KPI・粗利・成約率を月別・担当者別に即時集計。データドリブンな営業管理。</p>
        </div>
      </div>
      <p style="margin-top:3rem;color:#6b7280;font-size:0.9rem;">お問い合わせ: s.nita@vicent.co.jp</p>
    </div>
  </div>`
}

// ── メイン処理 ───────────────────────────────────────────
function main() {
  console.log('📊 HTML プレゼンテーション生成中...\n')

  const titleSlide = buildTitleSlide()
  const flowSlide = buildFlowSlide()
  const screenSlides = SCREEN_SLIDES.map((s, i) => buildScreenSlide(s, i + 2))
  const summarySlide = buildSummarySlide()

  const allSlides = [titleSlide, flowSlide, ...screenSlides, summarySlide]
  const totalSlides = allSlides.length

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vatch - 営業プレゼンテーション</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0a;
      color: #e0e0e0;
      font-family: 'Segoe UI', 'Hiragino Sans', 'Yu Gothic', sans-serif;
      overflow: hidden;
      height: 100vh;
    }

    /* ── プログレスバー ── */
    #progress-bar {
      position: fixed; top: 0; left: 0; height: 3px;
      background: linear-gradient(90deg, #0ea5e9, #22d3ee);
      transition: width 0.3s ease;
      z-index: 100;
    }

    /* ── スライドナビ ── */
    #slide-counter {
      position: fixed; bottom: 1.5rem; right: 2rem;
      font-size: 0.8rem; color: #4b5563;
      z-index: 100;
    }
    #nav-hint {
      position: fixed; bottom: 1.5rem; left: 50%;
      transform: translateX(-50%);
      font-size: 0.75rem; color: #374151;
      z-index: 100;
    }

    /* ── スライドコンテナ ── */
    .slide {
      display: none;
      width: 100vw; height: 100vh;
      padding: 2.5rem 3rem 3rem;
      flex-direction: column;
    }
    .slide.active { display: flex; }

    /* ── タイトルスライド ── */
    .title-slide {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100%; text-align: center;
    }
    .title-logo {
      font-size: 3rem; font-weight: 900; letter-spacing: 0.5rem;
      color: #f59e0b; margin-bottom: 0.25rem;
    }
    .title-sub {
      font-size: 0.75rem; letter-spacing: 0.3rem;
      color: #6b7280; margin-bottom: 2rem;
    }
    .title-main {
      font-size: 2.5rem; font-weight: 800;
      color: #f9fafb; line-height: 1.3; margin-bottom: 1rem;
    }
    .title-catch {
      font-size: 1.1rem; color: #9ca3af; margin-bottom: 2.5rem;
    }
    .title-tags { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }
    .tag {
      background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3);
      color: #22d3ee; padding: 0.4rem 1rem; border-radius: 999px; font-size: 0.85rem;
    }

    /* ── 共通スライドヘッダー ── */
    .slide-header {
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 1.5rem; border-bottom: 1px solid #1f2937; padding-bottom: 0.75rem;
    }
    .slide-icon { font-size: 1.75rem; }
    .slide-title { font-size: 1.6rem; font-weight: 700; color: #f9fafb; }

    /* ── 画面スライド本体 ── */
    .slide-body {
      display: grid; grid-template-columns: 60% 1fr;
      gap: 2rem; flex: 1; min-height: 0;
    }
    .screen-col {
      display: flex; align-items: flex-start; overflow: hidden;
      border: 1px solid #1f2937; border-radius: 8px; background: #111;
    }
    .screen-image {
      width: 100%; height: 100%; object-fit: cover; object-position: top;
      border-radius: 8px;
    }
    .screen-placeholder {
      width: 100%; display: flex; align-items: center; justify-content: center;
      color: #4b5563; font-size: 0.9rem;
    }
    .features-col { display: flex; flex-direction: column; }
    .features-heading {
      font-size: 0.75rem; letter-spacing: 0.1rem; text-transform: uppercase;
      color: #22d3ee; margin-bottom: 1rem;
    }
    .features-list { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
    .features-list li {
      display: flex; align-items: flex-start; gap: 0.5rem;
      font-size: 0.9rem; color: #d1d5db; line-height: 1.4;
    }
    .features-list li::before {
      content: '✓'; color: #22d3ee; font-weight: 700; flex-shrink: 0; margin-top: 0.05em;
    }

    /* ── フロー図スライド ── */
    .flow-diagram {
      display: flex; align-items: center; justify-content: center;
      flex: 1; gap: 0; flex-wrap: wrap;
    }
    .flow-item {
      display: flex; flex-direction: column; align-items: center;
      position: relative; text-align: center;
    }
    .flow-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .flow-label { font-size: 0.95rem; font-weight: 700; color: #f9fafb; margin-bottom: 0.25rem; }
    .flow-sub { font-size: 0.72rem; color: #6b7280; max-width: 100px; line-height: 1.3; }
    .flow-arrow {
      font-size: 1.5rem; color: #22d3ee; margin: 0 0.5rem;
      align-self: center; padding-bottom: 1.5rem;
    }
    .flow-caption {
      text-align: center; color: #4b5563; font-size: 0.85rem; margin-top: 2rem;
    }

    /* ── まとめスライド ── */
    .summary-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; width: 100%;
      max-width: 900px;
    }
    .summary-card {
      background: #111827; border: 1px solid #1f2937; border-radius: 12px;
      padding: 2rem; text-align: center;
    }
    .summary-icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .summary-card h3 { font-size: 1.1rem; color: #22d3ee; margin-bottom: 0.75rem; }
    .summary-card p { font-size: 0.85rem; color: #9ca3af; line-height: 1.6; }
  </style>
</head>
<body>

<div id="progress-bar"></div>
<div id="slide-counter">1 / ${totalSlides}</div>
<div id="nav-hint">← → キーまたはクリックでスライド切替</div>

${allSlides.join('\n')}

<script>
  let current = 0;
  const slides = document.querySelectorAll('.slide');
  const counter = document.getElementById('slide-counter');
  const progressBar = document.getElementById('progress-bar');
  const total = slides.length;

  function show(n) {
    slides[current].classList.remove('active');
    current = Math.max(0, Math.min(n, total - 1));
    slides[current].classList.add('active');
    counter.textContent = (current + 1) + ' / ' + total;
    progressBar.style.width = ((current + 1) / total * 100) + '%';
  }

  // 最初のスライドを表示
  show(0);

  // キーボード操作
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') show(current + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') show(current - 1);
  });

  // クリック操作（右半分→次、左半分→前）
  document.addEventListener('click', (e) => {
    if (e.clientX > window.innerWidth / 2) show(current + 1);
    else show(current - 1);
  });
</script>
</body>
</html>`

  fs.writeFileSync(OUTPUT_FILE, html, 'utf-8')

  const size = Math.round(fs.statSync(OUTPUT_FILE).size / 1024)
  console.log(`✅ 生成完了: ${OUTPUT_FILE}`)
  console.log(`   スライド数: ${totalSlides} 枚`)
  console.log(`   ファイルサイズ: ${size} KB`)
  console.log('\n📌 ブラウザで開くには:')
  console.log(`   start ${OUTPUT_FILE}`)
}

main()
```

- [ ] **Step 2: スクリプトを実行**

```bash
node scripts/generate-presentation.js
```

期待出力:
```
📊 HTML プレゼンテーション生成中...

✅ 生成完了: .../presentation/vatch-presentation.html
   スライド数: 15 枚
   ファイルサイズ: XXXX KB
```

- [ ] **Step 3: ブラウザで確認**

```bash
start presentation/vatch-presentation.html
```

以下を確認する:
- 表紙スライドが表示される
- 右矢印キーで次のスライドへ進める
- 各画面スライドにスクリーンショットと機能説明が表示される
- プログレスバーが進む
- まとめスライドで終わる

- [ ] **Step 4: コミット**

```bash
git add scripts/capture-screenshots.js scripts/generate-presentation.js
git add presentation/vatch-presentation.html
git add presentation/screenshots/
git commit -m "feat: 営業用 HTML プレゼンテーション自動生成スクリプトを追加

- Playwright で全12画面のスクリーンショットを自動撮影
- HTML プレゼンテーション生成（キーボード操作・base64 埋め込みで自己完結）
- presentation/vatch-presentation.html に出力

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
