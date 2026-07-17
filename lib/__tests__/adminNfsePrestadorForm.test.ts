import {
  applyAdminPrestadorPrefill,
  emptyAdminNfseEmitirForm,
  formatPrestadorEnderecoResumoForAdmin,
} from '../adminNfsePrestadorForm';
import type { NfsePrestadorPrefillDto } from '../nfsePrestadorPrefillDto';

const digits = (s: string) => s.replace(/\D/g, '');

const fullPrefill = (): NfsePrestadorPrefillDto => ({
  prestadorCpfCnpj: '12345678000190',
  prestadorRazaoSocial: 'ACME LTDA',
  prestadorEmail: 'a@b.com',
  prestadorInscricaoMunicipal: 'IM1',
  prestadorEndereco: {
    logradouro: 'Rua X',
    numero: '10',
    codigoCidade: '3550308',
    cep: '01310100',
    complemento: '',
    bairro: 'Centro',
    estado: 'sp',
    descricaoCidade: 'São Paulo',
  },
  sourceRowId: 'row-1',
});

describe('formatPrestadorEnderecoResumoForAdmin (QA 2.4 — observabilidade)', () => {
  it('sem dados devolve vazio', () => {
    const r = formatPrestadorEnderecoResumoForAdmin({});
    expect(r.hasAddressData).toBe(false);
    expect(r.summaryText).toBe('');
  });

  it('monta linhas com logradouro, cidade, IBGE e CEP formatado', () => {
    const r = formatPrestadorEnderecoResumoForAdmin({
      logradouro: 'Rua X',
      numero: '10',
      bairro: 'Centro',
      descricaoCidade: 'São Paulo',
      estado: 'sp',
      codigoCidade: '3550308',
      cep: '01310100',
    });
    expect(r.hasAddressData).toBe(true);
    expect(r.summaryText).toContain('Rua X, 10');
    expect(r.summaryText).toContain('Centro');
    expect(r.summaryText).toContain('São Paulo — SP');
    expect(r.summaryText).toContain('IBGE 3550308');
    expect(r.summaryText).toContain('CEP 01310-100');
  });

  it('só complemento sem logradouro ainda conta como dado', () => {
    const r = formatPrestadorEnderecoResumoForAdmin({ complemento: 'Sala 2' });
    expect(r.hasAddressData).toBe(true);
    expect(r.summaryText).toContain('Sala 2');
  });
});

describe('emptyAdminNfseEmitirForm', () => {
  it('inicializa prestador e tomador/serviço vazios', () => {
    const f = emptyAdminNfseEmitirForm();
    expect(f.prestadorCpfCnpj).toBe('');
    expect(f.prestadorEndereco?.logradouro).toBe('');
    expect(f.tomadorCpfCnpj).toBe('');
    expect(f.servico.codigo).toBe('');
  });
});

describe('applyAdminPrestadorPrefill', () => {
  it('preenche a partir do DTO completo', () => {
    const f = applyAdminPrestadorPrefill(fullPrefill(), '99887766000155');
    expect(digits(f.prestadorCpfCnpj)).toBe('12345678000190');
    expect(f.prestadorRazaoSocial).toBe('ACME LTDA');
    expect(f.prestadorEndereco?.codigoCidade).toBe('3550308');
    expect(f.prestadorEndereco?.cep).toBe('01310100');
    expect(f.prestadorInscricaoMunicipal).toBe('IM1');
  });

  it('com DTO sem CNPJ, usa documento do certificado (14 dídig.)', () => {
    const prefill: NfsePrestadorPrefillDto = {
      ...fullPrefill(),
      prestadorCpfCnpj: null,
    };
    const f = applyAdminPrestadorPrefill(prefill, '11.222.333/0001-81');
    expect(digits(f.prestadorCpfCnpj)).toBe('11222333000181');
    expect(f.prestadorEndereco?.logradouro).toBe('Rua X');
  });

  it('com DTO vazio e só certificado, traz CNPJ sem endereço fictício', () => {
    const empty: NfsePrestadorPrefillDto = {
      prestadorCpfCnpj: null,
      prestadorRazaoSocial: null,
      prestadorEmail: null,
      prestadorInscricaoMunicipal: null,
      prestadorEndereco: null,
      sourceRowId: null,
    };
    const f = applyAdminPrestadorPrefill(empty, '11222333000181');
    expect(digits(f.prestadorCpfCnpj)).toBe('11222333000181');
    expect(f.prestadorEndereco?.logradouro).toBe('');
    expect(f.prestadorEndereco?.codigoCidade).toBe('');
  });
});
