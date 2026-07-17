import {
  mapUserMeiCertificateRowToNfsePrestadorDto,
  normalizeUserMeiCertificateDbRow,
  type UserMeiCertificateRow,
} from '../meiPrestadorPrefillMapper';

const baseRow = (over: Partial<UserMeiCertificateRow> = {}): UserMeiCertificateRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  cnpj: null,
  razao_social: null,
  email: null,
  inscricao_municipal: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  codigo_ibge: null,
  cep: null,
  cidade: null,
  uf: null,
  ...over,
});

describe('normalizeUserMeiCertificateDbRow', () => {
  it('mapeia colunas legadas cert_document, fiscal_email, ibge_municipio', () => {
    const row = normalizeUserMeiCertificateDbRow({
      id: '11111111-1111-4111-8111-111111111111',
      cert_document: '12345678000190',
      fiscal_email: 'a@b.com',
      ibge_municipio: '3550308',
    });
    expect(row?.cnpj).toBe('12345678000190');
    expect(row?.email).toBe('a@b.com');
    expect(row?.codigo_ibge).toBe('3550308');
  });
});

describe('mapUserMeiCertificateRowToNfsePrestadorDto', () => {
  it('returns all nulls when row is null', () => {
    const dto = mapUserMeiCertificateRowToNfsePrestadorDto(null);
    expect(dto.prestadorCpfCnpj).toBeNull();
    expect(dto.prestadorEndereco).toBeNull();
    expect(dto.sourceRowId).toBeNull();
  });

  it('maps full row and normalizes CNPJ and CEP', () => {
    const dto = mapUserMeiCertificateRowToNfsePrestadorDto(
      baseRow({
        cnpj: '12.345.678/0001-90',
        razao_social: 'ACME',
        email: 'a@b.com',
        inscricao_municipal: '123',
        logradouro: 'Rua A',
        numero: '1',
        complemento: 'sala 2',
        bairro: 'Centro',
        codigo_ibge: '3550308',
        cep: '01310-100',
        cidade: 'São Paulo',
        uf: 'sp',
      })
    );
    expect(dto.prestadorCpfCnpj).toBe('12345678000190');
    expect(dto.prestadorRazaoSocial).toBe('ACME');
    expect(dto.prestadorEmail).toBe('a@b.com');
    expect(dto.prestadorInscricaoMunicipal).toBe('123');
    expect(dto.prestadorEndereco?.cep).toBe('01310100');
    expect(dto.prestadorEndereco?.codigoCidade).toBe('3550308');
    expect(dto.prestadorEndereco?.estado).toBe('SP');
    expect(dto.sourceRowId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('uses null endereco when no address fields', () => {
    const dto = mapUserMeiCertificateRowToNfsePrestadorDto(
      baseRow({
        cnpj: '12345678000190',
        razao_social: 'Só CNPJ',
      })
    );
    expect(dto.prestadorEndereco).toBeNull();
  });
});
