export const MEI_CERT_INVALID_PASSWORD_CODE = 'MEI_CERT_INVALID_PASSWORD'
export const MEI_CERT_CPF_NOT_ALLOWED_CODE = 'MEI_CERT_CPF_NOT_ALLOWED'
export const MEI_CERT_CNPJ_NOT_MEI_CODE = 'MEI_CERT_CNPJ_NOT_MEI'
export const MEI_CERT_MEI_LOOKUP_FAILED_CODE = 'MEI_CERT_MEI_LOOKUP_FAILED'

export const MEI_CERT_INVALID_PASSWORD_TOAST =
  'A senha do certificado está inválida.'

export const MEI_CERT_CPF_NOT_ALLOWED_TOAST =
  'Este certificado é e-CPF (pessoa física). A área MEI exige certificado e-CNPJ do microempreendedor.'

export const MEI_CERT_CNPJ_NOT_MEI_TOAST =
  'Apenas certificado e-CNPJ de MEI é aceito. Simples Nacional, LTDA e outros regimes não são permitidos.'

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

export function getMeiCertificateUploadToast (error: unknown): string | null {
  if (isMeiCertificateInvalidPasswordError(error)) return MEI_CERT_INVALID_PASSWORD_TOAST
  if (isMeiCertificateCpfNotAllowedError(error)) return MEI_CERT_CPF_NOT_ALLOWED_TOAST
  if (isMeiCertificateCnpjNotMeiError(error)) return MEI_CERT_CNPJ_NOT_MEI_TOAST
  return null
}
