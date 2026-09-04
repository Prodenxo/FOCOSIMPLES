import { apiClient } from '../lib/apiClient'

export type OpenaiUsagePeriod = 'month' | '7d' | 'today'

export type OpenaiUsageTotals = {
  calls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  audioSeconds: number
  costUsd: number
  costBrl: number
}

export type OpenaiUsageByUser = {
  phone: string
  userId: string | null
  label: string
  calls: number
  tokens: number
  costUsd: number
  costBrl: number
}

export type OpenaiUsageBySource = {
  source: string
  calls: number
  tokens: number
  costUsd: number
  costBrl: number
}

export type OpenaiUsageByProvider = {
  provider: 'deepseek' | 'openai' | 'openclaw' | string
  calls: number
  tokens: number
  audioSeconds: number
  costUsd: number
  costBrl: number
}

export type OpenaiUsageRecentLog = {
  createdAt: string
  source: string
  model: string
  phone: string | null
  tokens: number
  costUsd: number
  costBrl: number
}

export type OpenaiUsageDashboard = {
  period: OpenaiUsagePeriod
  from: string
  to: string
  usdBrl: number
  usdBrlSource: string
  totals: OpenaiUsageTotals
  byUser: OpenaiUsageByUser[]
  bySource: OpenaiUsageBySource[]
  byProvider: OpenaiUsageByProvider[]
  recentLogs: OpenaiUsageRecentLog[]
  note: string
}

export function fetchOpenaiUsage(period: OpenaiUsagePeriod = 'month') {
  return apiClient.get<OpenaiUsageDashboard>(
    `/admin/openai-usage?period=${encodeURIComponent(period)}`,
  )
}
