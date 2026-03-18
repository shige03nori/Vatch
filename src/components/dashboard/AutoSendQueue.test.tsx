import { render, screen } from '@testing-library/react'
import { AutoSendQueue } from './AutoSendQueue'
import { autoSendQueue } from '@/data/dashboard'

test('renders all queue items', () => {
  render(<AutoSendQueue items={autoSendQueue} />)
  expect(screen.getByText(/Java × 田中/)).toBeInTheDocument()
})

test('shows amber color for sub-10% gross profit rate', () => {
  render(<AutoSendQueue items={autoSendQueue} />)
  const rate = screen.getByText('9.8%')
  expect(rate.className).toMatch(/amber/)
})
