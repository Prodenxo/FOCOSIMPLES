import {
  getDefaultNfeLikeForm,
  getDefaultNfeItem,
  getNfeItemLineTotal,
  getNfeLikeValidationMessage,
  MEI_DEFAULT_NFE_CSOSN,
  MEI_DEFAULT_NFE_PIS_COFINS_CST,
} from '../meiNfseForms'

const VALID_CNPJ = '11222333000181'
const VALID_CPF = '52998224725'

function validNfeForm() {
  const form = getDefaultNfeLikeForm()
  form.emitenteCpfCnpj = VALID_CNPJ
  form.emitenteRazaoSocial = 'Emitente MEI'
  form.emitenteInscricaoEstadual = '123456789'
  form.destinatarioCpfCnpj = VALID_CPF
  form.destinatarioRazaoSocial = 'Cliente teste'
  form.destinatarioEndereco = {
    cep: '01310100',
    logradouro: 'Av Paulista',
    numero: '100',
    complemento: '',
    bairro: 'Bela Vista',
    codigoCidade: '3550308',
    descricaoCidade: 'São Paulo',
    estado: 'SP',
  }
  form.itens = [
    {
      codigo: '001',
      descricao: 'Agua 20 litros',
      ncm: '22011000',
      cfop: '5102',
      unidade: 'UN',
      quantidade: '1',
      valorUnitario: '10',
      desconto: '',
      cest: '',
      sku: '',
      tributos: {
        icms: { origem: '', cst: '', csosn: '102', modalidadeBaseCalculo: '', baseCalculo: '', aliquota: '', valor: '' },
        ipi: { cst: '', codigoEnquadramentoLegal: '', baseCalculo: '', aliquota: '', valor: '' },
        pis: { cst: '07', baseCalculo: '', aliquota: '', valor: '' },
        cofins: { cst: '07', baseCalculo: '', aliquota: '', valor: '' },
      },
    },
  ]
  return form
}

describe('getDefaultNfeItem', () => {
  it('pré-preenche tributos MEI (CSOSN 102, PIS/COFINS 49)', () => {
    const item = getDefaultNfeItem()
    expect(item.tributos.icms.csosn).toBe(MEI_DEFAULT_NFE_CSOSN)
    expect(item.tributos.pis.cst).toBe(MEI_DEFAULT_NFE_PIS_COFINS_CST)
    expect(item.tributos.cofins.cst).toBe(MEI_DEFAULT_NFE_PIS_COFINS_CST)
    expect(item.cfop).toBe('5102')
  })
})

describe('getNfeLikeValidationMessage', () => {
  it('aceita formulário NF-e completo e válido', () => {
    expect(getNfeLikeValidationMessage(validNfeForm(), 'NFE')).toBeNull()
  })

  it('exige IE do emitente na NF-e', () => {
    const form = validNfeForm()
    form.emitenteInscricaoEstadual = ''
    expect(getNfeLikeValidationMessage(form, 'NFE')).toMatch(/Inscrição Estadual do emitente/i)
  })

  it('exige CPF/CNPJ do destinatário (espelha backend)', () => {
    const form = validNfeForm()
    form.destinatarioCpfCnpj = ''
    expect(getNfeLikeValidationMessage(form, 'NFE')).toMatch(/destinatário.*obrigatório/i)
  })

  it('exige CFOP com 4 dígitos', () => {
    const form = validNfeForm()
    form.itens[0]!.cfop = '510'
    expect(getNfeLikeValidationMessage(form, 'NFE')).toMatch(/CFOP deve ter 4 dígitos/)
  })

  it('rejeita CSOSN ICMS com formato inválido', () => {
    const form = validNfeForm()
    form.itens[0]!.tributos.icms.csosn = '03025'
    expect(getNfeLikeValidationMessage(form, 'NFE')).toMatch(/CSOSN do ICMS deve ter 3 dígitos/)
  })

  it('rejeita CEST com tamanho inválido', () => {
    const form = validNfeForm()
    form.itens[0]!.cest = '123'
    expect(getNfeLikeValidationMessage(form, 'NFE')).toMatch(/CEST/)
  })
})

describe('getNfeItemLineTotal', () => {
  it('multiplica quantidade pelo valor unitário', () => {
    expect(
      getNfeItemLineTotal({ quantidade: '2', valorUnitario: '10,50' }),
    ).toBe(21)
  })

  it('retorna null se faltar qtd ou unitário', () => {
    expect(getNfeItemLineTotal({ quantidade: '', valorUnitario: '10' })).toBeNull()
  })
})
