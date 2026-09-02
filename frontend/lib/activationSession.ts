/** Pular ativação só vale até o próximo logout (não persiste no banco). */
let sessionActivationSkipped = false

export function isSessionActivationSkipped (): boolean {
  return sessionActivationSkipped
}

export function setSessionActivationSkipped (value: boolean): void {
  sessionActivationSkipped = value
}

export function resetSessionActivationSkip (): void {
  sessionActivationSkipped = false
}
