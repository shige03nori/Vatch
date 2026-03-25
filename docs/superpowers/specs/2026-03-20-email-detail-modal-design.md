# メール取込 詳細モーダル Design Spec

## Goal

メール取込画面の「詳細」ボタンを押したとき、メール原本情報（件名・差出人・本文）と AI 解析結果、関連する案件/人材をモーダルで表示する。読み取り専用。

## Architecture

既存の `Modal.tsx` を再利用。詳細ボタン押下時に `GET /api/emails/[id]` を呼び出し、完全なメールデータ（`bodyText`・`cases`・`talents` のリレーション含む）を取得してモーダルに表示する。状態は `EmailsPage` の `useState` で管理。

## Files

- **Modify:** `src/components/ui/Modal.tsx` — `panelClassName` prop を追加してパネル幅をオーバーライド可能にする
- **Modify:** `src/app/api/emails/[id]/route.ts` — GET ハンドラに `include: { cases: true, talents: true }` を追加
- **Modify:** `src/app/(main)/emails/page.tsx` — 詳細モーダル追加

---

## Modal コンポーネント変更 (`src/components/ui/Modal.tsx`)

`panelClassName` prop を追加し、パネルの幅クラスをオーバーライドできるようにする。

```tsx
type ModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  panelClassName?: string  // 追加
}
```

パネル div のクラスを変更：

```tsx
// 変更前
className="relative z-10 w-full max-w-xl mx-4"

// 変更後
className={`relative z-10 w-full mx-4 ${panelClassName ?? 'max-w-xl'}`}
```

**既存の `cases/page.tsx` と `talents/page.tsx` は `panelClassName` を渡さないため `max-w-xl` のまま動作する（後方互換）。**

---

## API 変更 (`src/app/api/emails/[id]/route.ts`)

GET の `findUnique` にリレーションを追加：

```ts
const record = await prisma.email.findUnique({
  where: { id },
  include: {
    cases:   { select: { id: true, title: true } },
    talents: { select: { id: true, name: true } },
  },
})
```

返却される追加フィールド：
- `cases: { id: string; title: string }[]`
- `talents: { id: string; name: string }[]`

---

## 画面側 (`src/app/(main)/emails/page.tsx`)

### 型定義

```tsx
type EmailDetail = EmailItem & {
  fromEmail: string
  bodyText: string
  cases:   { id: string; title: string }[]
  talents: { id: string; name: string }[]
  createdAt: string
}
```

`EmailItem` には `fromEmail` が含まれていないため、`EmailDetail` で拡張する。`setSelectedEmail(json.data as EmailDetail)` のように型アサーションを使う（APIレスポンスの形がPrismaモデルと一致するため安全）。

### 状態管理

```tsx
const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)
const [detailLoading, setDetailLoading] = useState(false)
const [detailError, setDetailError] = useState<string | null>(null)
```

### 詳細ボタン押下時の処理

```tsx
async function handleDetail(id: string) {
  setDetailLoading(true)
  setDetailError(null)
  try {
    const res = await fetch(`/api/emails/${id}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error?.message ?? '詳細の取得に失敗しました')
    setSelectedEmail(json.data as EmailDetail)
  } catch (err) {
    setDetailError(err instanceof Error ? err.message : '詳細の取得に失敗しました')
  } finally {
    setDetailLoading(false)
  }
}
```

`detailError` が非 null のとき、テーブル上部などに赤いエラーメッセージを表示する（または `alert` で代替可）。

`detailLoading` 中は**全行の詳細ボタンを `disabled`** にする（シンプルさを優先）。

```tsx
<button
  onClick={() => handleDetail(item.id)}
  disabled={detailLoading}
  className="..."
>
  詳細
</button>
```

### closeModal

```tsx
const closeModal = useCallback(() => setSelectedEmail(null), [])
```

`useCallback` でラップ（Modal の `useEffect` 依存配列に入るため）。

---

## モーダル UI

**幅：** `panelClassName="max-w-2xl"` を Modal に渡す（本文が長いため案件モーダルより少し広め）

**ヘッダー：** 件名（`subject`）+ ✕ 閉じるボタン（編集ボタンなし）

```tsx
<Modal open={selectedEmail !== null} onClose={closeModal} panelClassName="max-w-2xl">
  <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
      <h2 id="modal-title" className="text-base font-bold text-white truncate pr-4">
        {selectedEmail?.subject}
      </h2>
      <button onClick={closeModal} className="text-vatch-muted hover:text-white transition-colors text-lg leading-none" aria-label="閉じる">
        ✕
      </button>
    </div>
    <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
      {/* セクション1〜4 */}
    </div>
  </div>
</Modal>
```

### セクション1 — メール情報

2カラムグリッド：

| フィールド | 表示 |
|---|---|
| 差出人 | `from`（表示名）+ `fromEmail`（メールアドレス、小さめテキスト） |
| 受信日時 | `new Date(receivedAt).toLocaleString('ja-JP')` |
| 種別 | `TypeBadge` コンポーネント再利用 |
| ステータス | `StatusBadge` コンポーネント再利用 |
| AI信頼度 | `ConfidenceBar` コンポーネント再利用 / null の場合は「—」 |

### セクション2 — AI解析結果

- **抽出名：** `extractedName`（null の場合は「—」）
- **スキル：** バッジ群（スキルなしの場合は「—」）

### セクション3 — メール本文

```tsx
<pre className="whitespace-pre-wrap text-xs text-vatch-muted font-mono bg-vatch-bg rounded-lg p-3 max-h-60 overflow-y-auto border border-vatch-border">
  {selectedEmail.bodyText || '（本文なし）'}
</pre>
```

- `max-h-60`（240px）でスクロール可能

### セクション4 — 関連する案件/人材

案件詳細ページ（`/cases/[id]`）は未実装のため、一覧ページ（`/cases`・`/talents`）へのリンクとする。将来、詳細ページが実装された際にリンク先を変更する。

```tsx
{selectedEmail.cases.length > 0 && (
  <div>
    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-2">関連する案件</div>
    {selectedEmail.cases.map((c) => (
      <Link key={c.id} href="/cases" className="block text-sm text-vatch-cyan hover:underline">
        {c.title}
      </Link>
    ))}
  </div>
)}
{selectedEmail.talents.length > 0 && (
  <div>
    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-2">関連する人材</div>
    {selectedEmail.talents.map((t) => (
      <Link key={t.id} href="/talents" className="block text-sm text-vatch-purple hover:underline">
        {t.name}
      </Link>
    ))}
  </div>
)}
{selectedEmail.cases.length === 0 && selectedEmail.talents.length === 0 && (
  <p className="text-sm text-vatch-muted">関連する案件・人材はありません</p>
)}
```

---

## UI スタイル

- モーダル背景：`bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden`
- モーダル本文エリア：`max-h-[80vh] overflow-y-auto`（長い本文でもスクロール）
- セクション区切り：`border-t border-vatch-border pt-4 mt-4`
- フィールドラベル：`text-[10px] text-vatch-muted uppercase tracking-wide mb-1`

---

## Out of Scope

- メール削除機能
- メール本文の編集
- 案件/人材の個別詳細ページへのリンク（詳細ページ未実装のため）
- メール本文の HTML レンダリング（テキストのみ）
