import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ActivationPayload } from '../services/activationService'

const STORAGE_KEY = '@focosimples/activation_panel_complete_v1'

export function isActivationPanelComplete (payload: ActivationPayload | null | undefined): boolean {
  if (!payload?.progress) return false
  const p = payload.progress as typeof payload.progress & {
    isPanelComplete?: boolean
  }
  return p.isPanelComplete === true
}

export async function readActivationPanelCompleteFlag (): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw === '1'
  } catch {
    return false
  }
}

export async function persistActivationPanelComplete (): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // best-effort
  }
}

export async function clearActivationPanelCompleteFlag (): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch {
    // best-effort
  }
}

/** Painel concluído no servidor ou flag local (não reaparece após 100%). */
export async function shouldHideActivationPanel (
  payload: ActivationPayload | null | undefined,
): Promise<boolean> {
  if (isActivationPanelComplete(payload)) {
    await persistActivationPanelComplete()
    return true
  }
  return readActivationPanelCompleteFlag()
}
