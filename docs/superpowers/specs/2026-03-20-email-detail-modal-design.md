# メール取込 詳細モーダル Design Spec

## Goal

メール取込画面の「詳細」ボタンを押したとき、メール原本情報（件名・差出人・本文）と AI 解析結果、関連する案件/人材をモーダルで表示する。読み取り専用。

## Architecture

既存の `Modal.tsx` を再利用。詳細ボタン押下時に `GET /api/emails/[id]` を呼び出し、完全なメールデータ（`bodyText`・`cases`・`talents` のリレーション含む）を取得してモーダルに表示する。状態は `EmailsPage` の `useState` で管理。

## Files

- **Modify:** `src/app/api/emails/[id]/route.ts` — GET ハンドラに `include: { cases: true, talents: true }` を追加
- **Modify:** `src/app/(main)/emails/page.tsx` — 詳細モーダル追加

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

### 状態管理

```tsx
const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)
const [detailLoading, setDetailLoading] = useState(false)
```

### 詳細ボタン押下時の処理

```tsx
async function handleDetail(id: string) {
  setDetailLoading(true)
  try {
    const res = await fetch(`/api/emails/${id}`)
    const json = await res.json()
    if (res.ok) setSelectedEmail(json.data)
  } finally {
    setDetailLoading(false)
  }
}
```

- ローディング中はボタンを `disabled` にするか、スピナーを表示する（UXの観点から `detailLoading` フラグを利用）
- `closeModal` は `useCallback` でラップ（Modal の useEffect 依存配列に入るため）

```tsx
const closeModal = useCallback(() => setSelectedEmail(null), [])
```

---

## モーダル UI

**幅：** `max-w-2xl w-full`（本文が長いため案件モーダルより少し広め）

**ヘッダー：** 件名（`subject`）+ ✕ 閉じるボタン（編集ボタンなし）

### セクション1 — メール情報

2カラムグリッド：

| フィールド | 表示 |
|---|---|
| 差出人 | `from`（表示名）+ `fromEmail`（メールアドレス） |
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

- 案件と人材それぞれをリスト表示
- 案件：`→ /cases` ページへのリンク（`<Link href="/cases">` で案件管理ページへ）
- 人材：`→ /talents` ページへのリンク
- どちらも 0 件の場合は「関連する案件・人材はありません」を表示

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
- セクション区切り：`border-t border-vatch-border` + `pt-4 mt-4`
- フォームフィールドラベル：`text-[10px] text-vatch-muted uppercase tracking-wide mb-1`

---

## Out of Scope

- メール削除機能
- メール本文の編集
- ページネーション（詳細モーダル内）
- メール本文の HTML レンダリング（テキストのみ）
