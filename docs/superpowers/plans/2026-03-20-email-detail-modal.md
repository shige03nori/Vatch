# メール取込 詳細モーダル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メール取込画面の「詳細」ボタンを押したとき、メール原本情報・AI解析結果・関連案件/人材をモーダルで表示する（読み取り専用）。

**Architecture:** 既存の `Modal.tsx` に `panelClassName` prop を追加して幅を可変にし、`GET /api/emails/[id]` に cases/talents リレーションを追加、`EmailsPage` に状態管理とモーダル UI を追加する。

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Prisma, Jest + @testing-library/react

---

## File Structure

| ファイル | 変更 | 役割 |
|---|---|---|
| `src/components/ui/Modal.tsx` | 修正 | `panelClassName` prop 追加（後方互換） |
| `src/components/ui/Modal.test.tsx` | 修正 | `panelClassName` のテスト追加 |
| `src/app/api/emails/[id]/route.ts` | 修正 | GET に cases/talents include 追加 |
| `src/app/api/emails/__tests__/[id].test.ts` | 修正 | GET の include 検証テスト追加 |
| `src/app/(main)/emails/page.tsx` | 修正 | 詳細モーダル追加 |

---

## Task 1: Modal `panelClassName` prop

**Files:**
- Modify: `src/components/ui/Modal.tsx`
- Modify: `src/components/ui/Modal.test.tsx`

### コンテキスト

`src/components/ui/Modal.tsx` のパネル div が `max-w-xl` をハードコードしている。メール詳細モーダルは本文が長いため `max-w-2xl` が必要。既存の cases/talents ページには影響を与えず後方互換を保つ。

テストは `src/components/ui/Modal.test.tsx` にある。実行コマンド: `npx jest src/components/ui/Modal.test.tsx --no-coverage`

- [ ] **Step 1: テストを追加（失敗することを確認前に追加）**

`src/components/ui/Modal.test.tsx` の末尾に追加:

```tsx
test('panelClassName が指定されたとき dialog パネルに適用される', () => {
  render(<Modal open={true} onClose={() => {}} panelClassName="max-w-2xl"><div>content</div></Modal>)
  const dialog = screen.getByRole('dialog')
  expect(dialog.className).toContain('max-w-2xl')
})

test('panelClassName が未指定のとき max-w-xl が適用される', () => {
  render(<Modal open={true} onClose={() => {}}><div>content</div></Modal>)
  const dialog = screen.getByRole('dialog')
  expect(dialog.className).toContain('max-w-xl')
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/shige/Vatch
npx jest src/components/ui/Modal.test.tsx --no-coverage
```

期待: FAIL（`panelClassName` prop が未定義のため）

- [ ] **Step 3: `Modal.tsx` に `panelClassName` prop を追加**

`src/components/ui/Modal.tsx` を修正:

```tsx
type ModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  panelClassName?: string
}

export function Modal({ open, onClose, children, panelClassName }: ModalProps) {
```

パネル div のクラスを変更（70行目付近）:

```tsx
// 変更前
className="relative z-10 w-full max-w-xl mx-4"

// 変更後
className={`relative z-10 w-full mx-4 ${panelClassName ?? 'max-w-xl'}`}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest src/components/ui/Modal.test.tsx --no-coverage
```

期待: PASS (8 tests)

- [ ] **Step 5: コミット**

```bash
git add src/components/ui/Modal.tsx src/components/ui/Modal.test.tsx
git commit -m "feat: add panelClassName prop to Modal for width customization"
```

---

## Task 2: API GET に cases/talents include 追加

**Files:**
- Modify: `src/app/api/emails/[id]/route.ts`
- Modify: `src/app/api/emails/__tests__/[id].test.ts`

### コンテキスト

`src/app/api/emails/[id]/route.ts` の GET ハンドラは現在 `prisma.email.findUnique({ where: { id } })` のみ。cases/talents リレーションを include しないと、関連する案件・人材の情報が返らない。

既存テストは `src/app/api/emails/__tests__/[id].test.ts`。実行コマンド: `npx jest src/app/api/emails/__tests__/\[id\].test.ts --no-coverage`

- [ ] **Step 1: テストを追加（失敗することを確認前に追加）**

`src/app/api/emails/__tests__/[id].test.ts` の `describe('GET /api/emails/[id]', ...)` 内に追加:

```ts
it('calls findUnique with cases and talents include', async () => {
  mockAuth.mockResolvedValueOnce(adminSession)
  mockFindUnique.mockResolvedValueOnce({
    id: 'email-1',
    cases: [{ id: 'case-1', title: 'Test Case' }],
    talents: [{ id: 'talent-1', name: 'Test Talent' }],
  })
  await GET(new Request('http://localhost/api/emails/email-1'), { params })
  expect(mockFindUnique).toHaveBeenCalledWith({
    where: { id: 'email-1' },
    include: {
      cases:   { select: { id: true, title: true } },
      talents: { select: { id: true, name: true } },
    },
  })
})

it('returns email with cases and talents in response', async () => {
  mockAuth.mockResolvedValueOnce(adminSession)
  mockFindUnique.mockResolvedValueOnce({
    id: 'email-1',
    cases: [{ id: 'case-1', title: 'Test Case' }],
    talents: [{ id: 'talent-1', name: 'Test Talent' }],
  })
  const res = await GET(new Request('http://localhost/api/emails/email-1'), { params })
  const json = await res.json()
  expect(json.data.cases).toEqual([{ id: 'case-1', title: 'Test Case' }])
  expect(json.data.talents).toEqual([{ id: 'talent-1', name: 'Test Talent' }])
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/shige/Vatch
npx jest "src/app/api/emails/__tests__/\[id\].test.ts" --no-coverage
```

期待: FAIL（`findUnique` に `include` がないため）

- [ ] **Step 3: route.ts の GET を修正**

`src/app/api/emails/[id]/route.ts` の GET ハンドラを修正:

```ts
// 変更前
const record = await prisma.email.findUnique({ where: { id } })

// 変更後
const record = await prisma.email.findUnique({
  where: { id },
  include: {
    cases:   { select: { id: true, title: true } },
    talents: { select: { id: true, name: true } },
  },
})
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest "src/app/api/emails/__tests__/\[id\].test.ts" --no-coverage
```

期待: PASS（既存テスト含め全件通過）

- [ ] **Step 5: コミット**

```bash
git add src/app/api/emails/\[id\]/route.ts src/app/api/emails/__tests__/\[id\].test.ts
git commit -m "feat: include cases and talents in email GET response"
```

---

## Task 3: メール詳細モーダル

**Files:**
- Modify: `src/app/(main)/emails/page.tsx`

### コンテキスト

`src/app/(main)/emails/page.tsx` の現状:
- `EmailItem` 型（id, receivedAt, from, subject, type, status, skills, extractedName, confidence）
- `handleDetail(id)` が `alert(...)` のみ（モーダル未実装）
- `StatusBadge`・`TypeBadge`・`ConfidenceBar` コンポーネントが同ファイル内に定義済み
- `EmailRow` コンポーネントが `onDetail: (id: string) => void` を受け取る

参考実装: `src/app/(main)/cases/page.tsx` — 同パターンの詳細モーダル（`selectedCase`, `closeModal` useCallback, Modal配置）

テストは不要（クライアントコンポーネント・状態管理中心のため、Task 1/2でカバー済み）。Playwright でビジュアル確認する（Task 4）。

- [ ] **Step 1: import と型定義を追加**

ファイル先頭の import に追加:
```tsx
import { useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import Link from 'next/link'
```

※ `useState`・`useEffect` は既存の import に含まれている。`useCallback` のみ追加。

既存の `type EmailItem = { ... }` ブロックの後（`type FilterTab` の前）に追加:

```tsx
type EmailDetail = EmailItem & {
  fromEmail: string
  bodyText: string
  cases:   { id: string; title: string }[]
  talents: { id: string; name: string }[]
  createdAt: string
}
```

- [ ] **Step 2: 状態変数と closeModal を追加**

`EmailsPage` 関数内の既存 `useState` 群の後に追加:

```tsx
const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)
const [detailLoading, setDetailLoading] = useState(false)
const [detailError, setDetailError] = useState<string | null>(null)

const closeModal = useCallback(() => setSelectedEmail(null), [])
```

- [ ] **Step 3: `handleDetail` を実装に置き換え**

既存の `handleDetail` 関数（`alert(...)` のみの実装）を置き換え:

```tsx
async function handleDetail(id: string) {
  setDetailLoading(true)
  setDetailError(null)
  try {
    const res = await fetch(`/api/emails/${id}`)
    let json: { data?: EmailDetail; error?: { message?: string } } = {}
    try { json = await res.json() } catch { /* non-JSON body */ }
    if (!res.ok) throw new Error(json.error?.message ?? '詳細の取得に失敗しました')
    setSelectedEmail(json.data as EmailDetail)
  } catch (err) {
    setDetailError(err instanceof Error ? err.message : '詳細の取得に失敗しました')
  } finally {
    setDetailLoading(false)
  }
}
```

- [ ] **Step 4: 詳細ボタンに `disabled` を追加**

`EmailRow` コンポーネント内の詳細ボタン（`onClick={() => onDetail(item.id)}` の行）は `EmailRow` に `detailLoading` を渡す必要がある。

`EmailRow` のプロップスを変更:

```tsx
// 変更前
function EmailRow({ item, onDetail }: { item: EmailItem; onDetail: (id: string) => void }) {

// 変更後
function EmailRow({ item, onDetail, detailLoading }: { item: EmailItem; onDetail: (id: string) => void; detailLoading: boolean }) {
```

詳細ボタンに `disabled` を追加:

```tsx
// 変更前
<button
  onClick={() => onDetail(item.id)}
  className="px-3 py-1 rounded text-[12px] font-medium text-vatch-cyan border border-vatch-cyan/40 hover:bg-vatch-cyan/10 transition-colors"
>
  詳細
</button>

// 変更後
<button
  onClick={() => onDetail(item.id)}
  disabled={detailLoading}
  className="px-3 py-1 rounded text-[12px] font-medium text-vatch-cyan border border-vatch-cyan/40 hover:bg-vatch-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  詳細
</button>
```

`EmailRow` の呼び出し箇所（`filtered.map(...)` 内）を更新:

```tsx
// 変更前
<EmailRow key={item.id} item={item} onDetail={handleDetail} />

// 変更後
<EmailRow key={item.id} item={item} onDetail={handleDetail} detailLoading={detailLoading} />
```

- [ ] **Step 5: エラー表示を追加**

フィルタータブの直後（テーブルの直前）に追加:

```tsx
{detailError && (
  <p className="text-red-400 text-xs">{detailError}</p>
)}
```

- [ ] **Step 6: モーダル JSX を追加**

`</main>` の直前（`</div>` の前）に追加:

```tsx
<Modal open={selectedEmail !== null} onClose={closeModal} panelClassName="max-w-2xl">
  <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
    {/* ヘッダー */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
      <h2 id="modal-title" className="text-base font-bold text-white truncate pr-4">
        {selectedEmail?.subject}
      </h2>
      <button
        onClick={closeModal}
        className="text-vatch-muted hover:text-white transition-colors text-lg leading-none"
        aria-label="閉じる"
      >
        ✕
      </button>
    </div>

    {/* ボディ */}
    {selectedEmail && (
      <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">

        {/* セクション1: メール情報 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">差出人</div>
            <div className="text-sm text-white">{selectedEmail.from}</div>
            <div className="text-xs text-vatch-muted mt-0.5">{selectedEmail.fromEmail}</div>
          </div>
          <div>
            <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">受信日時</div>
            <div className="text-sm text-white">
              {new Date(selectedEmail.receivedAt).toLocaleString('ja-JP')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">種別</div>
            <TypeBadge type={selectedEmail.type} />
          </div>
          <div>
            <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</div>
            <StatusBadge status={selectedEmail.status} />
          </div>
          <div>
            <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">AI信頼度</div>
            {selectedEmail.confidence !== null ? (
              <ConfidenceBar confidence={selectedEmail.confidence} />
            ) : (
              <span className="text-sm text-vatch-muted">—</span>
            )}
          </div>
        </div>

        {/* セクション2: AI解析結果 */}
        <div className="border-t border-vatch-border pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">抽出名</div>
              <div className="text-sm text-white">{selectedEmail.extractedName ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
              {selectedEmail.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedEmail.skills.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-vatch-border-light/60 text-vatch-text-dim border border-vatch-border-light">
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-vatch-muted">—</span>
              )}
            </div>
          </div>
        </div>

        {/* セクション3: メール本文 */}
        <div className="border-t border-vatch-border pt-4">
          <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-2">メール本文</div>
          <pre className="whitespace-pre-wrap text-xs text-vatch-muted font-mono bg-vatch-bg rounded-lg p-3 max-h-60 overflow-y-auto border border-vatch-border">
            {selectedEmail.bodyText || '（本文なし）'}
          </pre>
        </div>

        {/* セクション4: 関連する案件/人材 */}
        <div className="border-t border-vatch-border pt-4 space-y-3">
          <div className="text-[10px] text-vatch-muted uppercase tracking-wide">関連する案件 / 人材</div>
          {selectedEmail.cases.length === 0 && selectedEmail.talents.length === 0 ? (
            <p className="text-sm text-vatch-muted">関連する案件・人材はありません</p>
          ) : (
            <>
              {selectedEmail.cases.length > 0 && (
                <div>
                  <div className="text-[10px] text-vatch-muted mb-1">案件</div>
                  {selectedEmail.cases.map((c) => (
                    <Link key={c.id} href="/cases" className="block text-sm text-vatch-cyan hover:underline">
                      {c.title}
                    </Link>
                  ))}
                </div>
              )}
              {selectedEmail.talents.length > 0 && (
                <div>
                  <div className="text-[10px] text-vatch-muted mb-1">人材</div>
                  {selectedEmail.talents.map((t) => (
                    <Link key={t.id} href="/talents" className="block text-sm text-[#a78bfa] hover:underline">
                      {t.name}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    )}
  </div>
</Modal>
```

- [ ] **Step 7: TypeScript エラーがないことを確認**

```bash
cd C:/Users/shige/Vatch
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 8: コミット**

```bash
git add src/app/\(main\)/emails/page.tsx
git commit -m "feat: add email detail modal with body, AI results, and related records"
```

---

## Task 4: ビジュアル確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 開発サーバーが起動していることを確認**

`http://localhost:3000` にアクセスできること。

- [ ] **Step 2: メール取込画面で詳細ボタンを確認**

`http://localhost:3000/emails` を開き、任意の行の「詳細」ボタンをクリック。

期待: モーダルが開き、件名・差出人・受信日時・ステータス・AI解析結果・メール本文・関連案件/人材が表示される。

- [ ] **Step 3: ESCキーで閉じることを確認**

モーダルを開いた状態でESCキーを押す。期待: モーダルが閉じる。

- [ ] **Step 4: 全テスト通過を確認**

```bash
npx jest --no-coverage
```

期待: PASS（既存テスト + 新規テスト含め全件通過）
