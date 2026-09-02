import { isAuthPublicPath, pathToExpoHref } from '../authRedirect'

describe('authRedirect', () => {
  it('pathToExpoHref mapeia rotas do app', () => {
    expect(pathToExpoHref('/configuracoes/solicitacoes')).toBe(
      '/(app)/configuracoes/solicitacoes',
    )
    expect(pathToExpoHref('/')).toBe('/(app)/')
  })

  it('pathToExpoHref preserva query string', () => {
    expect(pathToExpoHref('/configuracoes?tab=perfil')).toBe(
      '/(app)/configuracoes?tab=perfil',
    )
  })

  it('isAuthPublicPath identifica rotas públicas', () => {
    expect(isAuthPublicPath('/login')).toBe(true)
    expect(isAuthPublicPath('/configuracoes')).toBe(false)
  })
})
