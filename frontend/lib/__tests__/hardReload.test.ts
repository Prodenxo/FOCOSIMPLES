import {
  hardReloadWithCacheBust,
  isDomReconciliationErrorMessage,
  isStaleChunkErrorMessage,
  tryAutoHardReloadForDomReconciliation,
  tryAutoHardReloadForStaleChunk,
} from '../hardReload'

describe('hardReload', () => {
  const originalPlatform = (require('react-native') as { Platform: { OS: string } }).Platform

  beforeEach(() => {
    originalPlatform.OS = 'web'
    const store: Record<string, string> = {}
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
        clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
      },
      configurable: true,
    })
  })

  it('detecta mensagens de chunk obsoleto', () => {
    expect(isStaleChunkErrorMessage('Failed to fetch dynamically imported module')).toBe(true)
    expect(isStaleChunkErrorMessage('erro genérico')).toBe(false)
  })

  it('detecta erros de reconciliação DOM', () => {
    expect(
      isDomReconciliationErrorMessage("Failed to execute 'removeChild' on 'Node'"),
    ).toBe(true)
    expect(isDomReconciliationErrorMessage('erro genérico')).toBe(false)
  })

  it('tryAutoHardReloadForStaleChunk só tenta uma vez por sessão', () => {
    const replace = jest.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, replace, href: 'https://meiinfinito.com.br/dashboard' },
      writable: true,
    })

    expect(tryAutoHardReloadForStaleChunk()).toBe(true)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(tryAutoHardReloadForStaleChunk()).toBe(false)
  })

  it('tryAutoHardReloadForDomReconciliation só tenta uma vez por sessão', () => {
    const replace = jest.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, replace, href: 'https://meiinfinito.com.br/' },
      writable: true,
    })

    expect(tryAutoHardReloadForDomReconciliation()).toBe(true)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(tryAutoHardReloadForDomReconciliation()).toBe(false)
  })

  it('hardReloadWithCacheBust adiciona query _mf_reload', () => {
    const replace = jest.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, replace, href: 'https://meiinfinito.com.br/' },
      writable: true,
    })

    hardReloadWithCacheBust()
    expect(replace).toHaveBeenCalled()
    const calledWith = replace.mock.calls[0][0] as string
    expect(calledWith).toContain('_mf_reload=')
  })
})
