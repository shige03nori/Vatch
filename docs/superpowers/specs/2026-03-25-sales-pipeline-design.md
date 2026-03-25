# 営業管理画面（Sales Pipeline）設計書

## 概要

SES営業活動のパイプラインを管理する専用画面。`/sales` に新規ページとして実装し、既存の `matching/page.tsx` と `proposals/page.tsx` は変更しない。Matchingレコードを軸に、提案から成約までの営業フローを一元管理する。

---

## 画面仕様

### URL・配置

- **URL:** `/sales`
- **Sidebar:** 「営業管理」メニュー項目を追加
- **テーマ:** ダークテーマ（背景 `#111` / `#0f0f0f`）

### パイプラインステージ（5段階）

```
提案準備中 → 提案送信済み → 返答あり・商談中 → 成約 → 失注
```

既存 `Proposal.status` との対応：

| パイプラインステージ | Proposal.status |
|---|---|
| 提案準備中 | `DRAFT` / `AUTO_SEND_PENDING` |
| 提案送信済み | `SENT` |
| 返答あり・商談中 | `REPLIED` |
| 成約 | → Contract レコードあり |
| 失注 | `REJECTED` |

Matchingに紐づくProposalが存在しない場合は「提案準備中」として扱う。

---

## レイアウト構成

### 1. KPIサマリーバー（上部）

5列グリッドで各ステージの件数を常時表示。成約列のみ件数＋売上金額（万円）を表示。

| 提案準備中 | 提案送信済み | 商談中 | 成約 | 失注 |
|---|---|---|---|---|
| 黄 `#fbbf24` | 青 `#60a5fa` | 紫 `#c084fc` | 緑 `#4ade80` | 赤 `#f87171` |

### 2. フィルタータブ＋検索バー

- タブ: 全件 / 提案準備中 / 提案送信済み / 商談中 / 成約 / 失注（各件数表示）
- 検索: 案件名・人材名の部分一致（フロント側フィルタリング）

### 3. テーブルリスト

| 列 | データソース | 備考 |
|---|---|---|
| 案件名 | `Case.title` + `Case.client` | 2行表示 |
| 人材名 | `Talent.name` + スキル・経験 | 2行表示 |
| スコア | `Matching.score` | 85%以上=緑、70%以上=黄 |
| 単価 | `Case.unitPrice`（万円） | |
| 粗利率 | `Matching.grossProfitRate` | 15%以上=緑、10%以上=黄 |
| 担当者 | `User.name`（assignedUserId） | |
| ステージ | ドロップダウン | 変更時に確認モーダルを表示 |
| アクション | ボタン群 | 詳細・提案・成約・📝 |

メモがある場合は案件名の下に紫文字で先頭100文字を表示。

---

## アクション仕様

### ステージドロップダウン

- 変更選択時に「ステージ変更確認モーダル」を表示
- 確認後に `PATCH /api/matchings/[id]` でステージを更新
- 任意の変更メモを ActivityLog に記録

### 詳細モーダル

表示内容：
- 案件情報（顧客・単価・スタート日・勤務形態・スキル要件）
- 人材情報（経験年数・希望単価）
- マッチングスコア内訳（スキルマッチ・単価適合・タイミング・勤務地）
- メモ入力・保存（`Matching.memo` フィールドに保存）

### 提案モーダル

- 既存Proposalがある場合：ステータス・送信日時・送信先・粗利率・メール本文を表示
  - 「再送信」ボタン → `POST /api/emails/send`
  - 「提案を取り消す」ボタン → `PATCH /api/proposals/[id]` でステータスを `DRAFT` に戻す
- Proposalがない場合：新規Proposal作成フォームを表示
  - `POST /api/proposals` で Proposal を作成

### 成約登録モーダル

- 入力項目：契約開始日・契約終了予定日・売価（万円/月）・原価（万円/月）
- 粗利率・粗利額をリアルタイム計算して表示
- 「成約登録」ボタン → `POST /api/contracts` で Contract を作成、ステージを「成約」に更新

### ステージ変更確認モーダル

- 変更前後のステージバッジを表示
- 任意の変更メモ（テキストエリア）
- 確認後に更新実行

---

## データ取得

### GET /api/sales/pipeline

新規エンドポイント。Matching を Case・Talent・Proposal・Contract・AssignedUser ごと取得し、パイプラインステージを付与して返す。

```
GET /api/sales/pipeline
  → Matching[] with nested Case, Talent, Proposal (latest), Contract, User
  → 各Matchingに pipelineStage を付与（Proposal.statusとContractの有無から算出）
```

既存の `GET /api/matchings` は変更しない。

---

## データモデル変更

### Matching テーブル

`memo` フィールドを追加（`String? @default(null)`）。メモは Matching ごとに1件保持する。

```prisma
model Matching {
  // 既存フィールド...
  memo String?  // 追加
}
```

---

## ファイル構成

| ファイル | 変更種別 | 役割 |
|---|---|---|
| `prisma/schema.prisma` | 修正 | Matching に memo フィールドを追加 |
| `prisma/migrations/` | 新規 | memo フィールドのマイグレーション |
| `src/app/api/sales/pipeline/route.ts` | 新規 | GET: パイプラインデータ取得 |
| `src/app/api/matchings/[id]/route.ts` | 修正 | PATCH: memo・ステージ更新対応 |
| `src/app/(main)/sales/page.tsx` | 新規 | 営業管理画面メインページ |
| `src/components/sales/PipelineTable.tsx` | 新規 | テーブルリストコンポーネント |
| `src/components/sales/StageBadge.tsx` | 新規 | ステージバッジ（色付きラベル） |
| `src/components/sales/DetailModal.tsx` | 新規 | 詳細＋メモモーダル |
| `src/components/sales/ProposalModal.tsx` | 新規 | 提案確認・作成モーダル |
| `src/components/sales/ContractModal.tsx` | 新規 | 成約登録モーダル |
| `src/components/sales/StageChangeModal.tsx` | 新規 | ステージ変更確認モーダル |
| `src/components/layout/Sidebar.tsx` | 修正 | 「営業管理」メニュー項目を追加 |
| `src/lib/schemas/sales.ts` | 新規 | Zod スキーマ（pipeline クエリ・ステージ更新） |

---

## 非機能要件

- 認証必須（既存の NextAuth.js セッション）
- ADMIN・STAFF 両ロールからアクセス可能
- パイプラインデータは初期ロード時に全件取得、フィルタリングはフロント側で処理
- ステージ変更・成約登録・メモ保存はすべて ActivityLog に記録

---

## スコープ外（将来対応）

- ドラッグ＆ドロップでのステージ変更
- 担当者フィルター
- 期間フィルター（月次絞り込み）
- CSV エクスポート
