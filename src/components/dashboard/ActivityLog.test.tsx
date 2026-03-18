import { render, screen } from '@testing-library/react'
import { ActivityLog } from './ActivityLog'
import { activityLog } from '@/data/dashboard'

test('renders activity entries with timestamps', () => {
  render(<ActivityLog items={activityLog} />)
  expect(screen.getByText('09:42')).toBeInTheDocument()
  expect(screen.getByText('AI解析完了')).toBeInTheDocument()
})
