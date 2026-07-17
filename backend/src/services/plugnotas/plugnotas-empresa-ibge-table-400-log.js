/**
 * FR-TIBGE-OBS-01: uma linha estruturada em 400 empresa quando a mensagem sugere rejeição
 * tabela IBGE — sem corpo completo do payload nem CNPJ literal (NFR-TIBGE-03; alinhado a
 * `plugnotas-empresa-cadastro-debug.js` / máscaras PII).
 *
 * Volume em produção: definir `PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG=off` para desligar este evento
 * (seguimento nota QA P2).
 */
import { normalizeIbgeMunicipioCodigo } from '../../utils/ibge-municipio-codigo.js';
import { maskPlugnotasPathOrUrlForLog } from './plugnotas-request-log-path.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Mesma ideia que `maskCnpj14` em `plugnotas-certificado-409-resolve-log.js`. */
const maskCnpjForLog = (digits) => {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length < 4) return '***';
  return `${d.slice(0, 2)}***${d.slice(-2)}`;
};

export const PLUGNOTAS_EMPRESA_IBGE_TABLE_REJECT_KIND = 'ibge_table';

/**
 * Por defeito o log está **ligado** em todos os ambientes. Use `off` / `false` / `0` / `none`
 * para desactivar (mitiga ruído se necessário).
 * @returns {boolean}
 */
export function isPlugnotasEmpresaIbgeTable400LogEnabled() {
  const raw = String(process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'none') return false;
  return true;
}

/**
 * @param {{ method: string, path: string, body: Record<string, unknown> }} params
 */
export const logPlugnotasEmpresaIbgeTable400 = ({ method, path, body }) => {
  if (!isPlugnotasEmpresaIbgeTable400LogEnabled()) return;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;

  const endereco = body.endereco && typeof body.endereco === 'object' && !Array.isArray(body.endereco)
    ? body.endereco
    : null;
  const codigoRaw = endereco && hasOwn(endereco, 'codigoCidade') ? endereco.codigoCidade : '';
  const codigoCidadeLen = normalizeIbgeMunicipioCodigo(codigoRaw).length;
  const cnpjDigits = String(body.cpfCnpj ?? '').replace(/\D/g, '');

  const payload = {
    tag: 'plugnotas_empresa_400_ibge_table',
    kind: PLUGNOTAS_EMPRESA_IBGE_TABLE_REJECT_KIND,
    method: String(method || ''),
    path: maskPlugnotasPathOrUrlForLog(String(path || '')),
    nodeEnv: process.env.NODE_ENV || '',
    codigoCidadeLen,
    cpfCnpj: maskCnpjForLog(cnpjDigits)
  };

  // eslint-disable-next-line no-console
  console.info('[plugnotas] empresa 400 ibge table', payload);
};
