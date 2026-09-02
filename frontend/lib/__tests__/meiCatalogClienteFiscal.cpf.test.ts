import { describe, expect, it } from 'vitest'
import {
  mergeEnderecoFromCepLookup,
  validateCatalogClienteNfseTomadorFields,
} from './meiCatalogClienteFiscal'
import { getDefaultNfeDestinatarioEndereco } from './meiNfeDestinatarioEndereco'

describe('meiCatalogClienteFiscal — CPF tomador NFS-e', () => {
  it('não exige endereço para CPF (11 dígitos)', () => {
    const endereco = getDefaultNfeDestinatarioEndereco()
    expect(validateCatalogClienteNfseTomadorFields('12345678901', endereco)).toBeNull()
  })

  it('exige endereço completo para CNPJ na NFS-e', () => {
    const endereco = getDefaultNfeDestinatarioEndereco()
    expect(validateCatalogClienteNfseTomadorFields('12345678000199', endereco)).toMatch(/CEP/)
  })

  it('mergeEnderecoFromCepLookup preenche IBGE sem apagar número', () => {
    const merged = mergeEnderecoFromCepLookup(
      { ...getDefaultNfeDestinatarioEndereco(), numero: '42' },
      {
        cep: '21220290',
        logradouro: 'Rua Merces',
        bairro: 'Vila da Penha',
        codigoCidade: '3304557',
        descricaoCidade: 'Rio de Janeiro',
        estado: 'RJ',
      },
    )
    expect(merged.numero).toBe('42')
    expect(merged.codigoCidade).toBe('3304557')
  })
})
