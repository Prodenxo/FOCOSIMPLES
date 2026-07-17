import {
  isMeiCertificateInvalidPasswordError,
  MEI_CERT_INVALID_PASSWORD_CODE,
} from '../meiCertificateUpload'

describe('isMeiCertificateInvalidPasswordError', () => {
  it('reconhece código da API', () => {
    const err = new Error('outro texto') as Error & { code?: string }
    err.code = MEI_CERT_INVALID_PASSWORD_CODE
    expect(isMeiCertificateInvalidPasswordError(err)).toBe(true)
  })

  it('reconhece mensagem do backend', () => {
    expect(
      isMeiCertificateInvalidPasswordError(
        new Error('A senha do certificado está inválida.'),
      ),
    ).toBe(true)
  })

  it('reconhece mensagem legada com senha incorreta', () => {
    expect(
      isMeiCertificateInvalidPasswordError(
        new Error('Certificado inválido ou senha incorreta'),
      ),
    ).toBe(true)
  })

  it('ignora outros erros', () => {
    expect(
      isMeiCertificateInvalidPasswordError(new Error('Arquivo não informado')),
    ).toBe(false)
  })
})
