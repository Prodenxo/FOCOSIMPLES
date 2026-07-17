/** Reseta caches do `_layout` após concluir cadastro de CNPJ. */
let resetHandler: (() => void) | null = null

export function registerEmpresaCnpjLayoutGateReset (fn: () => void) {
  resetHandler = fn
}

export function unregisterEmpresaCnpjLayoutGateReset () {
  resetHandler = null
}

export function resetEmpresaCnpjLayoutGate () {
  resetHandler?.()
}
