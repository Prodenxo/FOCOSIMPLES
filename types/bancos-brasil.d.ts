declare module '@edusites/bancos-brasil/src/core.js' {
  export type SvgBancoOptions = {
    nome: string
    formato?: 'circulo' | 'quadrado' | 'sem'
    tamanho?: number
    cor?: string
    fundo?: string
    className?: string
  }

  export function svgBanco(options: SvgBancoOptions): string | null
  export function listarBancos(): string[]
  export function obterPreset(nome: string): Record<string, unknown> | null
}
