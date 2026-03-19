// src/lib/schemas/contract.ts
import { z } from 'zod'

export const CreateContractSchema = z.object({
  caseId:          z.string().cuid(),
  talentId:        z.string().cuid(),
  assignedUserId:  z.string().cuid(),
  proposalId:      z.string().cuid().optional(),
  startDate:       z.coerce.date(),
  endDate:         z.coerce.date().optional(),
  unitPrice:       z.number().int().positive(),
  costPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
})

export const UpdateContractSchema = z.object({
  endDate:         z.coerce.date().optional(),
  unitPrice:       z.number().int().positive().optional(),
  costPrice:       z.number().int().positive().optional(),
  grossProfitRate: z.number().optional(),
  status:          z.enum(['ACTIVE','ENDING_SOON','ENDED','RENEWAL_PENDING']).optional(),
})

export const ContractQuerySchema = z.object({
  status: z.enum(['ACTIVE','ENDING_SOON','ENDED','RENEWAL_PENDING']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
})
