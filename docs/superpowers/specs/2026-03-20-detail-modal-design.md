# 詳細モーダル実装 Design Spec

## Goal

案件管理・人材管理の一覧画面にある「詳細」ボタンを押したとき、詳細情報をモーダルで表示し、インラインで編集できるようにする。

## Architecture

共通の `Modal` ラッパーコンポーネントを作り、各ページが詳細コンテンツを内包する形で実装する。モーダル状態は各ページの `useState` で管理（グローバルstate不要）。

## Files

- **Create:** `src/components/ui/Modal.tsx` — オーバーレイ・ESCキー・閉じる処理の共通ラッパー
- **Modify:** `src/app/(main)/cases/page.tsx` — 案件詳細モーダル追加
- **Modify:** `src/app/(main)/talents/page.tsx` — 人材詳細モーダル追加

## Modal Component (`Modal.tsx`)

```tsx
// Props
type ModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}
```

- `open=false` のとき何もレンダリングしない
- オーバーレイ（背景暗転）クリックで `onClose` 呼び出し
- ESCキーで `onClose` 呼び出し（`useEffect` で keydown イベント登録）
- `z-50` でスタックトップに表示

## 案件詳細モーダル

### 状態管理

```tsx
const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
const [editing, setEditing] = useState(false)
const [editForm, setEditForm] = useState<Partial<CaseItem>>({})
const [saving, setSaving] = useState(false)
```

### 表示モード（editing=false）

ヘッダー右：「編集」ボタン + 「✕」

フィールド一覧：
| フィールド | 表示内容 |
|---|---|
| 案件名 | テキスト |
| クライアント | テキスト |
| クライアントメール | テキスト（未設定は「—」） |
| スキル | バッジ群 |
| 単価 | `{n}万円` |
| 開始時期 | `toLocaleDateString('ja-JP')` |
| 勤務形式 | WORK_STYLE_CONFIG のバッジ |
| ステータス | STATUS_CONFIG のバッジ |
| 登録日時 | `toLocaleDateString('ja-JP')` |

### 編集モード（editing=true）

「編集」クリック時に `setEditForm({ ...selectedCase })` でフォームを初期化。

ヘッダー右：「保存」ボタン + 「キャンセル」ボタン

編集可能フィールド（`skills` は今回スコープ外）：
- `title` — text input
- `client` — text input
- `clientEmail` — email input（任意）
- `unitPrice` — number input（万円）
- `startDate` — date input
- `workStyle` — select（REMOTE/ONSITE/HYBRID）
- `status` — select（OPEN/MATCHING/PROPOSING/INTERVIEWING/CONTRACTED/CLOSED）

### 保存処理

```
PATCH /api/cases/[id]
Body: { title, client, clientEmail, unitPrice, startDate, workStyle, status }
```

成功時：
1. `selectedCase` を更新（レスポンスの `data` で上書き）
2. `cases` リストも同IDのレコードを更新（再フェッチ不要）
3. `editing = false` に戻す

エラー時：コンソールエラー、`saving = false`（モーダルはそのまま）

### キャンセル

`setEditing(false)` のみ（`editForm` はそのまま、次に編集ボタン押したとき再初期化）

### モーダルを閉じるとき

`setSelectedCase(null)` + `setEditing(false)`

## 人材詳細モーダル

案件と同じパターン。状態変数名を `selectedTalent` / `editForm` 等に変更。

### 表示フィールド

| フィールド | 表示内容 |
|---|---|
| 氏名 | テキスト |
| 居住地 | テキスト |
| スキル | バッジ群 |
| 経験年数 | `{n}年` |
| 希望単価 | `{n}万円` |
| 勤務形式 | WORK_STYLE_CONFIG のバッジ |
| ステータス | STATUS_CONFIG のバッジ |
| 紹介元メール | テキスト（未設定は「—」） |
| 登録日時 | `toLocaleDateString('ja-JP')` |

### 編集可能フィールド（`skills` スコープ外）

- `name` — text input
- `location` — text input
- `experience` — number input（年）
- `desiredRate` — number input（万円）
- `workStyle` — select
- `status` — select（AVAILABLE/ACTIVE/NEGOTIATING/ENDING_SOON/INACTIVE）
- `agencyEmail` — email input（任意）

### 保存処理

```
PATCH /api/talents/[id]
```

成功・エラー・キャンセルの挙動は案件と同じ。

## UI Style

- モーダル幅：`max-w-xl`（約576px）
- 背景：`bg-vatch-surface border border-vatch-border rounded-xl`
- フォームフィールド：既存の検索input と同じスタイル（`bg-vatch-surface border border-vatch-border`、フォーカス時 `border-[#38bdf8]`）
- 「保存」ボタン：`bg-[#38bdf8] text-black`
- 「編集」「キャンセル」：`border border-vatch-border text-vatch-muted hover:border-[#38bdf8]`

## Out of Scope

- `skills` フィールドの編集（タグ入力UIは別タスク）
- 削除機能
- 楽観的UI更新（保存完了を待ってから表示更新）
