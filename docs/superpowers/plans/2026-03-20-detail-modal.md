# 詳細モーダル実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 案件管理・人材管理の「詳細」ボタンから詳細モーダルを開き、表示モードと編集モード（toggle）で情報を確認・編集できるようにする。

**Architecture:** 共通の `Modal` ラッパーコンポーネントを `src/components/ui/Modal.tsx` に作成し、各ページ（`cases/page.tsx` / `talents/page.tsx`）がそれをラップして詳細コンテンツを実装する。状態（選択レコード・編集モード・保存中・エラー）は各ページの `useState` で管理する。

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Jest + @testing-library/react

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/components/ui/Modal.tsx` | オーバーレイ・ESC・フォーカストラップ・aria属性の共通ラッパー（新規作成） |
| `src/components/ui/Modal.test.tsx` | Modal コンポーネントのユニットテスト（新規作成） |
| `src/app/(main)/cases/page.tsx` | 案件詳細モーダルを追加（既存ファイル修正） |
| `src/app/(main)/talents/page.tsx` | 人材詳細モーダルを追加（既存ファイル修正） |

PATCH APIエンドポイントは既存の `/api/cases/[id]` `/api/talents/[id]` をそのまま使用（修正不要）。

---

## Task 1: Modal 共通コンポーネント

**Files:**
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Modal.test.tsx`

### コンテキスト

`src/components/dashboard/KpiCard.tsx` のようにシンプルな関数コンポーネントを作る。テストは `src/components/dashboard/KpiCard.test.tsx` を参考に `@testing-library/react` で書く。

### ステップ

- [ ] **Step 1: テストを書く**

`src/components/ui/Modal.test.tsx` を作成:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

test('open=false のとき何もレンダリングしない', () => {
  render(<Modal open={false} onClose={() => {}}><div>content</div></Modal>)
  expect(screen.queryByText('content')).not.toBeInTheDocument()
})

test('open=true のとき children をレンダリングする', () => {
  render(<Modal open={true} onClose={() => {}}><div>content</div></Modal>)
  expect(screen.getByText('content')).toBeInTheDocument()
})

test('ESCキーで onClose が呼ばれる', () => {
  const onClose = jest.fn()
  render(<Modal open={true} onClose={onClose}><div>content</div></Modal>)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('オーバーレイクリックで onClose が呼ばれる', () => {
  const onClose = jest.fn()
  render(<Modal open={true} onClose={onClose}><div>content</div></Modal>)
  fireEvent.click(screen.getByTestId('modal-overlay'))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('モーダル内コンテンツのクリックで onClose が呼ばれない', () => {
  const onClose = jest.fn()
  render(<Modal open={true} onClose={onClose}><div>content</div></Modal>)
  fireEvent.click(screen.getByText('content'))
  expect(onClose).not.toHaveBeenCalled()
})

test('role="dialog" aria-modal="true" aria-labelledby="modal-title" が設定されている', () => {
  render(<Modal open={true} onClose={() => {}}><div>content</div></Modal>)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/shige/Vatch
npx jest src/components/ui/Modal.test.tsx --no-coverage
```

期待: FAIL（`Modal` が存在しないため）

- [ ] **Step 3: Modal コンポーネントを実装**

`src/components/ui/Modal.tsx` を作成:

```tsx
'use client'

import { useEffect, useRef } from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ open, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // フォーカストラップ: Tab/Shift+Tab をパネル内に閉じ込める
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus() }
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // モーダルが開いたとき最初のフォーカス可能要素にフォーカス
  useEffect(() => {
    if (!open || !panelRef.current) return
    const firstFocusable = panelRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="modal-overlay"
      onClick={onClose}
    >
      {/* 背景暗転 */}
      <div className="absolute inset-0 bg-black/60" />
      {/* モーダルパネル */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 w-full max-w-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest src/components/ui/Modal.test.tsx --no-coverage
```

期待: PASS (6 tests)

- [ ] **Step 5: コミット**

```bash
git add src/components/ui/Modal.tsx src/components/ui/Modal.test.tsx
git commit -m "feat: add Modal shared component with focus trap and aria"
```

---

## Task 2: 案件詳細モーダル

**Files:**
- Modify: `src/app/(main)/cases/page.tsx`

### コンテキスト

`src/app/(main)/cases/page.tsx` の現状:
- `CaseItem` 型（`id, title, client, clientEmail, skills, unitPrice, startDate, workStyle, status, createdAt`）
- `STATUS_CONFIG` と `WORK_STYLE_CONFIG` の定数が定義済み
- `filtered.map()` のテーブル行の末尾に「詳細」ボタンがある（現状は `onClick` なし）

テストは不要（クライアントコンポーネント・Reactの状態管理中心のため、Task 1で共通部分はカバー済み）。Playwright でビジュアル確認する。

### ステップ

- [ ] **Step 1: 型・ヘルパー・状態を追加**

`src/app/(main)/cases/page.tsx` の既存の型定義ブロックの後（`const STATUS_CONFIG` の前）に追加:

```tsx
type EditCaseForm = {
  title: string
  client: string
  clientEmail: string
  unitPrice: number
  startDate: string   // YYYY-MM-DD
  workStyle: WorkStyle
  status: CaseStatus
}

function toEditCaseForm(c: CaseItem): EditCaseForm {
  return {
    title: c.title,
    client: c.client,
    clientEmail: c.clientEmail ?? '',
    unitPrice: c.unitPrice,
    startDate: c.startDate.slice(0, 10),
    workStyle: c.workStyle,
    status: c.status,
  }
}
```

- [ ] **Step 2: `Modal` import と状態変数を追加**

ファイル先頭の import に追加:
```tsx
import { Modal } from '@/components/ui/Modal'
```

`CasesPage` 関数内の既存の `useState` 群の後に追加:
```tsx
const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
const [editing, setEditing] = useState(false)
const [editForm, setEditForm] = useState<Partial<EditCaseForm>>({})
const [saving, setSaving] = useState(false)
const [saveError, setSaveError] = useState<string | null>(null)
```

- [ ] **Step 3: モーダルオープン時の初期化 useEffect を追加**

既存の `useEffect` の後に追加:
```tsx
useEffect(() => {
  if (!selectedCase) return
  setEditing(false)
  setSaveError(null)
  setEditForm(toEditCaseForm(selectedCase))
}, [selectedCase])
```

- [ ] **Step 4: `closeModal` と `handleSave` 関数を追加**

```tsx
function closeModal() {
  setSelectedCase(null)
  setEditing(false)
  setSaveError(null)
}

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
        startDate: new Date(editForm.startDate!).toISOString(),
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました')
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

- [ ] **Step 5: 詳細ボタンに onClick を追加**

テーブル内の既存の「詳細」ボタン（`src/app/(main)/cases/page.tsx:225`付近）を修正:

```tsx
// 変更前
<button className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors">
  詳細
</button>

// 変更後
<button
  className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors"
  onClick={() => setSelectedCase(item)}
>
  詳細
</button>
```

- [ ] **Step 6: モーダル JSX を追加**

`</main>` の直前（`</div>` の前）に追加:

```tsx
<Modal open={selectedCase !== null} onClose={closeModal}>
  <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
    {/* ヘッダー */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
      <h2 id="modal-title" className="text-base font-bold text-white truncate pr-4">
        {selectedCase?.title}
      </h2>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <button
              onClick={() => { setEditing(false); setSaveError(null); setEditForm(toEditCaseForm(selectedCase!)) }}
              className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-[#38bdf8] text-black font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors"
          >
            ✏ 編集
          </button>
        )}
        <button
          onClick={closeModal}
          className="text-vatch-muted hover:text-white transition-colors text-lg leading-none"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </div>

    {/* ボディ */}
    <div className="px-5 py-4 space-y-4">
      {editing ? (
        /* 編集フォーム */
        <div className="grid grid-cols-2 gap-4">
          {/* title */}
          <div className="col-span-2">
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">案件名</label>
            <input
              type="text"
              value={editForm.title ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* client */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアント</label>
            <input
              type="text"
              value={editForm.client ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, client: e.target.value }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* clientEmail */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアントメール</label>
            <input
              type="email"
              value={editForm.clientEmail ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, clientEmail: e.target.value }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* unitPrice */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">単価（万円）</label>
            <input
              type="number"
              min={1}
              value={editForm.unitPrice ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* startDate */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">開始時期</label>
            <input
              type="date"
              value={editForm.startDate ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* workStyle */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</label>
            <select
              value={editForm.workStyle ?? 'REMOTE'}
              onChange={(e) => setEditForm((f) => ({ ...f, workStyle: e.target.value as WorkStyle }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
            >
              {(Object.keys(WORK_STYLE_CONFIG) as WorkStyle[]).map((w) => (
                <option key={w} value={w}>{WORK_STYLE_CONFIG[w].label}</option>
              ))}
            </select>
          </div>
          {/* status */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</label>
            <select
              value={editForm.status ?? 'OPEN'}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as CaseStatus }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
            >
              {(Object.keys(STATUS_CONFIG) as CaseStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          {/* error */}
          {saveError && <p className="col-span-2 text-red-400 text-xs">{saveError}</p>}
        </div>
      ) : (
        /* 表示モード */
        selectedCase && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアント</div>
              <div className="text-sm text-white">{selectedCase.client}</div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアントメール</div>
              <div className="text-sm text-white">{selectedCase.clientEmail ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">単価</div>
              <div className="text-sm text-white">{selectedCase.unitPrice}万円</div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">開始時期</div>
              <div className="text-sm text-white">
                {new Date(selectedCase.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${WORK_STYLE_CONFIG[selectedCase.workStyle].color} ${WORK_STYLE_CONFIG[selectedCase.workStyle].bg}`}>
                {WORK_STYLE_CONFIG[selectedCase.workStyle].label}
              </span>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedCase.status].color} ${STATUS_CONFIG[selectedCase.status].bg}`}>
                {STATUS_CONFIG[selectedCase.status].label}
              </span>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
              <div className="flex flex-wrap gap-1">
                {selectedCase.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">登録日時</div>
              <div className="text-sm text-vatch-muted">
                {new Date(selectedCase.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </div>
            </div>
          </div>
        )
      )}
    </div>
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
git add src/app/\(main\)/cases/page.tsx
git commit -m "feat: add case detail/edit modal"
```

---

## Task 3: 人材詳細モーダル

**Files:**
- Modify: `src/app/(main)/talents/page.tsx`

### コンテキスト

`src/app/(main)/talents/page.tsx` の現状:
- `TalentItem` 型（`id, name, skills, experience, desiredRate, location, workStyle, status, agencyEmail, createdAt`）
- `STATUS_CONFIG` と `WORK_STYLE_CONFIG` の定数が定義済み
- テーブル行末尾に「詳細」ボタンがある（現状 `onClick` なし）
- Task 2 と同じパターンで実装する（`startDate` フィールドなし）

### ステップ

- [ ] **Step 1: 型・ヘルパー・状態を追加**

既存の型定義ブロックの後に追加:

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

function toEditTalentForm(t: TalentItem): EditTalentForm {
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

- [ ] **Step 2: `Modal` import と状態変数を追加**

```tsx
import { Modal } from '@/components/ui/Modal'
```

`TalentsPage` 関数内の既存の `useState` 群の後に追加:

```tsx
const [selectedTalent, setSelectedTalent] = useState<TalentItem | null>(null)
const [editing, setEditing] = useState(false)
const [editForm, setEditForm] = useState<Partial<EditTalentForm>>({})
const [saving, setSaving] = useState(false)
const [saveError, setSaveError] = useState<string | null>(null)
```

- [ ] **Step 3: useEffect・closeModal・handleSave を追加**

```tsx
useEffect(() => {
  if (!selectedTalent) return
  setEditing(false)
  setSaveError(null)
  setEditForm(toEditTalentForm(selectedTalent))
}, [selectedTalent])

function closeModal() {
  setSelectedTalent(null)
  setEditing(false)
  setSaveError(null)
}

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

- [ ] **Step 4: 詳細ボタンに onClick を追加**

テーブル内の「詳細」ボタン（`src/app/(main)/talents/page.tsx:225`付近）を修正:

```tsx
// 変更後
<button
  className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors"
  onClick={() => setSelectedTalent(item)}
>
  詳細
</button>
```

- [ ] **Step 5: モーダル JSX を追加**

`</main>` の直前に追加:

```tsx
<Modal open={selectedTalent !== null} onClose={closeModal}>
  <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
    {/* ヘッダー */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
      <h2 id="modal-title" className="text-base font-bold text-white truncate pr-4">
        {selectedTalent?.name}
      </h2>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <button
              onClick={() => { setEditing(false); setSaveError(null); setEditForm(toEditTalentForm(selectedTalent!)) }}
              className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-[#38bdf8] text-black font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors"
          >
            ✏ 編集
          </button>
        )}
        <button
          onClick={closeModal}
          className="text-vatch-muted hover:text-white transition-colors text-lg leading-none"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </div>

    {/* ボディ */}
    <div className="px-5 py-4 space-y-4">
      {editing ? (
        <div className="grid grid-cols-2 gap-4">
          {/* name */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">氏名</label>
            <input
              type="text"
              value={editForm.name ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* location */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">居住地</label>
            <input
              type="text"
              value={editForm.location ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* experience */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">経験年数（年）</label>
            <input
              type="number"
              min={0}
              value={editForm.experience ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, experience: Number(e.target.value) }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* desiredRate */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">希望単価（万円）</label>
            <input
              type="number"
              min={1}
              value={editForm.desiredRate ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, desiredRate: Number(e.target.value) }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {/* workStyle */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</label>
            <select
              value={editForm.workStyle ?? 'REMOTE'}
              onChange={(e) => setEditForm((f) => ({ ...f, workStyle: e.target.value as WorkStyle }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
            >
              {(Object.keys(WORK_STYLE_CONFIG) as WorkStyle[]).map((w) => (
                <option key={w} value={w}>{WORK_STYLE_CONFIG[w].label}</option>
              ))}
            </select>
          </div>
          {/* status */}
          <div>
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</label>
            <select
              value={editForm.status ?? 'AVAILABLE'}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as TalentStatus }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
            >
              {(Object.keys(STATUS_CONFIG) as TalentStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          {/* agencyEmail */}
          <div className="col-span-2">
            <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">紹介元メール</label>
            <input
              type="email"
              value={editForm.agencyEmail ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, agencyEmail: e.target.value }))}
              className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>
          {saveError && <p className="col-span-2 text-red-400 text-xs">{saveError}</p>}
        </div>
      ) : (
        selectedTalent && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">居住地</div>
              <div className="text-sm text-white">{selectedTalent.location}</div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">経験年数</div>
              <div className="text-sm text-white">{selectedTalent.experience}年</div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">希望単価</div>
              <div className="text-sm text-white">{selectedTalent.desiredRate}万円</div>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${WORK_STYLE_CONFIG[selectedTalent.workStyle].color} ${WORK_STYLE_CONFIG[selectedTalent.workStyle].bg}`}>
                {WORK_STYLE_CONFIG[selectedTalent.workStyle].label}
              </span>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedTalent.status].color} ${STATUS_CONFIG[selectedTalent.status].bg}`}>
                {STATUS_CONFIG[selectedTalent.status].label}
              </span>
            </div>
            <div>
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">紹介元メール</div>
              <div className="text-sm text-white">{selectedTalent.agencyEmail ?? '—'}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
              <div className="flex flex-wrap gap-1">
                {selectedTalent.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">登録日時</div>
              <div className="text-sm text-vatch-muted">
                {new Date(selectedTalent.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  </div>
</Modal>
```

- [ ] **Step 6: TypeScript エラーがないことを確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/app/\(main\)/talents/page.tsx
git commit -m "feat: add talent detail/edit modal"
```

---

## Task 4: ビジュアル確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 開発サーバーが起動していることを確認**

`http://localhost:3000` にアクセスできること。

- [ ] **Step 2: 案件管理で詳細ボタンを確認**

`http://localhost:3000/cases` を開き、任意の行の「詳細」ボタンをクリックする。
期待：モーダルが開き、案件情報が表示される。

- [ ] **Step 3: 案件編集を確認**

モーダル内の「✏ 編集」ボタンをクリック。
期待：フォームに切り替わる。ステータスを変更し「保存」をクリック。
期待：モーダルが表示モードに戻り、変更が反映されている。リスト側のバッジも更新されている。

- [ ] **Step 4: ESCキーで閉じることを確認**

モーダルを開いた状態でESCキーを押す。期待：モーダルが閉じる。

- [ ] **Step 5: 人材管理で詳細ボタンを確認**

`http://localhost:3000/talents` で同様に確認する。

- [ ] **Step 6: 全テスト通過を確認**

```bash
npx jest --no-coverage
```

期待: PASS（既存テスト + Modal テスト）
