// src/lib/schemas/proposal.ts
import { z } from 'zod'

export const CreateProposalSchema = z.object({
  matchingId:      z.string().cuid(),
  to:              z.string().email(),
  cc:              z.string().email().optional(),
  subject:         z.string().min(1),
  bodyText:        z.string().min(1),
  status:          z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).default('DRAFT'),
  costPrice:       z.number().int().positive(),
  sellPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
  isAutoSend:      z.boolean().default(false),
})

export const UpdateProposalSchema = z.object({
  status:   z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).optional(),
  subject:  z.string().min(1).optional(),
  bodyText: z.string().min(1).optional(),
  sentAt:   z.coerce.date().optional(),
})

export const ProposalQuerySchema = z.object({
  status: z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
})
