import {
  applyCatalogClienteToNfeForm,
  applyCatalogClienteToNfseForm,
  buildCatalogClienteMetadataJson,
  catalogClienteHasNfeEndereco,
  catalogClienteHasTomadorEndereco,
  parseCatalogClienteFiscalMeta,
  validateCatalogClienteNfeFields,
} from '../meiCatalogClienteFiscal'
import { getDefaultNfeDestinatarioEndereco } from '../meiNfseForms'
import { DEFAULT_DESTINATARIO_IND_IE_DEST } from '../meiNfeDestinatarioIe'
import type { NfseCatalogCliente } from '../../services/meiNotasService'

describe('meiCatalogClienteFiscal', () => {
  it('detecta cliente NF-e sem endereço completo', () => {
    const item: NfseCatalogCliente = {
      id: '1',
      document_type: 'NFE',
      documento: '01858368000158',
      nome: 'Condomínio',
      email: 'a@b.com',
      metadata_json: null,
    }
    expect(catalogClienteHasNfeEndereco(item)).toBe(false)
  })

  it('aplica metadata do catálogo ao formulário NF-e', () => {
    const item: NfseCatalogCliente = {
      id: '1',
      document_type: 'NFE',
      documento: '01858368000158',
      nome: 'Condomínio Enseada',
      email: 'mardonortec@gmail.com',
      metadata_json: buildCatalogClienteMetadataJson({
        indIEDest: '9',
        endereco: {
          ...getDefaultNfeDestinatarioEndereco(),
          cep: '59082000',
          logradouro: 'Rua X',
          numero: '100',
          bairro: 'Centro',
          codigoCidade: '2408102',
          descricaoCidade: 'Natal',
          estado: 'RN',
        },
      }),
    }
    expect(catalogClienteHasNfeEndereco(item)).toBe(true)
    const prefill = applyCatalogClienteToNfeForm(item)
    expect(prefill.destinatarioIndIEDest).toBe('9')
    expect(prefill.destinatarioEndereco.codigoCidade).toBe('2408102')
    expect(parseCatalogClienteFiscalMeta(item.metadata_json).indIEDest).toBe('9')
  })

  it('exige endereço ao cadastrar cliente NF-e', () => {
    expect(
      validateCatalogClienteNfeFields('NFE', getDefaultNfeDestinatarioEndereco()),
    ).toMatch(/CEP/)
    expect(validateCatalogClienteNfeFields('NFSE', getDefaultNfeDestinatarioEndereco())).toBeNull()
  })

  it('aplica metadata do catálogo ao formulário NFS-e', () => {
    const item: NfseCatalogCliente = {
      id: '2',
      document_type: 'NFSE',
      documento: '38852157000118',
      nome: 'Tomador NFS-e',
      email: 'tomador@exemplo.com',
      metadata_json: buildCatalogClienteMetadataJson({
        endereco: {
          ...getDefaultNfeDestinatarioEndereco(),
          cep: '01310100',
          logradouro: 'Av Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
          codigoCidade: '3550308',
          descricaoCidade: 'São Paulo',
          estado: 'SP',
        },
      }),
    }
    expect(catalogClienteHasTomadorEndereco(item)).toBe(true)
    const prefill = applyCatalogClienteToNfseForm(item)
    expect(prefill.tomadorEmail).toBe('tomador@exemplo.com')
    expect(prefill.tomadorEndereco.descricaoCidade).toBe('São Paulo')
  })
})
