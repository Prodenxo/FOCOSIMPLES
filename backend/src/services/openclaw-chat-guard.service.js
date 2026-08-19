import { normalizeInboundCommandText } from './zapi-inbound-text.service.js';

/** Respostas fixas — não revelam stack, modelo nem detalhes internos. */
export const CHAT_GUARD_REPLY = {
  internal_probe:
    'Sou o Midas, assistente do Foco Simples. Ajudo com finanças, MEI, DAS, NFSe, NF-e, categorias, lançamentos e a app. Não falo sobre como o sistema foi construído por dentro.',
  off_topic:
    'Atendo somente assuntos financeiros: organização, transações, MEI, DAS, NFSe, NF-e e a app Foco Simples. Para outros temas, use outro canal.',
  investment_advice:
    'Atendo o Foco Simples: lançamentos, categorias, MEI, DAS, NFSe, NF-e e uso da app. Não dou dicas nem recomendações de investimento (ações, fundos, cripto, renda fixa, etc.).',
};

/**
 * @param {string} text
 */
const normalizeForGuard = (text) => {
  const t = normalizeInboundCommandText(text).toLowerCase();
  return t.normalize('NFD').replace(/\p{M}/gu, '');
};

/** Pedido claramente financeiro / app — sempre deixa passar para o OpenClaw. */
const FINANCE_HINTS = [
  /\b(financeir|financas|dinheiro|saldo|transac|lancament|despesa|receita|gasto|orcament|orcamento)\b/,
  /\b(fluxo de caixa|contas a pagar|contas a receber)\b/,
  /\b(mei\b|das\b|nfse|nfs-e|nota fiscal|nota\b|imposto|tribut|faturament|divida|juros|credito|debito)\b/,
  /\b(foco simples|focosimples)\b/,
  /\b(conta\b|extrato|banco|pix\b|pagamento|receb|agenda|calendario|compromiss|reuniao|reunião|evento)\b/,
  /\b(mf\b|midas|foco simples|focosimples)\b/,
  /\b(aprovar|recusar|pendente|cadastro|acesso|convite|categoria|categorias|classificacao)\b/,
  /\b(reais|real\b|rs\b|r\$|salario|salário|prolabore|aluguel|mercado|holerite|folha)\b/,
  /\b(entrada|saida|saída|lucro|prejuizo|prejuízo|economia|economizar|gastei|recebi|paguei)\b/,
  /\b(visao geral|dashboard|transacoes|lançamento|lancar|registrar|registra|apagar|remover|excluir|deletar)\b/,
  /\b(lista|listar|consulta|consultar|mostra|mostrar|ver\b|envia|enviar|manda|mandar|emitir|emite)\b/,
  /\b(cliente|tomador|servico|serviço|prestador|cnpj|certificado|serpro|plugnotas)\b/,
  /\b(google calendar|meet\b|videochamada|marcar|marca\b|agendar|agenda\b)\b/,
  /\b(vencimento|boleto|fatura|parcela|guia\b|pdf\b|whatsapp)\b/,
  /\b(empresa|colaborador|funcionario|funcionário|admin|superadmin|permiss|cargo|papel)\b/,
  /\b(ajuda|ajudar|como usar|usar a app|no app|na app)\b/,
  /\b(hoje|amanha|amanhã|ontem|este mes|esse mes|mes passado)\b/,
  /\b(valor|quanto|total|quanto gastei|quanto recebi)\b/,
];

const GREETING_ONLY =
  /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí|tudo bem|tudo bom|blz|beleza|fala|opa|salve|obrigad|valeu|thanks|ok+|sim|nao|não|pode|podes|quero|preciso)[\s!.?]*$/i;

/**
 * Saudação curta (sem pedido concreto) — usada para boas-vindas WhatsApp no inbound.
 * @param {string} text
 */
export const isGreetingOnlyMessage = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const normalized = normalizeForGuard(raw);
  return GREETING_ONLY.test(normalized);
};

/** Off-topic com alta confiança — bloqueia no webhook antes do OpenClaw. */
const HIGH_CONFIDENCE_OFF_TOPIC = [
  /\b(porn|pornograf|xxx|hentai|sexo explicit|conteudo adult|site adult|sites adult)\b/,
  /\b(melhor|qual|quais)\s+(site|sites)\s+(de|para)\s+(porn|adult|xxx|sexo)\b/,
  /\b(receita de|como fazer)\s+(bolo|pizza|macarrao|macarrão)\b/,
  /\b(melhor|qual)\s+(filme|serie|série|novela|musica|música|jogo|games)\b/,
  /\b(conte|conta)\s+(uma\s+)?(piada|historia|história)\b/,
  /\b(quem\s+ganhou|placar|campeonato)\b(?!.*\b(aposta|invest|finance)\b)/,
  /\b(receita\s+culinaria|cozinhar)\b/,
  /\b(hackear|invadir|keygen|crack)\b/,
];

/** Sondagem técnica — só depois de descartar finanças; o SOUL também recusa no modelo. */
const INTERNAL_PROBE_PATTERNS = [
  /\b(qual|que|which)\s+(api|modelo|model|llm|ia|inteligencia artificial|gpt|claude|gemini|openai|anthropic)\b/,
  /\b(qual|que)\s+(robo|robô|bot|agente)\s+(voce|você|vc|é|eh|usa|usas)\b/,
  /\b(voce|você|vc)\s+(é|eh)\s+(qual|que)\s+(robo|robô|bot|ia|modelo|api)\b/,
  /\bopenclaw\b/,
  /\bn8n\b/,
  /\bmf-curl\b/,
  /\bsoul\.md\b/,
  /\b(z-api|zapi|webhook secret|openclaw_webhook)\b/,
  /\b(seu|teu)\s+(prompt|system prompt|instrucoes|instruções|codigo|código)\b/,
  /\b(webhook|token|secret)\s+(intern|interno|sistema|seu|teu|do bot)\b/,
  /\bcomo\s+(voce|você|vc)\s+(foi feito|foi criado|programado|treinado)\b/,
  /\b(stack|backend|infraestrutura|servidor)\s+(do|da)\s+(bot|robo|robô|sistema|assistente)\b/,
  /\b(revela|mostra|informa|diz)\s+(o|a|seu|teu)?\s*(codigo|código|arquitetura|endpoint|endpoints)\b/,
  /\bqual\s+(servico|serviço|tecnologia|framework)\s+(voce|você|vc)\s+(usa|usas|utiliza)\b/,
];

const RECOMMENDATION_HINT =
  /\b(melhor|pior|top|recomenda|me indica|me sugere|qual site|quais sites)\b/;

const ENTERTAINMENT_OFF_TOPIC =
  /\b(filme|serie|série|novela|jogo|games|porn|adult|xxx|musica|música|piada|futebol|campeonato)\b/;

/** Dicas/recomendações de investimento — fora do escopo (só Foco Simples). */
const INVESTMENT_ADVICE_PATTERNS = [
  /\b(dicas?|conselhos?|orientac|recomendac).{0,48}\b(invest|aplicar|aplicacao|aplicação)\b/,
  /\b(onde|em que|o que|como)\s+.{0,24}\b(investir|aplicar|aplico)\b/,
  /\b(investir|aplicar)\s+(em|no|na)\s+(acoes|ações|fii|fiis|fundo|fundos|cripto|bitcoin|tesouro|cdb|stocks|bolsa)\b/,
  /\b(melhor|qual|quais|top)\s+.{0,20}\b(investimento|acao|ação|fundo|ativo|criptomoeda|cripto)\b/,
  /\b(bolsa de valores|day trade|swing trade|trader|trading|renda fixa|renda variavel|renda variável)\b/,
  /\b(carteira de invest|alocacao de ativos|diversificacao de invest)\b/,
  /\b(comprar|vender)\s+(acoes|ações|fii|fiis|bitcoin|cripto)\b/,
  /\b(quanto|vale a pena)\s+.{0,30}\b(investir|investimento)\b/,
];

/**
 * @param {string} normalized
 */
export const isInvestmentAdviceRequest = (normalized) => {
  if (/\b(foco simples|focosimples)\b/.test(normalized)) {
    const productOnly =
      !/\b(investir|investimento|acoes|ações|fundo|fundos|cripto|bitcoin|bolsa|fii|fiis|tesouro|cdb)\b/.test(
        normalized,
      );
    if (productOnly) return false;
  }
  return INVESTMENT_ADVICE_PATTERNS.some((re) => re.test(normalized));
};

/**
 * @param {string} normalized
 */
export const hasFinanceHint = (normalized) =>
  FINANCE_HINTS.some((re) => re.test(normalized));

/**
 * @param {string} normalized
 */
export const isHighConfidenceOffTopic = (normalized) =>
  HIGH_CONFIDENCE_OFF_TOPIC.some((re) => re.test(normalized));

/**
 * Pré-filtro antes do relay OpenClaw.
 * Regra: **finanças passam**; bloqueia só off-topic explícito (porn, entretenimento, etc.)
 * e sondagem técnica pura. Mensagens ambíguas → OpenClaw (Midas decide no SOUL).
 *
 * @param {string} text
 * @returns {{
 *   block: boolean,
 *   reason: 'internal_probe' | 'off_topic' | 'investment_advice' | null,
 *   reply: string | null
 * }}
 */
export const evaluateChatGuard = (text) => {
  const raw = String(text || '').trim();
  if (!raw) {
    return { block: false, reason: null, reply: null };
  }

  const normalized = normalizeForGuard(raw);

  if (GREETING_ONLY.test(normalized)) {
    return { block: false, reason: null, reply: null };
  }

  if (isInvestmentAdviceRequest(normalized)) {
    return {
      block: true,
      reason: 'investment_advice',
      reply: CHAT_GUARD_REPLY.investment_advice,
    };
  }

  if (hasFinanceHint(normalized)) {
    return { block: false, reason: null, reply: null };
  }

  if (isHighConfidenceOffTopic(normalized)) {
    return {
      block: true,
      reason: 'off_topic',
      reply: CHAT_GUARD_REPLY.off_topic,
    };
  }

  if (
    RECOMMENDATION_HINT.test(normalized)
    && ENTERTAINMENT_OFF_TOPIC.test(normalized)
  ) {
    return {
      block: true,
      reason: 'off_topic',
      reply: CHAT_GUARD_REPLY.off_topic,
    };
  }

  for (const re of INTERNAL_PROBE_PATTERNS) {
    if (re.test(normalized)) {
      return {
        block: true,
        reason: 'internal_probe',
        reply: CHAT_GUARD_REPLY.internal_probe,
      };
    }
  }

  return { block: false, reason: null, reply: null };
};
