# 営業進捗画面 設計書

## 概要

`/progress` ページ（`src/app/(main)/progress/page.tsx`）は **Prisma による実データ取得で実装済み**。残作業は不要なモックデータファイルの削除と、テストデータ投入スクリプトの拡充のみ。

---

## 実装済みの内容

`src/app/(main)/progress/page.tsx` は Server Component（`async` 関数）として完全に実装されており、以下の4セクションを実データから表示する。

| セクション | データソース |
|---|---|
| KPI サマリー | Proposal（sentAt が直近6ヶ月・status != DRAFT ※ PENDING_AUTO は除外されない）・Contract（createdAt が直近6ヶ月）|
| 営業パイプライン | Matching.status（INTERVIEWING・SENT・REPLIED・CONTRACTED）|
| 月別推移（直近6ヶ月） | Proposal.sentAt / Contract.createdAt でグループ化 |
| 担当者別実績 | Contract / Proposal → Case.assignedUser でグループ化 |

---

## パイプラインステージ定義

| Matching.status | ラベル | カラー |
|---|---|---|
| `INTERVIEWING` | 面談調整中 | `#a78bfa` |
| `SENT` | 提案中 | `#38bdf8` |
| `REPLIED` | 返答待ち | `#f59e0b` |
| `CONTRACTED` | 稼働中 | `#4ade80` |

※ `PENDING_AUTO`・`UNPROPOSED`・`REJECTED` はパイプラインに表示しない。

---

## 集計ロジック

- **今月 / 先月**: サーバー側の `new Date()` から月初・月末を計算
- **月別推移**: `monthKey(date)` 関数で `YYYY-MM` キーに変換してグループ化
- **KPI 前月比**: `monthlyData[5]`（今月）と `monthlyData[4]`（先月）の差分
- **担当者別実績**: Proposal → Matching → Case → assignedUser の経路で集計

---

## ファイル構成（変更が必要なもの）

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/data/progress.ts` | 削除 | モックデータ（page.tsx から参照なし） |
| `prisma/seed.ts` | 修正 | テストデータを過去6ヶ月に分散させて拡充 |

`src/app/(main)/progress/page.tsx` は変更不要。

---

## テストデータ設計（seed 拡充）

### 目標件数

| モデル | 目標 | 現状 |
|---|---|---|
| User | 3 名（ADMIN × 1、STAFF × 2） | 1 名 |
| Case | 12 件（過去6ヶ月に startDate を分散） | 3 件 |
| Talent | 12 件 | 3 件 |
| Matching | 20 件（SENT・REPLIED・INTERVIEWING・CONTRACTED に分散） | 2 件（UNPROPOSED + PENDING_AUTO のみ） |
| Proposal | 15 件（sentAt を過去6ヶ月に分散・status: SENT または REPLIED） | 1 件（sentAt なし・PENDING_AUTO のため KPI に反映されない） |
| Contract | 8 件（createdAt を過去6ヶ月に分散） | 1 件（範囲内だが単体） |

### 重要な制約

- **Proposal**: `sentAt` を必ず設定すること（null だと `sentAt: { gte: sixMonthsAgo }` にヒットしない）
- **Proposal.status**: `SENT` または `REPLIED` を推奨（除外されるのは技術的に `DRAFT` のみ。意味的整合性のため `SENT`/`REPLIED` に限定する）
- **Contract**: `createdAt` を過去6ヶ月に分散させるには明示的に指定する（例: `createdAt: new Date('2025-11-15')`）。`@default(now())` はデフォルトのため、seed で過去日付を使う場合は必ず明示する
- **Matching**: `SENT`・`REPLIED`・`INTERVIEWING`・`CONTRACTED` のステータスをバランスよく分散させる

### seed 実行方法

```bash
npx prisma db seed
```

---

## 非機能要件

- 認証必須（NextAuth.js セッション）
- ADMIN は全担当者分、STAFF は自身の担当分のみ表示
- テストデータ投入後に `/progress` でスクリーンショット確認
