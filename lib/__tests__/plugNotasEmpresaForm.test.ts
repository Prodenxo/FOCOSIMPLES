import {
  buildPlugNotasEmpresaPayload,
  getDefaultPlugNotasCompanyForm,
  getPlugNotasCompanyValidationMessage,
} from '../plugNotasEmpresaForm';

describe('buildPlugNotasEmpresaPayload', () => {
  it('inclui documentosAtivos para o backend aplicar toggles NF-e/NFC-e', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '1',
      bairro: 'Centro',
      cep: '01310100',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      nfseAtivo: true,
      nfeAtivo: true,
      nfceAtivo: false,
    };
    const payload = buildPlugNotasEmpresaPayload({
      cnpj: '12345678000199',
      certificadoId: '',
      form,
    });
    expect(payload.documentosAtivos).toEqual({ nfse: true, nfe: true, nfce: false });
    expect(payload.certificado).toBeUndefined();
    expect((payload.nfe as { ativo: boolean }).ativo).toBe(true);
    expect(payload.rps).toEqual({ lote: 1, numeracao: [{ numero: 1, serie: '1' }] });
    expect((payload.nfse as { config: Record<string, unknown> }).config.nfseNacional).toBe(true);
    expect((payload.nfse as { config: Record<string, unknown> }).config.rps).toEqual({
      serie: '1',
      numero: 1,
      lote: 1,
    });
  });

  it('exige e-mail válido antes de cadastrar no emissor fiscal', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '1',
      bairro: 'Centro',
      cep: '01310100',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      email: '',
    };
    expect(getPlugNotasCompanyValidationMessage(form)).toMatch(/e-mail/i);

    const invalid = { ...form, email: 'sem-arroba' };
    expect(getPlugNotasCompanyValidationMessage(invalid)).toMatch(/e-mail válido/i);
  });

  it('bloqueia salvar com NFC-e ativa sem CSC (Plugnotas exige sefaz)', () => {
    const form = {
      ...getDefaultPlugNotasCompanyForm(),
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '1',
      bairro: 'Centro',
      cep: '01310100',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      email: 'contato@empresa.com.br',
      nfseAtivo: true,
      nfeAtivo: true,
      nfceAtivo: true,
    };
    expect(getPlugNotasCompanyValidationMessage(form)).toMatch(/NFC-e exige CSC/i);
  });
});
