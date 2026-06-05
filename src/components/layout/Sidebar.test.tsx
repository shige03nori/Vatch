import { render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} alt={String(props.alt ?? '')} />,
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: '山田 太郎', role: 'ADMIN' } } }),
}))

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, data: { emails: 0, matchings: 0 } }),
  }) as jest.Mock
})

test('renders VATCH logo text', () => {
  render(<Sidebar />)
  expect(screen.getByText('VATCH')).toBeInTheDocument()
})

test('highlights active dashboard link', () => {
  render(<Sidebar />)
  const link = screen.getByRole('link', { name: /ダッシュボード/ })
  expect(link.className).toMatch(/text-vatch-cyan/)
})

test('システム概要リンクが存在する', () => {
  render(<Sidebar />)
  const link = screen.getByRole('link', { name: /システム概要/ })
  expect(link).toBeInTheDocument()
  expect(link).toHaveAttribute('href', '/overview')
})

test('ユーザー名がセッションから表示される', () => {
  render(<Sidebar />)
  expect(screen.getByText('山田 太郎')).toBeInTheDocument()
})
