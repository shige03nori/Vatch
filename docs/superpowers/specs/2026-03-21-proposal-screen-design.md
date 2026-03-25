# 提案メール画面 Design Spec

## Goal

提案メール画面をモックデータから実 API に接続し、マッチング画面の「提案する」から Proposal レコードを作成・管理できるようにする。

## Architecture

マッチング画面の「コピーして送信済みにする」ボタン押下時に `POST /api/proposals` で Proposal レコードを作成する。提案メール画面は `GET /api/proposals`（matching/case/talent ネスト追加）に接続し、提案一覧の閲覧・本文編集・ステータス更新を実装する。

## Files

| ファイル | 変更 | 役割 |
|---|---|---|
| `src/lib/schemas/proposal.ts` | 修正 | `CreateProposalSchema` に `status` フィールドを追加 |
| `src/app/api/proposals/route.ts` | 修正 | GET の findMany に `include: { matching: { case, talent } }` 追加 |
| `src/app/api/proposals/__tests__/route.test.ts` | 修正 | include 対応テスト追加 |
| `src/app/(main)/matching/page.tsx` | 修正 | 「コピーして送信済みにする」で `POST /api/proposals` も呼ぶ |
| `src/app/(main)/proposals/page.tsx` | 全面書き直し | モックデータ削除、実 API 接続 |
| `src/data/proposals.ts` | 削除 | モックデータ不要 |

---

## `GET /api/proposals` の修正

`findMany` に `include` を追加してネストした matching/case/talent を返す：

```ts
prisma.proposal.findMany({
  where,
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
  include: {
    matching: {
      include: {
        case:   { select: { id: true, title: true, client: true, unitPrice: true } },
        talent: { select: { id: true, name: true, skills: true, desiredRate: true } },
      },
    },
  },
})
```

---

## `CreateProposalSchema` の修正

`src/lib/schemas/proposal.ts` の `CreateProposalSchema` に `status` フィールドを追加する：

```ts
export const CreateProposalSchema = z.object({
  matchingId:      z.string().cuid(),
  to:              z.string().email(),
  cc:              z.string().email().optional(),
  subject:         z.string().min(1),
  bodyText:        z.string().min(1),
  status:          z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).default('DRAFT'),
  costPrice:       z.number().int().positive(),
  sellPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
  isAutoSend:      z.boolean().default(false),
})
```

---

## マッチング画面の修正

### 「コピーして送信済みにする」の拡張

現行の処理フロー：
1. クリップボードコピー
2. `PATCH /api/matchings/{id}` → status: SENT

変更後のフロー：
1. クリップボードコピー
2. `POST /api/proposals` → Proposal 作成（下記フィールド）
3. `PATCH /api/matchings/{id}` → status: SENT

Proposal 作成失敗時はアラートで通知するが、マッチング status 更新は続行する。

### `POST /api/proposals` のリクエストボディ

```ts
{
  matchingId:      proposalTarget.id,
  to:              proposalTo,
  subject:         proposalSubject,
  bodyText:        proposalBody,
  status:          'SENT',                       // 手動送信済みとして作成
  costPrice:       proposalTarget.costPrice,    // matching.costPrice（万円整数）
  sellPrice:       proposalTarget.sellPrice,    // matching.sellPrice（万円整数）
  grossProfitRate: proposalTarget.grossProfitRate,
  isAutoSend:      false,
}
```

cc は空欄（未入力）のため送信しない。

---

## `proposals/page.tsx` の変更

### 型定義

```ts
type ProposalItem = {
  id: string
  to: string
  cc: string | null
  subject: string
  bodyText: string
  status: 'DRAFT' | 'PENDING_AUTO' | 'SENT' | 'REPLIED' | 'REJECTED'
  isAutoSend: boolean
  costPrice: number
  sellPrice: number
  grossProfitRate: number
  sentAt: string | null
  createdAt: string
  matching: {
    id: string
    score: number
    reason: string | null
    case: { id: string; title: string; client: string; unitPrice: number }
    talent: { id: string; name: string; skills: string[]; desiredRate: number }
  }
}
```

### 状態管理

```ts
const [proposals, setProposals] = useState<ProposalItem[]>([])
const [loading, setLoading] = useState(true)
const [selected, setSelected] = useState<ProposalItem | null>(null)
const [toValue, setToValue] = useState('')
const [ccValue, setCcValue] = useState('')
const [subjectValue, setSubjectValue] = useState('')
const [bodyValue, setBodyValue] = useState('')
const [saving, setSaving] = useState(false)
```

### データ取得

```ts
async function loadProposals(currentSelectedId?: string) {
  const res = await fetch('/api/proposals?limit=100')
  const json = await res.json()
  const data: ProposalItem[] = json.data
  setProposals(data)
  if (currentSelectedId) {
    // 保存・更新後: selected を新鮮なデータで引き直す
    const refreshed = data.find((p) => p.id === currentSelectedId)
    if (refreshed) handleSelect(refreshed)
  } else if (data.length > 0) {
    handleSelect(data[0])
  }
}
```

初回マウント時は引数なしで呼び出す。保存・ステータス更新後は `selected.id` を渡して選択アイテムを最新データで更新する。

### 提案選択時の処理

```ts
function handleSelect(item: ProposalItem) {
  setSelected(item)
  setToValue(item.to)
  setCcValue(item.cc ?? '')
  setSubjectValue(item.subject)
  setBodyValue(item.bodyText)
}
```

### 本文保存

「保存」ボタン → `PATCH /api/proposals/{id}` で subject・bodyText を更新。`to` フィールドの変更は保存しない（Out of Scope）：

```ts
async function handleSave() {
  if (!selected || saving) return
  setSaving(true)
  try {
    const res = await fetch(`/api/proposals/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subjectValue, bodyText: bodyValue }),
    })
    if (!res.ok) throw new Error()
    await loadProposals(selected.id)
  } catch {
    alert('保存に失敗しました')
  } finally {
    setSaving(false)
  }
}
```

### ステータス更新

二重送信防止のため `saving` フラグを共用する：

```ts
async function handleStatusUpdate(status: 'REPLIED' | 'REJECTED') {
  if (!selected || saving) return
  setSaving(true)
  try {
    const res = await fetch(`/api/proposals/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error()
    await loadProposals(selected.id)
  } catch {
    alert('ステータスの更新に失敗しました')
  } finally {
    setSaving(false)
  }
}
```

---

## UI レイアウト

### 左サイドバー（200px）

- `PROPOSAL QUEUE` ヘッダー + 件数
- 各アイテム（`QueueItem` コンポーネント）:
  - 案件名（truncate）
  - クライアント名 / 人材名
  - AIスコア + 粗利率
  - ステータスバッジ

### 右メインエリア（flex-1）

メール編集カード:
- カードヘッダー: 「⚡ AI Generated」バッジ + AIスコア
- 宛先・CC・件名: 編集可能 `<input>`
- 本文: 編集可能 `<textarea>`
- フッター: 「保存」ボタン（`saving` 中は disabled）

### 右サイドパネル（260px）

**粗利チェックパネル:**
- 粗利率（大文字）+ バー + 仕入値・売値・粗利額

**マッチング情報パネル:**
- 案件名、人材名、AIスコア、ステータス

**アクションパネル:**
- 「📋 本文コピー」→ `navigator.clipboard.writeText(bodyValue)`
- 「↩ 返答あり」→ `handleStatusUpdate('REPLIED')`（SENT 時のみ有効）
- 「✗ 不採用」→ `handleStatusUpdate('REJECTED')`（SENT・REPLIED 時のみ有効）

---

## ステータス表示マッピング

| ProposalStatus | 日本語 | スタイル |
|---|---|---|
| DRAFT | 下書き | slate |
| PENDING_AUTO | 自動送信待ち | cyan |
| SENT | 提案中 | blue |
| REPLIED | 返答あり | amber |
| REJECTED | 不採用 | red |

---

## UI スタイル

既存の `proposals/page.tsx` のスタイルをそのまま踏襲する（`bg-vatch-surface`、`border-vatch-border` 等）。

---

## Out of Scope

- 実際のメール送信（Gmail API 統合）→ クリップボードコピー＋ステータス更新のみ
- DRAFT・PENDING_AUTO ステータスの Proposal 新規作成 UI（マッチング画面から作成）
- 一括ステータス更新
- ページネーション（limit=100 で全件取得）
- `to`・CC フィールドの変更保存（保存時は subject・bodyText のみ更新、宛先は表示のみ）
