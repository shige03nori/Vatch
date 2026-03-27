// src/types/pipeline.ts
export type PipelineMatching = {
  id: string
  caseId: string
  talentId: string
  status: string
  score: number
  skillMatchRate: number
  unitPriceOk: boolean
  timingOk: boolean
  locationOk: boolean
  costPrice: number
  sellPrice: number
  grossProfitRate: number
  memo: string | null
  case: {
    id: string
    title: string
    client: string
    unitPrice: number
    workStyle: string
    startDate: Date | null
    skills: string[]
    assignedUser: { id: string; name: string | null } | null
  }
  talent: {
    id: string
    name: string
    skills: string[]
    experience: number
    desiredRate: number | null
  }
  proposal: {
    id: string
    status: string
    to: string
    cc: string | null
    subject: string
    bodyText: string
    sentAt: Date | null
    grossProfitRate: number
    costPrice: number
    sellPrice: number
  } | null
}
