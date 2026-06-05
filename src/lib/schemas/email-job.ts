import { z } from 'zod'

export const SendEmailRequestSchema = z.object({
  sendType: z.enum(['NOW', 'SCHEDULED']),
  scheduledAt: z.string().datetime().optional()
})

export const EmailJobStatusEnum = z.enum([
  'PENDING',
  'GENERATING',
  'SENDING',
  'SENT',
  'FAILED',
  'SCHEDULED'
])

export const EmailJobResponseSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  status: EmailJobStatusEnum,
  generatedContent: z.string().optional(),
  sendType: z.enum(['NOW', 'SCHEDULED']),
  scheduledAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  attachmentPath: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>
export type EmailJobResponse = z.infer<typeof EmailJobResponseSchema>
