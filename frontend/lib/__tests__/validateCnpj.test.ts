import { describe, it, expect } from '@jest/globals'
import { isValidCnpjDigits } from '../validateCnpj'
import { humanizeCnpjLookupError } from '../humanizeCnpjLookupError'

describe('isValidCnpjDigits', () => {
  it('aceita CNPJ com dígitos verificadores corretos', () => {
    expect(isValidCnpjDigits('22873938000159')).toBe(true)
    expect(isValidCnpjDigits('11222333000181')).toBe(true)
  })

  it('rejeita CNPJ com DV incorreto', () => {
    expect(isValidCnpjDigits('22873938000195')).toBe(false)
    expect(isValidCnpjDigits('11111111111111')).toBe(false)
  })
})

describe('humanizeCnpjLookupError', () => {
  it('extrai mensagem de JSON embutido no erro', () => {
    const err = new Error(
      'Falha ao consultar CNPJ (400): {"message":"CNPJ 22.873.938/0001-95 inválido.","type":"bad_request"}'
    )
    expect(humanizeCnpjLookupError(err)).toBe(
      'CNPJ inválido. Verifique os dígitos e tente novamente.'
    )
  })
})
