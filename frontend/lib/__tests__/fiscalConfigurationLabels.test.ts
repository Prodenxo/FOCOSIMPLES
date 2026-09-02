import {
  labelFiscalUiStatus,
  labelPriorStStatus,
  fiscalStatusTone,
  formatCapabilityMessage,
} from '@/lib/fiscalConfiguration/labels'

describe('fiscalConfigurationLabels', () => {
  it('traduz priorStStatus para UI', () => {
    expect(labelPriorStStatus('NO_ST_EVIDENCE')).toMatch(/Sem evidência/)
    expect(labelPriorStStatus('UNKNOWN')).toMatch(/Não confirmado/)
    expect(labelPriorStStatus('RETAINED')).toMatch(/retido/)
  })

  it('mapeia status fiscal visuais', () => {
    expect(labelFiscalUiStatus('READY')).toBe('Pronto')
    expect(fiscalStatusTone('BLOQUEADO')).toBe('danger')
  })

  it('formata mensagem de capability bloqueada', () => {
    expect(
      formatCapabilityMessage({
        executable: false,
        issues: [{ message: 'Motor indisponível para CSOSN 900' }],
      }),
    ).toMatch(/Motor indisponível/)
  })
})
