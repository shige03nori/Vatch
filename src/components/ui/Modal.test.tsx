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
