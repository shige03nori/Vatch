import { render, screen } from '@testing-library/react'
import { PipelinePanel } from './PipelinePanel'
import { pipeline } from '@/data/dashboard'

test('renders all pipeline stages', () => {
  render(<PipelinePanel items={pipeline} />)
  expect(screen.getByText('面談調整中')).toBeInTheDocument()
  expect(screen.getByText('稼働中')).toBeInTheDocument()
})
