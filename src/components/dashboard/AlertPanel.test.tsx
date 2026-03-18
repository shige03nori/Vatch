import { render, screen } from '@testing-library/react'
import { AlertPanel } from './AlertPanel'
import { alerts } from '@/data/dashboard'

test('renders all alerts', () => {
  render(<AlertPanel items={alerts} />)
  expect(screen.getByText(/契約更新/)).toBeInTheDocument()
  expect(screen.getByText(/返答待ち超過/)).toBeInTheDocument()
})
