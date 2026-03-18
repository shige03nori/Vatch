import { render, screen } from '@testing-library/react'
import { KpiCard } from './KpiCard'

const base = { id: '1', value: 12, label: '本日受信案件', change: '↑ 3件', color: 'blue' as const }

test('renders value and label', () => {
  render(<KpiCard {...base} />)
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('本日受信案件')).toBeInTheDocument()
})

test('renders change text', () => {
  render(<KpiCard {...base} />)
  expect(screen.getByText('↑ 3件')).toBeInTheDocument()
})
