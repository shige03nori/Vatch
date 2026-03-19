// src/lib/schemas/talent.ts
import { z } from 'zod'

export const CreateTalentSchema = z.object({
  name:           z.string().min(1),
  skills:         z.array(z.string()).min(1),
  experience:     z.number().int().min(0),
  desiredRate:    z.number().int().positive(),
  location:       z.string().min(1),
  workStyle:      z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  availableFrom:  z.coerce.date().optional(),
  agencyEmail:    z.string().email().optional(),
  assignedUserId: z.string().cuid(),
  sourceEmailId:  z.string().cuid().optional(),
})

export const UpdateTalentSchema = CreateTalentSchema.partial().extend({
  status: z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
})

export const TalentQuerySchema = z.object({
  status:    z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
  skills:    z.string().optional(),
  workStyle: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  page:      z.coerce.number().min(1).default(1),
  limit:     z.coerce.number().min(1).max(100).default(20),
})
