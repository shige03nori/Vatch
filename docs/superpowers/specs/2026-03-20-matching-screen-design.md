# マッチング画面 Design Spec

## Goal

マッチング画面をモックデータから実APIに接続し、AI によるマッチング自動生成・提案モーダル・一括送信モーダルを実装する。

## Architecture

既存の `email-parser.ts` と同パターンで `matching-generator.ts`（Claude API）を作成。`POST /api/matchings/generate` がOPEN案件×AVAILABLE人材の未マッチング組み合わせを一括生成してDBに保存する。画面側は `GET /api/matchings`（case/talent ネスト追加）に接続し、提案モーダルと一括送信モーダルを実装する。

## Files

| ファイル | 変更 | 役割 |
|---|---|---|
| `src/lib/matching-generator.ts` | 新規 | Claude API でマッチングスコアリング |
| `src/lib/__tests__/matching-generator.test.ts` | 新規 | ユニットテスト |
| `src/app/api/matchings/generate/route.ts` | 新規 | POST：マッチング一括生成エンドポイント |
| `src/app/api/matchings/route.ts` | 修正 | GET の findMany に `include: { case, talent }` 追加 |
| `src/app/api/matchings/__tests__/route.test.ts` | 修正 | include 追加に対応したテスト追加 |
| `src/lib/schemas/matching.ts` | 修正 | `MatchingQuerySchema` の limit 上限を 500 に拡張 |
| `src/app/api/emails/fetch/route.ts` | 修正 | 取込完了後に generate を fire-and-forget で呼び出し |
| `src/app/(main)/matching/page.tsx` | 修正 | API接続・生成ボタン・提案モーダル・一括送信モーダル |
| `src/data/matching.ts` | 削除 | モックデータ不要 |

---

## `matching-generator.ts`

`email-parser.ts` と同じ Claude tool_use パターンで実装する。

### 関数シグネチャ

```ts
import type { Case, Talent } from '@prisma/client'

export type MatchingEvaluation = {
  score: number           // 0-100
  skillMatchRate: number  // 0-100
  unitPriceOk: boolean
  timingOk: boolean
  locationOk: boolean
  costPrice: number       // 万円整数（talent.desiredRate ベース）
  sellPrice: number       // 万円整数（case.unitPrice）
  grossProfitRate: number // 0.0-1.0
  grossProfitOk: boolean  // grossProfitRate >= 0.1
  reason: string          // 推薦理由（日本語）
  isAutoSend: boolean     // score >= 85 かつ unitPriceOk && timingOk && locationOk
}

export async function evaluateMatching(
  caseRecord: Case,
  talent: Talent
): Promise<MatchingEvaluation>
```

### Claude プロンプト

`startDate` と `availableFrom` は `Date` 型なので `toLocaleDateString('ja-JP')` でフォーマットしてプロンプトに埋め込む。

```
以下のSES案件と人材のマッチングを評価してください。

【案件】
タイトル: {title}
必須スキル: {skills.join(', ')}
単価: {unitPrice}万円
開始時期: {startDate.toLocaleDateString('ja-JP')}
勤務形態: {workStyle}

【人材】
名前: {name}
スキル: {skills.join(', ')}
経験年数: {experience}年
希望単価: {desiredRate}万円
勤務形態: {workStyle}
稼働可能日: {availableFrom ? availableFrom.toLocaleDateString('ja-JP') : '即日'}
```

### Tool 定義

```ts
{
  name: 'evaluate_matching',
  description: 'SES案件と人材のマッチングを評価して数値化する',
  input_schema: {
    type: 'object',
    properties: {
      score:           { type: 'integer', description: '総合スコア 0-100' },
      skillMatchRate:  { type: 'integer', description: 'スキル一致率 0-100' },
      unitPriceOk:     { type: 'boolean', description: '単価が折り合うか（±10万円以内）' },
      timingOk:        { type: 'boolean', description: '開始時期が2ヶ月以内に合うか' },
      locationOk:      { type: 'boolean', description: '勤務形態が一致するか' },
      costPrice:       { type: 'integer', description: '人材コスト（talent.desiredRate）' },
      sellPrice:       { type: 'integer', description: '販売価格（case.unitPrice）' },
      grossProfitRate: { type: 'number',  description: '粗利率 (sellPrice - costPrice) / sellPrice' },
      grossProfitOk:   { type: 'boolean', description: '粗利率が10%以上か' },
      reason:          { type: 'string',  description: '推薦理由（日本語・100文字程度）' },
      isAutoSend:      { type: 'boolean', description: 'score>=85 かつ unitPriceOk && timingOk && locationOk' },
    },
    required: ['score','skillMatchRate','unitPriceOk','timingOk','locationOk','costPrice','sellPrice','grossProfitRate','grossProfitOk','reason','isAutoSend'],
  },
}
```

### リトライ

email-parser.ts と同様に失敗時1回リトライ。

---

## `POST /api/matchings/generate`

### 認可

`requireAuth` で認証チェック後、`isAdmin` チェックは行わない（STAFF・ADMIN 両方が実行可能）。

### 処理フロー

1. `requireAuth` で認証チェック（未認証は 401）
2. OPEN案件 + AVAILABLE人材を全件取得
3. 既存マッチングの `[caseId, talentId]` セットを取得
4. **既存マッチングが存在する組み合わせはスキップ**（`skipped` カウントを増やす）
5. 未マッチング組み合わせのみ `evaluateMatching` を呼び出し
6. `evaluateMatching` の結果で `isAutoSend: true` の場合は `status: 'PENDING_AUTO'`、それ以外は `status: 'UNPROPOSED'` で `prisma.matching.create` で保存
7. 生成件数・スキップ件数を返す

### レスポンス

```json
{ "success": true, "data": { "generated": 12, "skipped": 5 } }
```

### 注意

- 同期処理（await）。現状の件数規模では問題ない。
- 既存マッチングは**スキップ**（上書きしない）。再生成が必要な場合は将来的に `?force=true` オプションを検討。

---

## `MatchingQuerySchema` の修正（`src/lib/schemas/matching.ts`）

現在 `limit` の上限が 100 になっている。500 に拡張する：

```ts
// 変更前
limit: z.coerce.number().min(1).max(100).default(20)

// 変更後
limit: z.coerce.number().min(1).max(500).default(20)
```

---

## `GET /api/matchings` の修正

`findMany` に `include` を追加してネストした case/talent を返す：

```ts
prisma.matching.findMany({
  where,
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
  include: {
    case:   { select: { id: true, title: true, client: true, unitPrice: true, workStyle: true, startDate: true } },
    talent: { select: { id: true, name: true, skills: true, desiredRate: true, agencyEmail: true } },
  },
})
```

---

## `emails/fetch/route.ts` の修正

`runIngestion()` 完了後、マッチング生成を fire-and-forget で呼び出す：

```ts
const internalKey = process.env.INTERNAL_API_KEY
const result = await runIngestion()

// 自動マッチング生成（fire and forget）
fetch(`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/matchings/generate`, {
  method: 'POST',
  headers: internalKey ? { Authorization: `Bearer ${internalKey}` } : {},
}).catch(() => { /* 失敗しても取込結果に影響させない */ })

return ok(result)
```

なお、`/api/matchings/generate` は通常の `requireAuth`（セッション認証）を使うため、内部キーによる認証は現時点では不要。上記の `Authorization` ヘッダーは将来の拡張のために残す。

---

## `matching/page.tsx` の変更

### 型定義

```ts
type MatchingItem = {
  id: string
  score: number
  skillMatchRate: number
  unitPriceOk: boolean
  timingOk: boolean
  locationOk: boolean
  grossProfitOk: boolean
  reason: string | null
  isAutoSend: boolean
  status: 'UNPROPOSED' | 'PENDING_AUTO' | 'SENT' | 'REPLIED' | 'INTERVIEWING' | 'CONTRACTED' | 'REJECTED'
  case: { id: string; title: string; client: string; unitPrice: number; workStyle: string; startDate: string }
  talent: { id: string; name: string; skills: string[]; desiredRate: number; agencyEmail: string | null }
}
```

### 状態管理

```ts
const [matchings, setMatchings] = useState<MatchingItem[]>([])
const [loading, setLoading] = useState(true)
const [generating, setGenerating] = useState(false)

// 提案モーダル
const [proposalTarget, setProposalTarget] = useState<MatchingItem | null>(null)
const [proposalTo, setProposalTo] = useState('')
const [proposalSubject, setProposalSubject] = useState('')
const [proposalBody, setProposalBody] = useState('')
const [proposalSending, setProposalSending] = useState(false)

// 一括送信モーダル
const [bulkModalOpen, setBulkModalOpen] = useState(false)
const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
const [bulkSending, setBulkSending] = useState(false)
```

### マッチング生成ボタン

```tsx
<button onClick={handleGenerate} disabled={generating}>
  {generating ? '生成中...' : '⚡ AIマッチング生成'}
</button>
```

`handleGenerate`:
1. `POST /api/matchings/generate` を呼び出し
2. 完了後 `loadMatchings()` でデータ再取得
3. 生成件数を `alert` で表示（例：「12件のマッチングを生成しました」）

### タブフィルタ

| タブ | 条件 |
|---|---|
| 全件 | 全件 |
| 自動送信候補 | `isAutoSend: true` |
| 高スコア | `score >= 80` |
| 提案済み | `status` が `SENT` / `REPLIED` / `INTERVIEWING` / `CONTRACTED` |

### 提案モーダル

「提案する」ボタン押下 → `openProposalModal(item)`:
- `proposalTo` = `talent.agencyEmail ?? ''`
- `proposalSubject` = `【ご提案】${case.title} × ${talent.name}`
- `proposalBody` = reason をベースにしたテンプレート文

モーダル内の「コピーして送信済みにする」ボタン:
1. 本文をクリップボードにコピー（`navigator.clipboard.writeText`）
2. `PATCH /api/matchings/${id}` で status を `SENT` に更新
3. モーダルを閉じ、一覧を再取得

※ 実際のメール送信は既存インフラ確認後に対応。今回はコピー＋ステータス更新。

### 一括送信モーダル

「⚡ 自動送信候補を一括送信」ボタン押下 → `bulkModalOpen = true`:
- `isAutoSend: true` のマッチング一覧をチェックボックス付きで表示
- デフォルトで全チェック済み
- 「コピーして一括送信済みにする」ボタン → チェック済みを順次 `SENT` に更新、本文を連結クリップボードコピー

---

## UI スタイル

既存の `matching/page.tsx` のスタイルをそのまま踏襲する（`bg-vatch-surface`、`border-vatch-border` 等）。モーダルは既存の `Modal.tsx` を再利用（`panelClassName="max-w-2xl"`）。

---

## ステータス表示マッピング

| MatchingStatus | 日本語 | スタイル |
|---|---|---|
| UNPROPOSED | 未提案 | slate |
| PENDING_AUTO | 自動送信待ち | green（animate-pulse） |
| SENT | 提案中 | sky |
| REPLIED | 返答待ち | amber |
| INTERVIEWING | 面談調整中 | purple |
| CONTRACTED | 成約 | green |
| REJECTED | 不採用 | red |

---

## Out of Scope

- 実際のメール送信（Gmail API 統合）→ 今回はクリップボードコピー＋ステータス更新
- マッチングの手動作成（個別の案件×人材指定）
- マッチングの削除UI
- ページネーション（limit=500 で全件取得）
- `Proposal` テーブルへの書き込み（将来の提案管理機能で対応）
- マッチング再生成（`?force=true` で既存を上書き）→ 将来対応
