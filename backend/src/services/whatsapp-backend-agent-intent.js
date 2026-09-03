import { foldPt, resolvePeriodFromText } from './openclaw-period.js';

const looksLikeCreateLancamento = (t) =>
  /(\bgastei\b|\brecebi\b|\bpaguei\b|\bcomprei\b|\blanc[ae]i?\b).{0,24}\d/.test(t)
  && !/\bquanto\b/.test(t);

const periodFromText = (text, now) => {
  const resolved = resolvePeriodFromText(text, now);
  if (resolved) return resolved;
  if (/\b(quanto|total|extrato|resumo|gastos?|despesas?|receitas?)\b/.test(foldPt(text))) {
    return resolvePeriodFromText('este mes', now);
  }
  return null;
};

/**
 * Consultas óbvias — o modelo às vezes responde "não consigo" sem chamar a ação.
 * Lançamento, nota, correção e agenda com horário ficam com o modelo + SOUL.
 * @param {string} text
 * @param {Date} [now]
 * @returns {{ action: string, payload: Record<string, unknown> } | null}
 */
export const matchQuickWhatsappIntent = (text, now = new Date()) => {
  const t = foldPt(text);
  if (!t) return null;
  if (looksLikeCreateLancamento(t)) return null;

  if (/\b(das|guia mei|guia do mei)\b/.test(t) && !/\b(nota|nfse|nfe)\b/.test(t)) {
    if (/\b(manda|envie|envia|enviar|reenviar|pdf|guia)\b/.test(t)) {
      return { action: 'send_das_whatsapp', payload: {} };
    }
    return { action: 'get_das_payment_status', payload: {} };
  }

  if (/\b(nota|nfse|nfe|emitir|emissao)\b/.test(t)) return null;

  if (
    /^(lista(r)? )?categorias?$/.test(t)
    || (/\bcategorias?\b/.test(t) && /\b(lista|quais|qual|minhas?|mostra)\b/.test(t))
  ) {
    return { action: 'list_categories', payload: { minimal: true } };
  }

  if (
    /\b(carteiras?|contas?)\b/.test(t)
    && /\b(lista|quais|qual|minhas?|mostra|tenho)\b/.test(t)
    && !/\b(saldo|gastei|recebi)\b/.test(t)
  ) {
    return { action: 'list_contas', payload: {} };
  }

  if (/\b(proximo compromisso|proxima reuniao|qual (e )?o (meu )?proximo)\b/.test(t)) {
    return { action: 'get_next_calendar_event', payload: {} };
  }

  if (/\b(agenda hoje|tarefas de hoje|compromissos de hoje|o que tenho hoje)\b/.test(t)) {
    return { action: 'list_agenda_checklist_today', payload: {} };
  }

  if (/\b(proximos compromissos|agenda da semana|proximos eventos)\b/.test(t)) {
    return { action: 'list_upcoming_calendar_events', payload: {} };
  }

  const period = resolvePeriodFromText(t, now);
  const isSpendQuery = /\b(quanto (eu )?gastei|gastos?|despesas?|saidas?)\b/.test(t);
  const isIncomeQuery = /\b(quanto (eu )?recebi|receitas?|entradas?)\b/.test(t);
  const isOnlyPeriod = Boolean(period) && /^(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:ate|a|-)\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|mes passado|este mes|esse mes)$/.test(t);

  if (isSpendQuery || isIncomeQuery || isOnlyPeriod) {
    const range = periodFromText(t, now);
    if (!range) return null;
    const payload = { from: range.from, to: range.to };
    if (isSpendQuery && !isIncomeQuery) payload.tipo = 'saida';
    if (isIncomeQuery && !isSpendQuery) payload.tipo = 'entrada';
    return { action: 'list_transactions', payload };
  }

  if (/\b(saldo|quanto (eu )?tenho|quanto tem)\b/.test(t)) {
    if (period) {
      return {
        action: 'list_transactions',
        payload: { from: period.from, to: period.to },
      };
    }
    return { action: 'get_saldo', payload: {} };
  }

  return null;
};
