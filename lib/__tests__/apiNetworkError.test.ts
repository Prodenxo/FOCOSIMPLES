import { formatApiNetworkError, isApiNetworkError } from '../apiNetworkError'

describe('apiNetworkError', () => {
  it('detecta network request failed', () => {
    expect(isApiNetworkError('Network request failed')).toBe(true)
  })

  it('formata mensagem amigável', () => {
    const msg = formatApiNetworkError('Network request failed')
    expect(msg).toContain('Não foi possível conectar ao servidor')
  })
})
