import {
  extractNotaClienteNome,
  formatNotaIntegracaoLabel,
  formatNotaValorLabel,
  resolveNotaCardTitle,
} from '../notaFiscalDisplay'

describe('notaFiscalDisplay', () => {
  it('remove prefixo mei- da integração', () => {
    expect(
      formatNotaIntegracaoLabel('mei-44cf7c54-4c69-42cf-a958-ebbcb921a1cf-1784662765402-ce22a5a4'),
    ).toBe('44cf7c54-4c69-42cf-a958-ebbcb921a1cf-1784662765402-ce22a5a4')
    expect(formatNotaIntegracaoLabel('fs-abc-123')).toBe('abc-123')
  })

  it('lê nome do tomador no payload', () => {
    expect(
      extractNotaClienteNome({
        payload_json: {
          tomador: { razaoSocial: 'Cliente Exemplo LTDA' },
          servico: [{ valor: { servico: 150.5 } }],
        },
      }),
    ).toBe('Cliente Exemplo LTDA')
  })

  it('prioriza cliente no título e formata valor', () => {
    const nota = {
      id: 'n1',
      id_integracao: 'mei-should-not-be-title',
      document_type: 'NFSE',
      payload_json: {
        tomador: { razaoSocial: 'ACME Serviços' },
        servico: [{ valor: { servico: 328.41 } }],
      },
    }
    expect(resolveNotaCardTitle(nota)).toBe('ACME Serviços')
    const valor = formatNotaValorLabel(nota)
    expect(valor).toBeTruthy()
    expect(valor!.replace(/\s/g, ' ')).toMatch(/328[,.]41/)
  })
})
