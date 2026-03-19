// src/lib/schemas/matching.ts
import { z } from 'zod'

export const CreateMatchingSchema = z.object({
  caseId:          z.string().cuid(),
  talentId:        z.string().cuid(),
  score:           z.number().int().min(0).max(100),
  skillMatchRate:  z.number().int().min(0).max(100),
  unitPriceOk:     z.boolean(),
  timingOk:        z.boolean(),
  locationOk:      z.boolean(),
  costPrice:       z.number().int().positive(),
  sellPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
  grossProfitOk:   z.boolean(),
  reason:          z.string().optional(),
  isAutoSend:      z.boolean().default(false),
})

export const UpdateMatchingSchema = z.object({
  status: z.enum(['UNPROPOSED','PENDING_AUTO','SENT','REPLIED','INTERVIEWING','CONTRACTED','REJECTED']),
})

export const MatchingQuerySchema = z.object({
  caseId:   z.string().cuid().optional(),
  talentId: z.string().cuid().optional(),
  status:   z.enum(['UNPROPOSED','PENDING_AUTO','SENT','REPLIED','INTERVIEWING','CONTRACTED','REJECTED']).optional(),
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(100).default(20),
})
