# 契約・売上画面 設計書

**日付**: 2026-06-05  
**ステータス**: 承認済み

---

## 概要

契約・売上画面を静的ハードコードデータから実DBデータに切り替える。API拡張（joinとサマリーエンドポイント新設）と、画面への手動契約作成・フル編集機能を追加する。

---

## 1. API設計

### 1-1. `GET /api/contracts` の拡張

`case` と `talent` をjoinして人材名・案件名・クライアント名を返す。

```ts
prisma.contract.findMany({
  where,
  include: {
    case:   { select: { title: true, client: true } },
    talent: { select: { name: true } },
  },
  orderBy: { createdAt: 'desc' },
})
```

**レスポンス例:**
```json
{
  "id": "...",
  "unitPrice": 80,
  "costPrice": 65,
  "grossProfitRate": 18.75,
  "status": "ACTIVE",
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-06-30T00:00:00Z",
  "case": { "title": "基幹システム開発", "client": "ABC商事" },
  "talent": { "name": "田中 成則" }
}
```

### 1-2. `GET /api/contracts/summary` を新設

直近6ヶ月の月別売上を実契約期間から計算する。各月について `startDate ≤ 月末 AND (endDate IS NULL OR endDate ≥ 月初)` の条件を満たす稼働中・終了間近・更新検討中の契約を対象に `unitPrice` / `costPrice` を合算する。

**レスポンス:**
```json
[
  { "month": "2026-01", "revenue": 320, "cost": 265, "grossProfit": 55 },
  { "month": "2026-02", "revenue": 340, "cost": 280, "grossProfit": 60 },
  ...
]
```

- 対象月: 今日から遡って6ヶ月分（サーバーサイドで計算）
- 対象ステータス: `ACTIVE`, `ENDING_SOON`, `RENEWAL_PENDING`, `ENDED`（その月に稼働していたものすべて）
- 認可: ADMIN は全件、STAFF は自分が担当する契約のみ

### 1-3. 既存エンドポイント（変更なし）

新規作成フォームのドロップダウン用に以下を利用:
- `GET /api/cases?limit=100` → 案件一覧
- `GET /api/talents?limit=100` → 人材一覧

### 1-4. `POST /api/contracts` の変更

現行の `CreateContractSchema` は `proposalId` が必須。手動作成時は提案なしで作成できるよう `proposalId` をオプションにする。

```ts
export const CreateContractSchema = z.object({
  caseId:          z.string().cuid(),
  talentId:        z.string().cuid(),
  proposalId:      z.string().cuid().optional(),  // 変更: optional に
  startDate:       z.coerce.date(),
  endDate:         z.coerce.date().optional(),
  unitPrice:       z.number().int().positive(),
  costPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
})
```

---

## 2. 画面レイアウト

### 2-1. ページ構成

```
[＋ 新規作成] ボタン（右上）

[KPIカード × 4]
  - 稼働中契約数（ACTIVE件数）
  - 今月売上（万円）
  - 今月粗利（万円）
  - 平均粗利率（稼働中の平均）

[月別売上サマリーテーブル]（直近6ヶ月、/api/contracts/summary から取得）
  - 月 / 売上 / 原価 / 粗利 / 粗利率

[ステータスフィルター]（全件 / 稼働中 / 終了間近 / 終了 / 更新検討中）

[契約一覧テーブル]（/api/contracts から取得）
  - 人材名/案件名 / クライアント / 期間（開始〜終了）/ 売値 / 仕入値 / 粗利率 / ステータス / 残日数 / 操作
```

### 2-2. 残日数表示ルール

| 条件 | 表示 |
|------|------|
| `endDate` なし | 「—」 |
| 終了日まで31日以上 | グレーで日数 |
| 終了日まで30日以内 | 赤字で日数（警告） |
| 終了済み（ENDED） | 「—」 |

### 2-3. 粗利率の警告

粗利率が10%未満の行は `要確認` バッジを表示（amber色）。

---

## 3. 作成・編集フォーム

### 3-1. 新規作成モーダル

| フィールド | 型 | 必須 | 備考 |
|-----------|------|------|------|
| 案件 | ドロップダウン（Case一覧） | ✓ | |
| 人材 | ドロップダウン（Talent一覧） | ✓ | |
| 売値（万円） | 数値 | ✓ | |
| 仕入値（万円） | 数値 | ✓ | |
| 粗利率 | 自動計算表示 | — | `(売値-仕入値)/売値×100` |
| 開始日 | 日付 | ✓ | |
| 終了日 | 日付 | — | |

- 登録後: ステータスは `ACTIVE` 固定（変更は編集モーダルで行う）
- 成功時: モーダルを閉じて一覧を再取得

### 3-2. 編集モーダル

編集可能フィールド:

| フィールド | 備考 |
|-----------|------|
| 売値（万円） | |
| 仕入値（万円） | |
| 粗利率 | 自動計算表示 |
| 終了日 | |
| ステータス | ACTIVE / ENDING_SOON / ENDED / RENEWAL_PENDING |

人材・案件は変更不可（表示のみ）。

### 3-3. 削除

管理者（ADMIN）のみ削除ボタンを表示。2段階確認（「削除」→「本当に削除」）。

---

## 4. ファイル変更一覧

**作成:**
- `src/app/api/contracts/summary/route.ts` — 月別サマリーAPI

**更新:**
- `src/app/api/contracts/route.ts` — GET に include 追加
- `src/lib/schemas/contract.ts` — proposalId をオプション化
- `src/app/(main)/contracts/page.tsx` — 全面置き換え（静的データ削除）

**削除:**
- `src/data/contracts.ts` — 不要になった静的データ

---

## 5. スコープ外

- 契約の自動更新通知
- PDF/CSV エクスポート
- 担当者変更
