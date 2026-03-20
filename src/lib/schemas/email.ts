// src/lib/schemas/email.ts
import { z } from 'zod'

export const CreateEmailSchema = z.object({
  receivedAt:    z.coerce.date(),
  from:          z.string().min(1),
  fromEmail:     z.string().email(),
  subject:       z.string().min(1),
  bodyText:      z.string(),
  type:          z.enum(['CASE', 'TALENT', 'UNKNOWN']),
  skills:        z.array(z.string()).default([]),
  extractedName: z.string().optional(),
  confidence:    z.number().int().min(0).max(100).optional(),
  s3Key:         z.string().optional(),
})

export const UpdateEmailSchema = z.object({
  status: z.enum(['PENDING','PARSING','PARSED','ERROR']),
})

export const EmailQuerySchema = z.object({
  type:   z.enum(['CASE', 'TALENT', 'UNKNOWN']).optional(),
  status: z.enum(['PENDING','PARSING','PARSED','ERROR']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
})
