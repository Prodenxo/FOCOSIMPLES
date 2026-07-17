import { badRequest, serviceUnavailable } from '../utils/errors.js';
import { MEI_GUIDE_SERPRO_UNAVAILABLE } from '../constants/mei-guide-error-codes.js';

export const MEI_DAS_PERIODO_INDISPONIVEL_CODE = 'MEI_DAS_PERIODO_INDISPONIVEL';

const INDISPONIVEL_TEXT_PATTERNS = [
  /n[aã]o\s+optante\s+pelo\s+simei/i,
  /MSG_23008/i,
  /empresa\s+baixada\s+para\s+o\s+ano/i,
  /MSG_23013/i,
  /per[ií]odo\s+de\s+apura[cç][aã]o\s+inv[aá]lido/i,
  /per[ií]odo\s+.*\s+futuro/i,
  /per[ií]odo\s+.*\s+decadente/i,
  /MSG_23030/i,
  /n[aã]o\s+h[aá]\s+das\s+a\s+ser\s+emitido/i,
  /n[aã]o\s+foi\s+emitido\s+das/i,
  /MSG_23017/i,
  /MSG_23019/i
];

/** Receita/SERPRO — período quitado (não gera novo DAS). Ex.: MSG_23018. */
export const SERPRO_PAID_MESSAGE_PATTERNS = [
  /j[aá]\s*est[aá]\s*pago/i,
  /j[aá]\s*foi\s*pago/i,
  /j[aá]\s+foi\s+efetuado\s+pagamento/i,
  /pagamento\s+para\s+este\s+pa/i,
  /MSG_23018/i,
  /23018[-\s].*pagamento/i,
  /n[aã]o\s+ser[aá]\s+gerado\s+das/i,
  /d[ée]bitos?\s+inexistentes?/i,
  /n[aã]o\s+h[aá]\s+d[ée]bitos?/i,
  /n[aã]o\s+existem\s+d[ée]bitos?/i,
  /sem\s+d[ée]bitos?/i,
  /n[aã]o\s+possui\s+pend[êe]ncias?/i,
  /guia\s+j[aá]\s+quitada/i,
  /situa[cç][aã]o.*liquidad/i,
  /\bliquidad[oa]\b/i,
];

export const isPeriodoPagoSerproMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return false;
  return SERPRO_PAID_MESSAGE_PATTERNS.some((pattern) => pattern.test(text));
};

export const isPeriodoPagoSerproError = (error) => {
  if (!error) return false;
  return isPeriodoPagoSerproMessage(error?.message);
};

/** SERPRO/Receita fora do ar ou timeout (503) — distinto de erro de negócio. */
export const isSerproUnavailableError = (error) => {
  if (!error) return false;
  if (error?.errors?.code === MEI_GUIDE_SERPRO_UNAVAILABLE) return true;
  if (error?.status === 503) return true;
  const msg = String(error?.message || '');
  return /temporariamente indisponível|falha de conexão com o serviço da receita/i.test(msg);
};

export const serproUnavailablePeriodError = (message) =>
  serviceUnavailable(
    message || 'O serviço da Receita Federal está temporariamente indisponível. Tente novamente em alguns minutos.',
    { code: MEI_GUIDE_SERPRO_UNAVAILABLE }
  );

const collectSerproMessagesText = (response) => {
  const parts = [];
  const raw = response?.raw ?? response;
  if (raw && typeof raw === 'object') {
    const mensagens = raw.mensagens;
    if (Array.isArray(mensagens)) {
      for (const item of mensagens) {
        if (typeof item === 'string') parts.push(item);
        else {
          parts.push(
            item?.texto
            ?? item?.mensagem
            ?? item?.descricao
            ?? item?.codigo
            ?? ''
          );
        }
      }
    } else if (typeof mensagens === 'string') {
      parts.push(mensagens);
    }
    if (raw.message) parts.push(String(raw.message));
    if (raw.error) parts.push(String(raw.error));
  }

  const dados = response?.dados;
  if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
    for (const key of ['observacao1', 'observacao2', 'observacao3', 'mensagem', 'message']) {
      const v = dados[key];
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    }
  } else if (Array.isArray(dados)) {
    for (const row of dados) {
      if (!row || typeof row !== 'object') continue;
      for (const key of ['observacao1', 'observacao2', 'observacao3', 'situacao', 'situacaoPagamento']) {
        const v = row[key];
        if (typeof v === 'string' && v.trim()) parts.push(v.trim());
      }
    }
  }

  return parts.filter(Boolean).join(' ').trim();
};

export const isPeriodoIndisponivelSerproMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return false;
  if (isPeriodoPagoSerproMessage(text)) return false;
  return INDISPONIVEL_TEXT_PATTERNS.some((pattern) => pattern.test(text));
};

export const isPeriodoIndisponivelSerproError = (error) => {
  if (!error) return false;
  if (isPeriodoPagoSerproMessage(error?.message)) return false;
  if (error?.errors?.code === MEI_DAS_PERIODO_INDISPONIVEL_CODE) return true;
  return isPeriodoIndisponivelSerproMessage(error?.message);
};

const buildIndisponivelUserMessage = (serproText, competenciaLabel) => {
  const label = competenciaLabel ? ` (${competenciaLabel})` : '';
  if (/n[aã]o\s+optante/i.test(serproText)) {
    return `DAS MEI indisponível${label}: neste período a empresa ainda não era optante pelo Simples (MEI). Use apenas competências após a abertura do CNPJ.`;
  }
  if (serproText) {
    return `DAS MEI indisponível${label}: ${serproText}`;
  }
  return `DAS MEI indisponível${label} para este período de apuração.`;
};

export const periodoIndisponivelError = (serproText, competenciaLabel) => {
  const message = buildIndisponivelUserMessage(serproText, competenciaLabel);
  return badRequest(message, {
    code: MEI_DAS_PERIODO_INDISPONIVEL_CODE,
    serproMessage: serproText || null
  });
};

/** Valida resposta SERPRO (HTTP 200 com avisos) antes de aceitar/gravar PDF. */
export const assertSerproDasPeriodoDisponivel = (response, competenciaLabel) => {
  const serproText = collectSerproMessagesText(response);
  if (isPeriodoPagoSerproMessage(serproText)) {
    throw new Error(serproText || 'Período já quitado na Receita');
  }
  if (isPeriodoIndisponivelSerproMessage(serproText)) {
    throw periodoIndisponivelError(serproText, competenciaLabel);
  }
  return serproText;
};

export const competenciaLabelFromPeriod = (period) => {
  const digits = String(period || '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  return `${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
};
