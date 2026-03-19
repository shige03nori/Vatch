import { render, screen } from '@testing-library/react'
import OverviewPage from './page'

jest.mock('@/components/layout/Topbar', () => ({
  Topbar: ({ title }: { title: string }) => <div>{title}</div>,
}))

test('ページがレンダリングされる', () => {
  render(<OverviewPage />)
  expect(screen.getByText('システム概要')).toBeInTheDocument()
})

test('5つのフローステップタイトルが存在する', () => {
  render(<OverviewPage />)
  expect(screen.getByText('メール受信・解析')).toBeInTheDocument()
  expect(screen.getByText('案件・人材管理')).toBeInTheDocument()
  expect(screen.getByText('AIマッチング')).toBeInTheDocument()
  expect(screen.getByText('提案・交渉')).toBeInTheDocument()
  expect(screen.getByText('契約・売上管理')).toBeInTheDocument()
})

test('Phase 3の3カードタイトルが存在する', () => {
  render(<OverviewPage />)
  expect(screen.getByText(/自律型AIエージェント/)).toBeInTheDocument()
  expect(screen.getByText(/高度分析ダッシュボード/)).toBeInTheDocument()
  expect(screen.getByText(/外部システム連携/)).toBeInTheDocument()
})
