# Vatch Dashboard — 設計仕様書

**作成日:** 2026-03-18
**対象フェーズ:** Phase 1（ダミーデータで動くフロントモック）
**目的:** 役員説明に耐える画面モックの実装

---

## 1. スコープ

本仕様はVatchダッシュボード画面の実装設計を定める。
Phase 1ではダミーデータを使い、APIやDB接続なしで動作するフロントエンドモックを構築する。

---

## 2. 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| ダミーデータ | TypeScriptの定数（`src/data/`） |
| パッケージ管理 | npm |

---

## 3. デザイン方針

- **スタイル:** ダーク管理画面（Grafana/Metabase風）
- **背景:** `#060d1a`（深い紺黒）
- **アクセント:** `#38bdf8`（シアン系ブルー）、`#4ade80`（グリーン）、`#f59e0b`（アンバー）、`#f87171`（レッド警告）
- **フォント:** システムフォント（-apple-system / Segoe UI）
- **ロゴ:** 三角形＋稲妻のVatchブランドロゴ（`public/logo.png` — 前提資産として `C:/Users/shige/Vatch/logo.png` をコピー済み）

---

## 4. レイアウト構成

```
┌─────────────────────────────────────────────┐
│  Sidebar (200px固定)  │  Main Content Area   │
│                       │  ┌─ Topbar (52px) ─┐ │
│  [Logo]               │  │ タイトル / LIVE  │ │
│  ─ ダッシュボード     │  └─────────────────┘ │
│  ─ メール取込 [8]     │  ┌─ KPI 6枚 ──────┐ │
│  ─ 案件管理           │  └────────────────┘ │
│  ─ 人材管理           │  ┌─ 2カラム ──────┐ │
│  ─ マッチング [5]     │  │マッチング│送信  │ │
│  ─ 提案メール         │  └────────────────┘ │
│  ─ 営業進捗           │  ┌─ 3カラム ──────┐ │
│  ─ 契約・売上         │  │アラート│パイプ│活動│ │
│  ─ 設定               │  └────────────────┘ │
│  [ユーザー名]         │                      │
└─────────────────────────────────────────────┘
```

### 4-1. サイドバー
- 幅: 200px 固定
- ロゴ + ナビゲーションリンク + ユーザー名
- 未読バッジ: メール取込・マッチングに表示
- アクティブ状態: シアンハイライト

### 4-2. トップバー
- 高さ: 52px
- ページタイトル・LIVE表示・日付・ユーザーアバター

### 4-3. KPIカード（6枚）
| カード | 値 | カラー |
|---|---|---|
| 本日受信案件 | 件数 | ブルー |
| 本日受信人材 | 件数 | ブルー |
| AIマッチング候補 | 件数 | グリーン |
| 自動送信待ち | 件数 | アンバー（要確認） |
| 面談調整中 | 件数 | ブルー |
| 今月粗利見込 | 金額 | グリーン |

各カードにカラーラインを上部に表示。

### 4-4. AIマッチング候補パネル（左2/3）
- スキルタグ（Java/React/PM/Goなど）
- 人材名・案件名
- スコアバー + パーセント
- 粗利OK/警告マーク
- 提案ボタン

### 4-5. 自動送信キューパネル（右1/3）
- ステータスバッジ（自動/要確認/下書き）
- 案件×人材の組み合わせ
- 粗利率（10%未満は警告色）
- 一括確認・送信ボタン

### 4-6. ボトム3カラム
- **要対応アラート**: 契約更新・返答超過・粗利警告
- **営業パイプライン**: ステータス別件数バー
- **最近の活動ログ**: タイムスタンプ＋イベント

---

## 5. コンポーネント設計

```
src/
  app/
    layout.tsx          # Sidebar + 全体レイアウト
    page.tsx            # / → /dashboard リダイレクト
    dashboard/
      page.tsx          # ダッシュボード本体
  components/
    layout/
      Sidebar.tsx       # サイドナビ
      Topbar.tsx        # 上部バー
    dashboard/
      KpiCard.tsx       # KPIカード（再利用）
      MatchingPanel.tsx # AIマッチング候補リスト
      AutoSendQueue.tsx # 自動送信キュー
      AlertPanel.tsx    # 要対応アラート
      PipelinePanel.tsx # 営業パイプライン
      ActivityLog.tsx   # 活動ログ
  data/
    dashboard.ts        # ダミーデータ定数
  types/
    index.ts            # 型定義
```

---

## 6. ダミーデータ構造

```typescript
// src/data/dashboard.ts

export const kpiData = {
  todayCases: 12,
  todayTalents: 8,
  matchingCount: 24,
  autoSendPending: 5,
  interviewScheduling: 3,
  monthlyGrossProfit: 2400000,
}

export const matchingCandidates = [
  {
    id: '1',
    skill: 'Java',
    talentName: '田中 K.',
    caseName: '金融系案件',
    score: 92,
    grossProfitOk: true,
  },
  // ...
]

export const autoSendQueue = [
  {
    id: '1',
    status: 'auto',   // 'auto' | 'check' | 'draft'
    label: 'Java × 田中 → ABC商事',
    grossProfitRate: 14.2,
  },
  // ...
]

export const alerts = [
  {
    id: '1',
    icon: '⚠️',
    message: '契約更新 2件 — 来月末',
    severity: 'warning',  // 'warning' | 'error' | 'info'
    date: '4/30',
  },
  // ...
]

export const pipeline = [
  { label: '面談調整中', count: 3, color: '#a78bfa' },
  { label: '提案中',     count: 7, color: '#38bdf8' },
  { label: '返答待ち',   count: 5, color: '#f59e0b' },
  { label: '稼働中',     count: 12, color: '#4ade80' },
]

export const activityLog = [
  {
    id: '1',
    time: '09:42',
    color: '#38bdf8',
    text: 'Java案件メール取込 → AI解析完了',
  },
  // ...
]
```

---

## 7. 粗利ルール表示

- 粗利率 **10%以上**: グリーン表示（`#4ade80`）
- 粗利率 **10%未満**: アンバー警告（`#f59e0b`）+ 「要確認」バッジ
- 自動送信は粗利10%以上のみ「自動」ステータス

---

## 8. 非機能要件（Phase 1）

- APIなし・ダミーデータのみで動作
- レスポンシブ不要（デスクトップ1280px以上を想定）
- Next.js App Router使用
- `npm run dev` で即起動できること

---

## 9. 将来の拡張ポイント

- `src/data/` のダミーデータを API Routes / Prisma に差し替え
- Sidebar の各リンクに対応する画面を順次追加（案件管理→人材管理→マッチング→提案メール）
- AWS Bedrock / SES / S3 との接続はPhase 3以降

---

## 10. 実装順序

1. Next.jsプロジェクト作成（`create-next-app`）
2. Tailwind CSS設定・カラーテーマ定義
3. `Sidebar` + `Topbar` + 基本レイアウト
4. `KpiCard` コンポーネント × 6枚
5. `MatchingPanel` + `AutoSendQueue`（2カラム）
6. `AlertPanel` + `PipelinePanel` + `ActivityLog`（3カラム）
7. ダミーデータ整備・動作確認
