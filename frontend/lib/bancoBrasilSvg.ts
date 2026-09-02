/**
 * Ícones via `@edusites/bancos-brasil`.
 * `require` tardio em `core.js` — import estático no topo quebrava o boot web (ExpoRoot).
 * Não usar o `index.js` da lib (puxa Vue).
 */
export type BancoSvgOptions = {
  nome: string
  formato?: 'circulo' | 'quadrado' | 'sem'
  tamanho?: number
  cor?: string
  fundo?: string
}

function loadSvgBancoFn(): ((options: BancoSvgOptions) => string | null) | null {
  try {
    const mod = require('@edusites/bancos-brasil/src/core.js') as {
      svgBanco?: (options: BancoSvgOptions) => string | null
    }
    return typeof mod.svgBanco === 'function' ? mod.svgBanco : null
  } catch (e) {
    if (__DEV__) {
      console.warn('[bancoBrasilSvg] falha ao carregar core.js:', e)
    }
    return null
  }
}

export function renderBancoSvg(options: BancoSvgOptions): string | null {
  const svgBanco = loadSvgBancoFn()
  if (!svgBanco) return null
  try {
    return svgBanco(options)
  } catch (e) {
    if (__DEV__) {
      console.warn('[bancoBrasilSvg] svgBanco falhou:', e)
    }
    return null
  }
}
