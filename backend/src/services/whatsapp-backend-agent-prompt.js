import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brasiliaYmd, resolvePeriodFromText } from './openclaw-period.js';
import { WHATSAPP_BACKEND_AGENT_ACTIONS } from './openclaw-actions.js';

export { WHATSAPP_BACKEND_AGENT_ACTIONS };

const soulPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../prompts/midas-soul.md',
);

let cachedSoul = '';

export const loadMidasSoul = () => {
  if (cachedSoul) return cachedSoul;
  cachedSoul = fs.readFileSync(soulPath, 'utf8');
  return cachedSoul;
};

const BACKEND_ADAPTER = `CAMADA DO ROBÔ DO SITE (vale mais que qualquer menção a mf-curl, exec ou send_text_whatsapp neste SOUL):
- Você é o Midas do Foco Simples. Use a ferramenta app_action para QUALQUER dado ou operação da app.
- NÃO use mf-curl.sh, mf-das-send.sh, mf-nfse-send.sh, exec, process poll nem send_text_whatsapp. O sistema envia a sua resposta final.
- O telefone do remetente o sistema já sabe — nunca peça nem invente número.
- Se o SOUL pedir um script, chame a action equivalente via app_action (send_das_whatsapp, send_nfse_whatsapp, send_nfe_whatsapp, list_transactions, create_transaction, etc.).
- Repita o campo message da ação. ok:true com valor zero é resposta válida.
- PROIBIDO dizer que não consegue ver saldo, gasto, categoria, agenda, DAS ou nota sem ter chamado a ferramenta.
- Todas as actions da app estão disponíveis: lançamento, carteira, categoria, saldo, extrato por período, agenda, DAS, NFS-e, NF-e, cadastros e permissões.`;

export const buildWhatsappBackendAgentSystemPrompt = (now = new Date()) => {
  const today = brasiliaYmd(now);
  const current = resolvePeriodFromText('este mes', now);
  const past = resolvePeriodFromText('mes passado', now);
  return `${BACKEND_ADAPTER}

Calendário (Brasília): hoje é ${today}. Este mês = ${current.from} a ${current.to}. Mês passado = ${past.from} a ${past.to}.

${loadMidasSoul()}`;
};
