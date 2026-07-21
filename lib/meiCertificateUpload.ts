export const MEI_CERT_INVALID_PASSWORD_CODE = 'MEI_CERT_INVALID_PASSWORD'
export const MEI_CERT_CPF_NOT_ALLOWED_CODE = 'MEI_CERT_CPF_NOT_ALLOWED'
export const MEI_CERT_CNPJ_NOT_MEI_CODE = 'MEI_CERT_CNPJ_NOT_MEI'
export const MEI_CERT_MEI_LOOKUP_FAILED_CODE = 'MEI_CERT_MEI_LOOKUP_FAILED'
export const SIMPLES_CERT_CNPJ_NOT_SIMPLES_CODE = 'SIMPLES_CERT_CNPJ_NOT_SIMPLES'

export const MEI_CERT_INVALID_PASSWORD_TOAST =
  'A senha do certificado está inválida.'

export const MEI_CERT_CPF_NOT_ALLOWED_TOAST =
  'Este certificado é e-CPF (pessoa física). A emissão fiscal exige certificado e-CNPJ da empresa.'

export const MEI_CERT_CNPJ_NOT_MEI_TOAST =
  'Apenas certificado e-CNPJ de MEI é aceito. Simples Nacional, LTDA e outros regimes não são permitidos.'

export const SIMPLES_CERT_CNPJ_NOT_SIMPLES_TOAST =
  'Use um certificado e-CNPJ de empresa optante do Simples Nacional.'

const extractErrorCode = (error: unknown): string | undefined => {
  const err = error as Error & { code?: string; errors?: { code?: string } }
  return err?.code || err?.errors?.code
}

export function isMeiCertificateInvalidPasswordError (error: unknown): boolean {
  const code = extractErrorCode(error)
  if (code === MEI_CERT_INVALID_PASSWORD_CODE) return true
  const message = String((error as Error)?.message ?? '').toLowerCase()
  return (
    message.includes('senha do certificado está inválida') ||
    (message.includes('senha') &&
      (message.includes('incorreta') || message.includes('inválida') || message.includes('invalida')))
  )
}

export function isMeiCertificateCpfNotAllowedError (error: unknown): boolean {
  if (extractErrorCode(error) === MEI_CERT_CPF_NOT_ALLOWED_CODE) return true
  const message = String((error as Error)?.message ?? '').toLowerCase()
  return message.includes('e-cpf') || message.includes('pessoa física')
}

export function isMeiCertificateCnpjNotMeiError (error: unknown): boolean {
  const code = extractErrorCode(error)
  if (code === MEI_CERT_CNPJ_NOT_MEI_CODE || code === MEI_CERT_MEI_LOOKUP_FAILED_CODE) return true
  const message = String((error as Error)?.message ?? '').toLowerCase()
  return message.includes('não está enquadrado como mei') || message.includes('nao esta enquadrado como mei')
}

export function isSimplesCertificateNotEligibleError (error: unknown): boolean {
  const code = extractErrorCode(error)
  if (code === SIMPLES_CERT_CNPJ_NOT_SIMPLES_CODE) return true
  const message = String((error as Error)?.message ?? '').toLowerCase()
  return (
    message.includes('simples nacional') &&
    (message.includes('não é optante') ||
      message.includes('nao e optante') ||
      message.includes('não está elegível') ||
      message.includes('nao esta elegivel'))
  )
}

export function getMeiCertificateUploadToast (
  error: unknown,
  options?: { product?: 'focosimples' | 'focomei' | string },
): string | null {
  if (isMeiCertificateInvalidPasswordError(error)) return MEI_CERT_INVALID_PASSWORD_TOAST
  if (isMeiCertificateCpfNotAllowedError(error)) return MEI_CERT_CPF_NOT_ALLOWED_TOAST
  if (isSimplesCertificateNotEligibleError(error)) return SIMPLES_CERT_CNPJ_NOT_SIMPLES_TOAST
  if (isMeiCertificateCnpjNotMeiError(error)) {
    if (options?.product === 'focosimples') {
      const backendMsg = String((error as Error)?.message ?? '').trim()
      if (backendMsg) return backendMsg
      return SIMPLES_CERT_CNPJ_NOT_SIMPLES_TOAST
    }
    return MEI_CERT_CNPJ_NOT_MEI_TOAST
  }
  return null
}
