// src/lib/schemas/email-source.ts
import { z } from 'zod'

export const CreateEmailSourceSchema = z.object({
  label:    z.string().min(1),
  imapHost: z.string().min(1),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapUser: z.string().email(),
  imapPass: z.string().min(1),
})

export const UpdateEmailSourceSchema = z.object({
  label:    z.string().min(1).optional(),
  imapHost: z.string().min(1).optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().email().optional(),
  imapPass: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})
