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
