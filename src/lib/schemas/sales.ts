// src/lib/schemas/sales.ts
import { z } from 'zod'

export const PipelineQuerySchema = z.object({
  status: z.enum(['UNPROPOSED','PENDING_AUTO','SENT','REPLIED','INTERVIEWING','CONTRACTED','REJECTED']).optional(),
})
