import { render, screen } from '@testing-library/react'
import { Topbar } from './Topbar'

test('renders page title', () => {
  render(<Topbar title="Vatch Dashboard" />)
  expect(screen.getByText('Vatch Dashboard')).toBeInTheDocument()
})

test('renders LIVE indicator', () => {
  render(<Topbar title="Vatch Dashboard" />)
  expect(screen.getByText('LIVE')).toBeInTheDocument()
})
