const MAX_XML_SEARCH_DEPTH = 10;

const PREFERRED_XML_KEYS = [
  'xml',
  'xmlEnvio',
  'xmlRetorno',
  'xmlAutorizado',
  'conteudo',
  'conteudoXml',
  'arquivo',
  'arquivoXml',
];

const looksLikeXml = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.includes('>'));
};

const collectXmlStrings = (value, depth = 0) => {
  if (depth > MAX_XML_SEARCH_DEPTH) return [];
  if (looksLikeXml(value)) return [value.trim()];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectXmlStrings(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return [];

  const found = [];
  for (const key of PREFERRED_XML_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      found.push(...collectXmlStrings(value[key], depth + 1));
    }
  }
  for (const [key, nested] of Object.entries(value)) {
    if (PREFERRED_XML_KEYS.includes(key)) continue;
    found.push(...collectXmlStrings(nested, depth + 1));
  }
  return found;
};

/**
 * Extrai o primeiro XML legível armazenado em response/metadata da nota.
 * @param {unknown} value
 * @returns {string|null}
 */
export const extractStoredXmlString = (value) => {
  const matches = collectXmlStrings(value);
  if (!matches.length) return null;
  return matches.sort((a, b) => b.length - a.length)[0];
};

/**
 * @param {{ response_json?: unknown, metadata_json?: unknown }|null|undefined} record
 * @returns {string|null}
 */
export const extractStoredXmlFromMeiNotaRecord = (record) => {
  if (!record || typeof record !== 'object') return null;
  return extractStoredXmlString(record.response_json)
    ?? extractStoredXmlString(record.metadata_json);
};

/**
 * Tenta baixar XML no PlugNotas por id ou idIntegracao+cnpj.
 * @param {{ downloadXml: Function, downloadXmlPorIntegracao?: Function }} adapter
 * @param {{ plugnotas_id?: string|null, id_integracao?: string|null, cnpj_prestador?: string|null }} record
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export const downloadXmlViaPlugnotasAdapter = async (adapter, record) => {
  const attempts = [];
  const plugnotasId = record?.plugnotas_id ? String(record.plugnotas_id).trim() : '';
  const idIntegracao = record?.id_integracao ? String(record.id_integracao).trim() : '';
  const cnpjPrestador = record?.cnpj_prestador ? String(record.cnpj_prestador).trim() : '';

  if (plugnotasId) {
    attempts.push(() => adapter.downloadXml(plugnotasId));
  }
  if (idIntegracao && cnpjPrestador && adapter.downloadXmlPorIntegracao) {
    attempts.push(() => adapter.downloadXmlPorIntegracao(idIntegracao, cnpjPrestador));
  }

  if (!attempts.length) {
    return null;
  }

  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

export const REJECTED_NFSE_XML_UNAVAILABLE_MESSAGE =
  'XML indisponível: esta nota foi rejeitada pela prefeitura e não gerou documento fiscal autorizado. Use «Ver motivo» para ver o código de erro (ex.: EM012).';
