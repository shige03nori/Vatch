# 詳細モーダル実装 Design Spec

## Goal

案件管理・人材管理の一覧画面にある「詳細」ボタンを押したとき、詳細情報をモーダルで表示し、インラインで編集できるようにする。

## Architecture

共通の `Modal` ラッパーコンポーネントを作り、各ページが詳細コンテンツを内包する形で実装する。モーダル状態は各ページの `useState` で管理（グローバルstate不要）。

## Files

- **Create:** `src/components/ui/Modal.tsx` — オーバーレイ・ESCキー・フォーカストラップ・閉じる処理の共通ラッパー
- **Modify:** `src/app/(main)/cases/page.tsx` — 案件詳細モーダル追加
- **Modify:** `src/app/(main)/talents/page.tsx` — 人材詳細モーダル追加

---

## Modal Component (`src/components/ui/Modal.tsx`)

```tsx
type ModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}
```

- `open=false` のときは `null` を返す（DOMにマウントしない）
- オーバーレイ（背景暗転）クリックで `onClose` 呼び出し
- ESCキーで `onClose` 呼び出し（`useEffect` で keydown イベント登録、クリーンアップも必須）
- **フォーカストラップ：** `open=true` になった瞬間、モーダル内の最初のフォーカス可能要素（閉じるボタン）に `autoFocus` を当てる。Tab/Shift+Tab がモーダル外に出ないよう keydown でフォーカスをループさせる
- **aria属性：** ルート要素に `role="dialog"` `aria-modal="true"` `aria-labelledby="modal-title"` を付ける
- モーダルパネルのクリックは `e.stopPropagation()` でオーバーレイへの伝播を止める

---

## 案件詳細モーダル

### 状態管理

```tsx
const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
const [editing, setEditing] = useState(false)
const [editForm, setEditForm] = useState<Partial<EditCaseForm>>({})
const [saving, setSaving] = useState(false)
const [saveError, setSaveError] = useState<string | null>(null)
```

`EditCaseForm` 型：

```tsx
type EditCaseForm = {
  title: string
  client: string
  clientEmail: string
  unitPrice: number
  startDate: string   // YYYY-MM-DD 形式（date inputと互換）
  workStyle: WorkStyle
  status: CaseStatus
}
```

### モーダルを開くとき

`selectedCase` がセットされたら（`useEffect([selectedCase])`）：
- `setEditing(false)`
- `setEditForm(toEditForm(selectedCase))` で初期化

`toEditForm` ヘルパー（ページ内に定義）：

```tsx
function toEditForm(c: CaseItem): EditCaseForm {
  return {
    title: c.title,
    client: c.client,
    clientEmail: c.clientEmail ?? '',
    unitPrice: c.unitPrice,
    startDate: c.startDate.slice(0, 10),   // ISO → YYYY-MM-DD
    workStyle: c.workStyle,
    status: c.status,
  }
}
```

### モーダルを閉じるとき

```tsx
function closeModal() {
  setSelectedCase(null)
  setEditing(false)
  setSaveError(null)
}
```

### 表示モード（`editing=false`）

**ヘッダー（`id="modal-title"`）：** 案件名 + 右側に「編集」ボタン + 「✕」閉じるボタン

フィールド一覧：

| フィールド | 表示 |
|---|---|
| 案件名 | テキスト（ヘッダーに表示済みのため省略可） |
| クライアント | テキスト |
| クライアントメール | テキスト（未設定は「—」） |
| スキル | バッジ群（`STATUS_CONFIG` 等と同じスタイル） |
| 単価 | `{n}万円` |
| 開始時期 | `new Date(startDate).toLocaleDateString('ja-JP')` |
| 勤務形式 | `WORK_STYLE_CONFIG` のバッジ |
| ステータス | `STATUS_CONFIG` のバッジ |
| 登録日時 | `new Date(createdAt).toLocaleDateString('ja-JP')` |

### 編集モード（`editing=true`）

「編集」クリック時：`setEditing(true)` のみ（`editForm` はモーダルオープン時に初期化済み）

**ヘッダー：** 案件名（表示のまま）+ 右側に「キャンセル」「保存」ボタン

- 保存ボタンは `saving=true` の間 `disabled` にし、テキストを「保存中...」に変える
- `saveError` が非nullの場合、フォームの下部に赤いエラーテキストを表示：`<p className="text-red-400 text-xs mt-2">{saveError}</p>`

編集可能フィールド：

| フィールド | input種別 |
|---|---|
| `title` | `type="text"` |
| `client` | `type="text"` |
| `clientEmail` | `type="email"`（任意） |
| `unitPrice` | `type="number" min="1"` |
| `startDate` | `type="date"`（`YYYY-MM-DD` 形式） |
| `workStyle` | `<select>`（REMOTE/ONSITE/HYBRID） |
| `status` | `<select>`（OPEN/MATCHING/PROPOSING/INTERVIEWING/CONTRACTED/CLOSED） |

`skills` は今回スコープ外（表示のみ）。

### 保存処理

```tsx
async function handleSave() {
  if (!selectedCase) return
  setSaving(true)
  setSaveError(null)
  try {
    const res = await fetch(`/api/cases/${selectedCase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        startDate: new Date(editForm.startDate!).toISOString(),  // YYYY-MM-DD → ISO
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました')
    // リストと selectedCase を更新
    const updated: CaseItem = json.data
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setSelectedCase(updated)
    setEditing(false)
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : '保存に失敗しました')
  } finally {
    setSaving(false)
  }
}
```

### キャンセル

```tsx
setEditing(false)
setSaveError(null)
setEditForm(toEditForm(selectedCase!))  // 編集中の変更を破棄して元の値に戻す
```

---

## 人材詳細モーダル

同じパターン。以下に人材固有の仕様を記載。

### 状態管理

```tsx
const [selectedTalent, setSelectedTalent] = useState<TalentItem | null>(null)
const [editing, setEditing] = useState(false)
const [editForm, setEditForm] = useState<Partial<EditTalentForm>>({})
const [saving, setSaving] = useState(false)
const [saveError, setSaveError] = useState<string | null>(null)
```

`EditTalentForm` 型：

```tsx
type EditTalentForm = {
  name: string
  location: string
  experience: number
  desiredRate: number
  workStyle: WorkStyle
  status: TalentStatus
  agencyEmail: string
}
```

### `toEditForm` ヘルパー（人材版）

```tsx
function toEditForm(t: TalentItem): EditTalentForm {
  return {
    name: t.name,
    location: t.location,
    experience: t.experience,
    desiredRate: t.desiredRate,
    workStyle: t.workStyle,
    status: t.status,
    agencyEmail: t.agencyEmail ?? '',
  }
}
```

`startDate` フィールドは人材には存在しないため、日付変換は不要。

### 表示フィールド

| フィールド | 表示 |
|---|---|
| 氏名 | テキスト（ヘッダーに表示） |
| 居住地 | テキスト |
| スキル | バッジ群 |
| 経験年数 | `{n}年` |
| 希望単価 | `{n}万円` |
| 勤務形式 | `WORK_STYLE_CONFIG` のバッジ |
| ステータス | `STATUS_CONFIG` のバッジ |
| 紹介元メール | テキスト（未設定は「—」） |
| 登録日時 | `toLocaleDateString('ja-JP')` |

### 編集可能フィールド

| フィールド | input種別 |
|---|---|
| `name` | `type="text"` |
| `location` | `type="text"` |
| `experience` | `type="number" min="0"` |
| `desiredRate` | `type="number" min="1"` |
| `workStyle` | `<select>`（REMOTE/ONSITE/HYBRID） |
| `status` | `<select>`（AVAILABLE/ACTIVE/NEGOTIATING/ENDING_SOON/INACTIVE） |
| `agencyEmail` | `type="email"`（任意） |

`skills` は今回スコープ外。

### 保存処理

```tsx
async function handleSave() {
  if (!selectedTalent) return
  setSaving(true)
  setSaveError(null)
  try {
    const res = await fetch(`/api/talents/${selectedTalent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました')
    const updated: TalentItem = json.data
    setTalents((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelectedTalent(updated)
    setEditing(false)
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : '保存に失敗しました')
  } finally {
    setSaving(false)
  }
}
```

---

## UI Style

- モーダル幅：`max-w-xl w-full`（約576px）
- 背景：`bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl`
- フォームフィールド：`w-full bg-vatch-surface border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors`
- 「保存」ボタン：`bg-[#38bdf8] text-black text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50`
- 「編集」「キャンセル」：`border border-vatch-border text-vatch-muted text-xs px-3 py-1.5 rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors`

---

## Out of Scope

- `skills` フィールドの編集（タグ入力UIは別タスク）
- 削除機能
- 楽観的UI更新（保存完了を待ってから表示を更新する）
