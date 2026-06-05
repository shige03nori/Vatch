'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'

interface Proposal {
  id: string
  title: string
  case: { title: string; client: string }
  talent: { name: string }
  contract: {
    unitPrice: number
    costPrice: number
  }
}

interface EmailSendModalProps {
  proposal: Proposal
  open: boolean
  onClose: () => void
}

export function EmailSendModal({ proposal, open, onClose }: EmailSendModalProps) {
  const [step, setStep] = useState<'idle' | 'generating' | 'preview' | 'schedule' | 'sending'>('idle')
  const [emailContent, setEmailContent] = useState('')
  const [sendType, setSendType] = useState<'NOW' | 'SCHEDULED'>('NOW')
  const [scheduledAt, setScheduledAt] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cleanup: (() => void) | null = null

    const start = async () => {
      if (open && step === 'idle') {
        setStep('generating')
        setError(null)

        try {
          const res = await fetch(`/api/proposals/${proposal.id}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sendType: 'NOW' })
          })

          if (!res.ok) throw new Error('Failed to generate email')

          const data = await res.json()
          setJobId(data.jobId)
          cleanup = await pollJobStatus(data.jobId)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to generate email')
          setStep('idle')
        }
      }
    }

    start()

    return () => {
      if (cleanup) cleanup()
    }
  }, [open])

  async function startGeneration() {
    setStep('generating')
    setError(null)

    try {
      const res = await fetch(`/api/proposals/${proposal.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendType: 'NOW' })
      })

      if (!res.ok) throw new Error('Failed to generate email')

      const data = await res.json()
      setJobId(data.jobId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
      setStep('idle')
    }
  }

  async function pollJobStatus(id: string) {
    let attempts = 0
    const maxAttempts = 120 // 60秒（30秒間隔 × 120回）
    let pollTimeoutId: NodeJS.Timeout | null = null

    const poll = async () => {
      try {
        const res = await fetch(`/api/proposals/${proposal.id}/email-jobs/${id}`)
        if (!res.ok) throw new Error('Failed to get job status')

        const job = await res.json()

        if (job.status === 'PENDING' || job.status === 'GENERATING') {
          // Still generating, keep polling
          attempts++
          if (attempts < maxAttempts) {
            pollTimeoutId = setTimeout(poll, 30000) // 30秒後に再ポーリング
          } else {
            setError('Generation timeout')
            setStep('idle')
          }
        } else if (job.status === 'SENDING' || job.status === 'SENT') {
          // Ready to send
          setEmailContent(job.generatedContent)
          setStep('preview')
        } else if (job.status === 'FAILED') {
          setError(job.errorMessage || 'Generation failed')
          setStep('idle')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to poll status')
        setStep('idle')
      }
    }

    // Start polling
    poll()

    // Return cleanup function
    return () => {
      if (pollTimeoutId) clearTimeout(pollTimeoutId)
    }
  }

  async function handleSend() {
    if (!jobId) return

    setStep('sending')

    try {
      // スケジュール指定の場合、新しいジョブを作成
      if (sendType === 'SCHEDULED') {
        const res = await fetch(`/api/proposals/${proposal.id}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sendType: 'SCHEDULED',
            scheduledAt
          })
        })

        if (!res.ok) throw new Error('Failed to schedule email')

        // 成功時は表示を更新
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        // 即座に送信（既に送信済み）
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send email')
      setStep('preview')
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden max-w-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
          <h2 className="text-base font-bold text-white">メール送信</h2>
          <button onClick={onClose} className="text-vatch-muted hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4">
          {step === 'generating' && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin text-[#38bdf8] text-3xl mb-4">⏳</div>
              <p className="text-vatch-muted">メール文章を生成中...</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-vatch-muted uppercase mb-2">メール本文</label>
                <div className="bg-vatch-bg border border-vatch-border rounded p-3 text-white text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {emailContent}
                </div>
              </div>

              <div>
                <label className="block text-xs text-vatch-muted uppercase mb-2">送信方法</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="NOW"
                      checked={sendType === 'NOW'}
                      onChange={() => setSendType('NOW')}
                      className="cursor-pointer"
                    />
                    <span className="text-white">今すぐ送信</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="SCHEDULED"
                      checked={sendType === 'SCHEDULED'}
                      onChange={() => setSendType('SCHEDULED')}
                      className="cursor-pointer"
                    />
                    <span className="text-white">スケジュール指定</span>
                  </label>
                </div>
              </div>

              {sendType === 'SCHEDULED' && (
                <div>
                  <label className="block text-xs text-vatch-muted uppercase mb-2">送信日時</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                    className="w-full bg-vatch-bg border border-vatch-border rounded px-3 py-2 text-white"
                  />
                </div>
              )}

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-vatch-border text-vatch-muted rounded hover:border-[#38bdf8] hover:text-[#38bdf8]"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSend}
                  disabled={sendType === 'SCHEDULED' && !scheduledAt}
                  className="flex-1 py-2.5 bg-[#38bdf8] text-black font-bold rounded disabled:opacity-50"
                >
                  {step === 'sending' ? '送信中...' : '送信'}
                </button>
              </div>
            </div>
          )}

          {step === 'sending' && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin text-[#38bdf8] text-3xl mb-4">📧</div>
              <p className="text-vatch-muted">送信中...</p>
            </div>
          )}

          {step === 'idle' && error && (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={startGeneration}
                className="px-4 py-2 bg-[#38bdf8] text-black font-bold rounded"
              >
                再試行
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
