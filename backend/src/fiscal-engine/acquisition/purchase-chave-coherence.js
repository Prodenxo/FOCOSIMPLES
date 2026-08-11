/**
 * Valida coerência da chave NF-e com campos do XML (não apenas strings copiadas).
 */
import { validateChaveNFe, validateInfNFeIdMatchesChave, onlyDigits } from './purchase-xml-validator.js';

const padLeft = (value, len, char = '0') => String(value ?? '').replace(/\D/g, '').padStart(len, char).slice(-len);

/**
 * Extrai componentes da chave NF-e (44 dígitos).
 * @param {string} chave
 */
export const parseChaveComponents = (chave) => {
  const digits = onlyDigits(chave, 44);
  if (digits.length !== 44) return null;
  return {
    cUF: digits.slice(0, 2),
    aamm: digits.slice(2, 6),
    cnpj: digits.slice(6, 20),
    mod: digits.slice(20, 22),
    serie: digits.slice(22, 25),
    nNF: digits.slice(25, 34),
    tpEmis: digits.slice(34, 35),
    cNF: digits.slice(35, 43),
    cDV: digits.slice(43, 44),
  };
};

/**
 * Monta chave a partir dos campos do XML para comparação cruzada.
 * @param {object} params
 */
export const buildChaveFromXmlFields = ({
  cUF,
  dhEmi,
  emitenteCnpj,
  modelo,
  serie,
  numero,
  tpEmis,
  cNF,
}) => {
  const aamm = String(dhEmi || '').replace(/\D/g, '').slice(2, 6);
  const base = [
    padLeft(cUF, 2),
    padLeft(aamm, 4),
    padLeft(emitenteCnpj, 14),
    padLeft(modelo, 2),
    padLeft(serie, 3),
    padLeft(numero, 9),
    padLeft(tpEmis ?? '1', 1),
    padLeft(cNF, 8),
  ].join('');

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

/**
 * @param {object} header — saída parcial do parser
 * @param {string} [infNfeId]
 */
export const validateChaveCoherenceWithXml = (header, infNfeId) => {
  const issues = [];
  const chaveCheck = validateChaveNFe(header.chaveNfe);
  if (!chaveCheck.ok) {
    return { ok: false, issues: [chaveCheck.reason], chave: header.chaveNfe };
  }
  const chave = chaveCheck.chave;
  const components = parseChaveComponents(chave);
  if (!components) {
    return { ok: false, issues: ['Chave com formato inválido'], chave };
  }

  if (String(header.modelo ?? '') && padLeft(header.modelo, 2) !== components.mod) {
    issues.push(`Modelo da chave (${components.mod}) difere do ide.mod (${padLeft(header.modelo, 2)})`);
  }
  if (header.serie != null && padLeft(header.serie, 3) !== components.serie) {
    issues.push(`Série da chave (${components.serie}) difere do ide.serie (${padLeft(header.serie, 3)})`);
  }
  if (header.numero != null && padLeft(header.numero, 9) !== components.nNF) {
    issues.push(`nNF da chave (${components.nNF}) difere do ide.nNF (${padLeft(header.numero, 9)})`);
  }
  if (header.emitenteCnpj && padLeft(header.emitenteCnpj, 14) !== components.cnpj) {
    issues.push('CNPJ emitente da chave difere do emit.CNPJ');
  }

  const rebuilt = buildChaveFromXmlFields({
    cUF: header.cUF ?? components.cUF,
    dhEmi: header.dhEmi,
    emitenteCnpj: header.emitenteCnpj,
    modelo: header.modelo,
    serie: header.serie,
    numero: header.numero,
    tpEmis: header.tpEmis ?? components.tpEmis,
    cNF: header.cNF ?? components.cNF,
  });
  if (rebuilt !== chave) {
    issues.push('Chave reconstruída a partir do XML difere da chave informada');
  }

  if (infNfeId) {
    const idCheck = validateInfNFeIdMatchesChave(infNfeId, chave);
    if (!idCheck.ok) issues.push(idCheck.reason);
  }

  if (header.protocolo?.chNFe) {
    const protChave = onlyDigits(header.protocolo.chNFe, 44);
    if (protChave && protChave !== chave) {
      issues.push('protNFe.infProt.chNFe difere da chave infNFe');
    }
  }

  return { ok: issues.length === 0, issues, chave, components };
};
