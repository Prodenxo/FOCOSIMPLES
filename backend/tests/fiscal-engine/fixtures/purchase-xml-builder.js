/**
 * Gera chave NF-e válida (44 dígitos) para fixtures de teste.
 * @param {string} [suffix8] últimos 8 dígitos antes do DV (cNF+cDV area simplified)
 */
export const buildTestChaveNfe = (suffix8 = '12345678') => {
  const uf = '33';
  const aamm = '2601';
  const cnpj = '14200166000187';
  const modSerieNum = '55001000000001';
  const tpEmisCod = `1${String(suffix8).replace(/\D/g, '').padStart(8, '0').slice(0, 8)}`;
  const base = `${uf}${aamm}${cnpj}${modSerieNum}${tpEmisCod}`.slice(0, 43).padEnd(43, '0');

  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return `${base}${dv}`;
};

const chaveField = (chave, start, end) => String(chave).slice(start, end);

/**
 * Monta XML NF-e mínimo para testes do parser.
 */
export const buildMinimalPurchaseNfeXml = ({
  chave,
  cStat = '100',
  nProt = '133123456789012',
  withProtocol = true,
  destCnpj = '12345678000199',
  digVal = null,
  dhRecbto = null,
  emitCpf = null,
  items = [],
}) => {
  const ch = chave || buildTestChaveNfe();
  const infId = `NFe${ch}`;
  const cUF = chaveField(ch, 0, 2);
  const tpEmis = chaveField(ch, 34, 35);
  const cNF = chaveField(ch, 35, 43);
  const mod = String(Number(chaveField(ch, 20, 22)));
  const serie = String(Number(chaveField(ch, 22, 25)));
  const nNF = String(Number(chaveField(ch, 25, 34)));
  const emitCnpj = chaveField(ch, 6, 20);

  const normalizedItems = items.length > 0 ? items : [{}];
  const itemsXml = normalizedItems.map((it, idx) => {
    const n = idx + 1;
    const icmsInner = it.icmsXml || '<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>';
    return `
    <det nItem="${n}">
      <prod>
        <cProd>${it.cProd || 'SKU1'}</cProd>
        <cEAN>${it.cEAN || 'SEM GTIN'}</cEAN>
        <xProd>${it.xProd || 'Produto teste'}</xProd>
        <NCM>${it.ncm || '22021000'}</NCM>
        ${it.cest ? `<CEST>${it.cest}</CEST>` : ''}
        <CFOP>${it.cfop || '1102'}</CFOP>
        <uCom>${it.uCom || 'UN'}</uCom>
        <qCom>${it.qCom || '1.0000'}</qCom>
        <vUnCom>${it.vUnCom || '10.0000000000'}</vUnCom>
        <vProd>${it.vProd || '10.00'}</vProd>
        <cEANTrib>${it.cEANTrib || 'SEM GTIN'}</cEANTrib>
        <uTrib>${it.uTrib || it.uCom || 'UN'}</uTrib>
        <qTrib>${it.qTrib ?? it.qCom ?? '1.0000'}</qTrib>
        <vUnTrib>${it.vUnTrib || it.vUnCom || '10.0000000000'}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>${icmsInner}</ICMS>
      </imposto>
    </det>`;
  }).join('');

  const prot = withProtocol ? `
  <protNFe versao="4.00">
    <infProt>
      <cStat>${cStat}</cStat>
      <nProt>${nProt}</nProt>
      <chNFe>${ch}</chNFe>
      ${digVal ? `<digVal>${digVal}</digVal>` : ''}
      ${dhRecbto ? `<dhRecbto>${dhRecbto}</dhRecbto>` : ''}
    </infProt>
  </protNFe>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="${infId}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <mod>${mod}</mod>
        <serie>${serie}</serie>
        <nNF>${nNF}</nNF>
        <tpEmis>${tpEmis}</tpEmis>
        <cNF>${cNF}</cNF>
        <dhEmi>2026-01-15T10:00:00-03:00</dhEmi>
      </ide>
      ${emitCpf
    ? `<emit><CPF>${emitCpf}</CPF><xNome>Fornecedor Teste</xNome></emit>`
    : `<emit><CNPJ>${emitCnpj}</CNPJ><xNome>Fornecedor Teste</xNome></emit>`}
      <dest><CNPJ>${destCnpj}</CNPJ><xNome>Destinatario</xNome></dest>
      ${itemsXml}
    </infNFe>
  </NFe>
  ${prot}
</nfeProc>`;
};
