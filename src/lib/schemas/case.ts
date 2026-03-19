// src/lib/schemas/case.ts
import { z } from 'zod'

export const CreateCaseSchema = z.object({
  title:          z.string().min(1),
  client:         z.string().min(1),
  clientEmail:    z.string().email().optional(),
  skills:         z.array(z.string()).min(1),
  unitPrice:      z.number().int().positive(),
  startDate:      z.coerce.date(),
  workStyle:      z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  assignedUserId: z.string().cuid(),
  sourceEmailId:  z.string().cuid().optional(),
})

export const UpdateCaseSchema = CreateCaseSchema.partial().extend({
  status: z.enum(['OPEN','MATCHING','PROPOSING','INTERVIEWING','CONTRACTED','CLOSED']).optional(),
})

export const CaseQuerySchema = z.object({
  status:   z.enum(['OPEN','MATCHING','PROPOSING','INTERVIEWING','CONTRACTED','CLOSED']).optional(),
  skills:   z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(100).default(20),
})
