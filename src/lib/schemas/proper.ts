import { z } from 'zod'

export const CreateProperSchema = z.object({
  name:         z.string().min(1),
  email:        z.string().email(),
  skills:       z.array(z.string()).min(1),
  experience:   z.number().int().min(0),
  desiredRate:  z.number().int().min(0),
  location:     z.string().min(1),
  workStyle:    z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  office:       z.enum(['TOKYO', 'NAGOYA']),
  availableFrom: z.coerce.date().optional(),
})

export const UpdateProperSchema = z.object({
  name:         z.string().min(1).optional(),
  skills:       z.array(z.string()).min(1).optional(),
  experience:   z.number().int().min(0).optional(),
  desiredRate:  z.number().int().min(0).optional(),
  location:     z.string().min(1).optional(),
  workStyle:    z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  office:       z.enum(['TOKYO', 'NAGOYA']).optional(),
  status:       z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
  availableFrom: z.coerce.date().optional(),
})

export const ProperQuerySchema = z.object({
  office: z.enum(['TOKYO', 'NAGOYA']).optional(),
  status: z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(500).default(100),
})
