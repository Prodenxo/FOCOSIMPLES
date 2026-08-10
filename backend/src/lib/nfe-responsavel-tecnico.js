/**
 * Grupo infRespTec (responsável técnico) exigido pela SEFAZ em NF-e/NFC-e.
 * PlugNotas: campo `responsavelTecnico` no JSON de emissão.
 */

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

/** Padrão PlugNotas/Tecnospeed quando env não configurada (documentação oficial). */
export const PLUGNOTAS_RESPONSAVEL_TECNICO_DEFAULT = Object.freeze({
  cpfCnpj: '29062609000177',
  nome: 'Tecnospeed',
  email: 'contato@tecnospeed.com.br',
  telefone: { ddd: '44', numero: '30379500' },
});

const parseTelefoneFromDigits = (digits) => {
  const clean = normalizeDoc(digits);
  if (clean.length < 10) return null;
  return { ddd: clean.slice(0, 2), numero: clean.slice(2) };
};

const normalizeTelefoneBlock = (telefone, fallbackDigits = '') => {
  if (telefone && typeof telefone === 'object') {
    const ddd = normalizeDoc(telefone.ddd);
    const numero = normalizeDoc(telefone.numero);
    if (ddd.length === 2 && numero.length >= 8) {
      return { ddd, numero };
    }
  }
  return parseTelefoneFromDigits(fallbackDigits);
};

const normalizeResponsavelTecnicoBlock = (block) => {
  if (!block || typeof block !== 'object') return null;

  const cpfCnpj = normalizeDoc(block.cpfCnpj);
  const nome = String(block.nome || '').trim();
  const email = String(block.email || '').trim();
  const telefone = normalizeTelefoneBlock(block.telefone);

  if (cpfCnpj.length !== 14 || !nome || !email || !telefone) return null;

  return { cpfCnpj, nome, email, telefone };
};

/** Monta infRespTec a partir das variáveis de ambiente do backend. */
export const buildNfeResponsavelTecnicoFromEnv = () => {
  const cpfCnpj = normalizeDoc(
    process.env.NFE_RESPONSAVEL_TECNICO_CNPJ
      || process.env.SERPRO_CONTRATANTE_NUMERO
      || '',
  );
  const nome = String(
    process.env.NFE_RESPONSAVEL_TECNICO_NOME
      || process.env.SERPRO_CONTRATANTE_NOME
      || process.env.SERPRO_ASSINADO_POR_NOME
      || '',
  ).trim();
  const email = String(
    process.env.NFE_RESPONSAVEL_TECNICO_EMAIL
      || process.env.RESEND_FROM_EMAIL
      || '',
  ).trim();
  const ddd = normalizeDoc(process.env.NFE_RESPONSAVEL_TECNICO_DDD);
  const numero = normalizeDoc(process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE);

  let telefone = null;
  if (ddd.length === 2 && numero.length >= 8) {
    telefone = { ddd, numero };
  } else {
    telefone = parseTelefoneFromDigits(process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE);
  }

  if (cpfCnpj.length !== 14 || !nome || !email || !telefone) return null;

  return { cpfCnpj, nome, email, telefone };
};

/**
 * Payload NF-e/NFC-e: usa bloco do cliente, senão env (NFE_* + fallback SERPRO contratante),
 * senão padrão PlugNotas/Tecnospeed.
 * @param {unknown} fromPayload
 */
export const resolveNfeResponsavelTecnicoForPlugnotas = (fromPayload) => {
  const fromClient = normalizeResponsavelTecnicoBlock(fromPayload);
  if (fromClient) return fromClient;

  const fromEnv = buildNfeResponsavelTecnicoFromEnv();
  if (fromEnv) return fromEnv;

  return { ...PLUGNOTAS_RESPONSAVEL_TECNICO_DEFAULT };
};
