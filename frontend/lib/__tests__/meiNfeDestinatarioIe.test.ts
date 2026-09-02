import {
  buildDestinatarioIePayload,
  humanizeFiscalEmitError,
  normalizeDestinatarioIndIeDest,
} from '../meiNfeDestinatarioIe'
import {
  buildNfeLikePayloadFromForm,
  getDefaultNfeLikeForm,
  getNfeLikeValidationMessage,
} from '../meiNfseForms'

const VALID_CNPJ = '11222333000181'
const VALID_CPF = '52998224725'

function validNfeForm() {
  const form = getDefaultNfeLikeForm()
  form.emitenteCpfCnpj = VALID_CNPJ
  form.emitenteRazaoSocial = 'Emitente MEI'
  form.destinatarioCpfCnpj = VALID_CPF
  form.destinatarioRazaoSocial = 'Condomínio teste'
  form.destinatarioIndIEDest = '9'
  form.destinatarioEndereco = {
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    complemento: '',
    bairro: 'Bela Vista',
    codigoCidade: '3550308',
    descricaoCidade: 'São Paulo',
    estado: 'SP',
  }
  form.itens[0]!.descricao = 'Agua 20 litros'
  form.itens[0]!.ncm = '22011000'
  form.itens[0]!.valorUnitario = '10'
  form.itens[0]!.tributos.icms.csosn = '102'
  form.itens[0]!.tributos.pis.cst = '49'
  form.itens[0]!.tributos.cofins.cst = '49'
  return form
}

describe('buildDestinatarioIePayload', () => {
  it('envia indIEDest 9 sem IE para não contribuinte', () => {
    expect(buildDestinatarioIePayload('9')).toEqual({ indIEDest: '9' })
  })

  it('envia IE só quando contribuinte ICMS', () => {
    expect(buildDestinatarioIePayload('1', '1234567890')).toEqual({
      indIEDest: '1',
      inscricaoEstadual: '1234567890',
    })
  })
})

describe('buildNfeLikePayloadFromForm indIEDest', () => {
  it('inclui indIEDest no destinatário', () => {
    const form = validNfeForm()
    const payload = buildNfeLikePayloadFromForm(form, 'NFE')
    expect(payload.destinatario?.indIEDest).toBe('9')
    expect(payload.destinatario?.inscricaoEstadual).toBeUndefined()
    expect(payload.destinatario?.endereco?.cep).toBe('01310100')
    expect(payload.pagamentos?.[0]?.valor).toBe(10)
  })
})

describe('getNfeLikeValidationMessage IE', () => {
  it('exige IE quando contribuinte ICMS', () => {
    const form = validNfeForm()
    form.destinatarioIndIEDest = '1'
    expect(getNfeLikeValidationMessage(form, 'NFE')).toMatch(/Inscrição Estadual/)
  })

  it('normaliza indIEDest inválido para não contribuinte', () => {
    expect(normalizeDestinatarioIndIeDest('x')).toBe('9')
  })
})

describe('humanizeFiscalEmitError', () => {
  it('expande erro interno genérico da Plugnotas', () => {
    const msg = humanizeFiscalEmitError(
      'Ocorreu um erro interno, nossa equipe já foi notificado do problema.',
      { documentType: 'NFE', nfeAtivo: false },
    )
    expect(msg).toMatch(/NF-e activa/)
    expect(msg).toMatch(/erro interno/i)
  })

  it('humaniza erro de e-mail obrigatório na NFS-e', () => {
    const msg = humanizeFiscalEmitError(
      'Operação interrompida pela ausência de parâmetros obrigatórios: email: Email é obrigatório.',
      { documentType: 'NFSE' },
    )
    expect(msg).toMatch(/Certificado/)
    expect(msg).toMatch(/prestador/i)
  })
})
