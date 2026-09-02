import { getNfseValidationMessage } from '../meiNfseForms'
import type { EmitirNfseInput } from '../../services/meiNotasService'

const baseInput = (): EmitirNfseInput => ({
  prestadorCpfCnpj: '65133609000184',
  prestadorEndereco: {
    logradouro: 'Rua Teste',
    numero: '100',
    codigoCidade: '3304557',
    cep: '21635000',
    complemento: '',
    bairro: 'Centro',
    estado: 'RJ',
    descricaoCidade: 'Rio de Janeiro',
  },
  tomadorCpfCnpj: '38852157000118',
  tomadorRazaoSocial: 'Tomador Teste',
  tomadorEmail: '',
  tomadorEndereco: {
    cep: '01310100',
    logradouro: 'Av Paulista',
    numero: '1000',
    complemento: '',
    bairro: 'Bela Vista',
    codigoCidade: '3550308',
    descricaoCidade: 'São Paulo',
    estado: 'SP',
  },
  servico: {
    codigo: '170601',
    cnae: '7319002',
    discriminacao: 'Promoção de vendas',
    valorServico: '1',
  },
})

describe('getNfseValidationMessage — alíquota opcional', () => {
  it('permite emitir NFS-e sem alíquota ISS (MEI/Simples)', () => {
    expect(getNfseValidationMessage(baseInput())).toBeNull()
  })

  it('valida alíquota apenas quando informada', () => {
    const input = baseInput()
    input.servico = { ...input.servico!, aliquota: 'abc' }
    expect(getNfseValidationMessage(input)).toMatch(/alíquota ISS válida/i)
  })

  it('exige endereço completo quando tomador é CNPJ', () => {
    const input = baseInput()
    input.tomadorEndereco = {
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      codigoCidade: '',
      descricaoCidade: '',
      estado: '',
    }
    expect(getNfseValidationMessage(input)).toMatch(/CEP do destinatário/i)
  })

  it('rejeita código de serviço com menos de 6 alfanuméricos', () => {
    const input = baseInput()
    input.servico = { ...input.servico!, codigo: '17.19' }
    expect(getNfseValidationMessage(input)).toMatch(/pelo menos 6 caracteres/i)
  })

  it('aceita código LC 116 completo com máscara', () => {
    const input = baseInput()
    input.servico = { ...input.servico!, codigo: '17.19.01' }
    expect(getNfseValidationMessage(input)).toBeNull()
  })
})
