import { apiClient } from '../lib/apiClient'

export type ActivationStepStatus = 'pending' | 'completed'

export type ActivationStep = {
  id: string
  title: string
  description: string
  status: ActivationStepStatus
  required: boolean
  route: string
  completedAt: string | null
}

export type ActivationProgress = {
  completed: number
  totalRequired: number
  completedAll: number
  totalAll: number
  percent: number
  percentAll?: number
  pendingCount?: number
  /** Essenciais (5) concluídos */
  isComplete: boolean
  isCoreComplete?: boolean
  /** Inclui MEI e recomendados */
  isFullyComplete?: boolean
  hasPendingSteps?: boolean
  dismissStorage?: 'client'
}

export type ActivationPayload = {
  progress: ActivationProgress
  steps: ActivationStep[]
}

export async function fetchActivationProgress (): Promise<ActivationPayload | null> {
  try {
    return await apiClient.get<ActivationPayload>('/users/me/activation')
  } catch {
    return null
  }
}
