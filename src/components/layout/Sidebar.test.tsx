import { render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} alt={String(props.alt ?? '')} />,
}))

test('renders VATCH logo text', () => {
  render(<Sidebar />)
  expect(screen.getByText('VATCH')).toBeInTheDocument()
})

test('highlights active dashboard link', () => {
  render(<Sidebar />)
  const link = screen.getByRole('link', { name: /ダッシュボード/ })
  expect(link.className).toMatch(/text-vatch-cyan/)
})
