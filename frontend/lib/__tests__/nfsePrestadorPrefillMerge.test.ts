import {
  mergeNfsePrestadorPrefillIntoForm,
  mergeNfeEmitentePrefillIntoForm,
  getDefaultNfeLikeForm,
  isNfsePrestadorPrefillEffectivelyEmpty,
} from '../meiNfseForms';
import type { EmitirNfseInput } from '../../services/meiNotasService';
import type { NfsePrestadorPrefillDto } from '../nfsePrestadorPrefillDto';

const emptyForm = (): EmitirNfseInput => ({
  prestadorCpfCnpj: '',
  prestadorEndereco: {
    logradouro: '',
    numero: '',
    codigoCidade: '',
    cep: '',
    complemento: '',
    bairro: '',
    estado: '',
    descricaoCidade: '',
  },
  tomadorCpfCnpj: '',
  tomadorRazaoSocial: '',
  tomadorEmail: '',
  servico: { codigo: '', discriminacao: '', cnae: '', aliquota: '', valorServico: '' },
});

const samplePrefill = (): NfsePrestadorPrefillDto => ({
  prestadorCpfCnpj: '12345678000190',
  prestadorRazaoSocial: 'ACME LTDA',
  prestadorEmail: 'a@b.com',
  prestadorInscricaoMunicipal: 'IM123',
  prestadorEndereco: {
    logradouro: 'Rua X',
    numero: '10',
    codigoCidade: '3550308',
    cep: '01310100',
    complemento: 'sala 1',
    bairro: 'Centro',
    estado: 'sp',
    descricaoCidade: 'São Paulo',
  },
  sourceRowId: '550e8400-e29b-41d4-a716-446655440000',
});

describe('isNfsePrestadorPrefillEffectivelyEmpty', () => {
  it('returns true for all-null payload', () => {
    expect(
      isNfsePrestadorPrefillEffectivelyEmpty({
        prestadorCpfCnpj: null,
        prestadorRazaoSocial: null,
        prestadorEmail: null,
        prestadorInscricaoMunicipal: null,
        prestadorEndereco: null,
        sourceRowId: null,
      })
    ).toBe(true);
  });

  it('returns true when só sourceRowId sem dados de prestador (payload incoerente)', () => {
    expect(
      isNfsePrestadorPrefillEffectivelyEmpty({
        prestadorCpfCnpj: null,
        prestadorRazaoSocial: null,
        prestadorEmail: null,
        prestadorInscricaoMunicipal: null,
        prestadorEndereco: null,
        sourceRowId: '550e8400-e29b-41d4-a716-446655440000',
      })
    ).toBe(true);
  });

  it('returns false when CNPJ present', () => {
    expect(
      isNfsePrestadorPrefillEffectivelyEmpty({
        prestadorCpfCnpj: '12.345.678/0001-90',
        prestadorRazaoSocial: null,
        prestadorEmail: null,
        prestadorInscricaoMunicipal: null,
        prestadorEndereco: null,
      })
    ).toBe(false);
  });

  it('returns false when only endereço parcial no prefill', () => {
    expect(
      isNfsePrestadorPrefillEffectivelyEmpty({
        prestadorCpfCnpj: null,
        prestadorRazaoSocial: null,
        prestadorEmail: null,
        prestadorInscricaoMunicipal: null,
        prestadorEndereco: { logradouro: 'Rua A', numero: null, codigoCidade: null, cep: null, complemento: null, bairro: null, estado: null, descricaoCidade: null },
      })
    ).toBe(false);
  });
});

describe('mergeNfsePrestadorPrefillIntoForm', () => {
  it('fills empty form and formats CNPJ', () => {
    const merged = mergeNfsePrestadorPrefillIntoForm(emptyForm(), samplePrefill());
    expect(merged.prestadorCpfCnpj).toBe('12.345.678/0001-90');
    expect(merged.prestadorRazaoSocial).toBe('ACME LTDA');
    expect(merged.prestadorEmail).toBe('a@b.com');
    expect(merged.prestadorInscricaoMunicipal).toBe('IM123');
    expect(merged.prestadorEndereco?.logradouro).toBe('Rua X');
    expect(merged.prestadorEndereco?.cep).toBe('01310100');
    expect(merged.prestadorEndereco?.estado).toBe('SP');
    expect(merged.tomadorCpfCnpj).toBe('');
  });

  it('with onlyFillEmpty, substitui todos os campos quando CNPJ diverge (troca de certificado)', () => {
    const form = emptyForm();
    form.prestadorCpfCnpj = '98.765.432/0001-00';
    form.prestadorRazaoSocial = '65.805.583 YASMIM DUQUE CONRADO FERREIRA';
    form.prestadorEmail = 'yasmim.duque@cffranquias.com.br';
    form.prestadorEndereco.logradouro = 'Oliveira Belo';
    form.prestadorEndereco.numero = '441';
    form.prestadorEndereco.cep = '20755065';
    form.prestadorEndereco.bairro = 'ABOLICAO';
    const merged = mergeNfsePrestadorPrefillIntoForm(form, samplePrefill(), { onlyFillEmpty: true });
    expect(merged.prestadorCpfCnpj).toBe('12.345.678/0001-90');
    expect(merged.prestadorRazaoSocial).toBe('ACME LTDA');
    expect(merged.prestadorEmail).toBe('a@b.com');
    expect(merged.prestadorEndereco?.logradouro).toBe('Rua X');
    expect(merged.prestadorEndereco?.bairro).toBe('Centro');
  });

  it('with onlyFillEmpty false, overwrites CNPJ', () => {
    const form = emptyForm();
    form.prestadorCpfCnpj = '98.765.432/0001-00';
    const merged = mergeNfsePrestadorPrefillIntoForm(form, samplePrefill(), { onlyFillEmpty: false });
    expect(merged.prestadorCpfCnpj).toBe('12.345.678/0001-90');
  });
});

describe('mergeNfeEmitentePrefillIntoForm', () => {
  it('fills emitente from prefill and inscrição estadual', () => {
    const merged = mergeNfeEmitentePrefillIntoForm(
      getDefaultNfeLikeForm(),
      samplePrefill(),
      { inscricaoEstadual: '123456789' }
    );
    expect(merged.emitenteCpfCnpj).toBe('12.345.678/0001-90');
    expect(merged.emitenteRazaoSocial).toBe('ACME LTDA');
    expect(merged.emitenteInscricaoEstadual).toBe('123456789');
  });

  it('with onlyFillEmpty, atualiza emitente quando CNPJ do prefill diverge (troca de certificado)', () => {
    const form = getDefaultNfeLikeForm();
    form.emitenteCpfCnpj = '98.765.432/0001-00';
    form.emitenteRazaoSocial = '65.805.583 YASMIM DUQUE CONRADO FERREIRA';
    const merged = mergeNfeEmitentePrefillIntoForm(form, samplePrefill(), {}, { onlyFillEmpty: true });
    expect(merged.emitenteCpfCnpj).toBe('12.345.678/0001-90');
    expect(merged.emitenteRazaoSocial).toBe('ACME LTDA');
  });
});
