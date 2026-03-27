# 営業進捗画面 設計書

## 概要

既存の `/progress` ページ（`src/app/(main)/progress/page.tsx`）のモックデータを Prisma による実データ取得に差し替える。UI レイアウト・コンポーネント構成は基本的に維持し、テストデータを seed スクリプトで投入する。

---

## 変更方針

**アプローチ A（採用）: page.tsx を Prisma 直接呼び出しに書き換え**

- `page.tsx` はすでに Server Component（`async` 関数）のため、`import` を Prisma クエリに差し替えるだけ
- 新規 API エンドポイントは作成しない（`/sales/page.tsx` と同じパターン）
- `src/data/progress.ts` は削除

---

## データソース設計

### 1. KPI サマリー（今月）

| 指標 | データソース | 集計方法 |
|---|---|---|
| 今月提案数 | `Proposal` | `sentAt` が今月・`status != 'DRAFT'` の件数 |
| 今月成約数 | `Contract` | `startDate` が今月の件数 |
| 成約率 | 上記2値 | `contracts / proposals * 100`（proposals=0 のとき 0%） |
| 今月粗利 | `Contract` | `startDate` が今月の `(unitPrice - costPrice)` 合計（万円） |

前月比表示：先月分を同様の方法で取得し差分を計算して表示。

### 2. 営業パイプライン

`Matching.status`（`UNPROPOSED` および `REJECTED` を除く）をステージとして表示。

| Matching.status | ラベル | カラー |
|---|---|---|
| `PENDING_AUTO` | 提案準備中 | `#fbbf24` |
| `SENT` | 提案送信済み | `#60a5fa` |
| `REPLIED` | 返答あり | `#c084fc` |
| `INTERVIEWING` | 商談中 | `#a78bfa` |
| `CONTRACTED` | 成約 | `#4ade80` |

各ステージの：
- **件数**: 該当 Matching の count
- **見込み金額**: 該当 Matching に紐づく `Case.unitPrice` の合計（万円）

バーの幅は見込み金額の最大値を基準に相対表示。

### 3. 月別推移（直近6ヶ月）

サーバー側でループして各月の以下を集計：

| 列 | データソース |
|---|---|
| 提案数 | `Proposal.sentAt` が該当月・`status != 'DRAFT'` |
| 成約数 | `Contract.startDate` が該当月 |
| 粗利（万円） | `Contract.startDate` が該当月の `(unitPrice - costPrice)` 合計 |

最新月（今月）に「今月」バッジを表示。

### 4. 担当者別実績（今月）

`Case.assignedUser`（User）ごとに以下を集計：

| 列 | データソース |
|---|---|
| 提案数 | 担当 Case の Proposal で `sentAt` が今月・`status != 'DRAFT'` |
| 成約数 | 担当 Case の Contract で `startDate` が今月 |
| 粗利（万円） | 担当 Case の Contract で `startDate` が今月の `(unitPrice - costPrice)` 合計 |
| 成約率 | `contracts / proposals * 100` |

合計行も表示。

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/(main)/progress/page.tsx` | 修正 | Prisma クエリで4セクションのデータを取得 |
| `src/data/progress.ts` | 削除 | モックデータ不要のため削除 |
| `prisma/seed.ts` | 新規 | テストデータ投入スクリプト |

---

## テストデータ設計（seed）

`prisma/seed.ts` を新規作成し、`npx prisma db seed` で投入。

### 投入データ量

| モデル | 件数 | 備考 |
|---|---|---|
| User | 3 名 | ADMIN × 1、STAFF × 2 |
| Case | 12 件 | 過去6ヶ月に startDate を分散 |
| Talent | 12 件 | 各 Case に対応 |
| Matching | 20 件 | PENDING_AUTO・SENT・REPLIED・INTERVIEWING・CONTRACTED に分散 |
| Proposal | 15 件 | sentAt を過去6ヶ月に分散（status: SENT または REPLIED） |
| Contract | 8 件 | startDate を過去6ヶ月に分散 |

### seed 実行方法

`package.json` の `prisma.seed` フィールドを設定し、以下で実行：

```bash
npx prisma db seed
```

既存データとの衝突を避けるため、seed の冒頭で全テーブルをクリアする（`deleteMany` を依存順で実行）。

---

## Prisma クエリ設計

### 月初・月末の計算

```typescript
const now = new Date()
const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
```

### パイプライン取得

`Matching.findMany` で `status not in ['UNPROPOSED', 'REJECTED']` を取得し、`Case.unitPrice` をネスト include で取得。JS 側でステータスごとに集計。

### 月別推移

直近6ヶ月分のループで各月の `Proposal.count` と `Contract.findMany` を実行（計12クエリ程度）。

---

## 非機能要件

- 認証必須（既存の NextAuth.js セッション）
- ADMIN・STAFF 両ロールからアクセス可能
- データは初期ロード時にサーバーサイドで全件取得（フィルタ等はなし）
- テストデータ投入後にページが正しく表示されることを Playwright でスクリーンショット確認する

---

## スコープ外

- グラフ・チャートの追加（現状はテーブル・バーのみ）
- リアルタイム更新
- 期間フィルター
- CSV エクスポート
