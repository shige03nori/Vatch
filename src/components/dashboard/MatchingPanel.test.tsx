import { render, screen } from '@testing-library/react'
import { MatchingPanel } from './MatchingPanel'
import { matchingCandidates } from '@/data/dashboard'

test('renders all candidates', () => {
  render(<MatchingPanel candidates={matchingCandidates} />)
  expect(screen.getByText('田中 K.')).toBeInTheDocument()
  expect(screen.getByText('佐藤 M.')).toBeInTheDocument()
})

test('shows gross profit warning for low-margin candidates', () => {
  render(<MatchingPanel candidates={matchingCandidates} />)
  expect(screen.getByText('粗利△')).toBeInTheDocument()
})
