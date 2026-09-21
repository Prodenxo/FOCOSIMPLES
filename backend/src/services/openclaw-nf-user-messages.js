/** Mensagens para o utilizador final (WhatsApp) — sem payload, action nem JSON. */

/** O que fazer, por código de rejeição da prefeitura. */
const NFSE_REJECTION_ACTIONS = {
  E0312:
    'O código do serviço não é administrado pela sua cidade. '
    + 'Abra Foco Simples → MEI → Notas, edite o serviço e use um código da lista nacional que o seu município aceita.',
  E0116:
    'Falta a Inscrição Municipal. Preencha em Foco Simples → Certificado → Empresa.',
  E0120:
    'A Inscrição Municipal enviada não é aceite neste município. Limpe o campo em Foco Simples → Certificado → Empresa.',
  E0714:
    'Erro na assinatura do arquivo enviado à prefeitura. É falha do emissor fiscal — fale com o suporte.',
  EM012:
    'A empresa não está autorizada a emitir pelo portal do município. O contador precisa liberar a emissão por webservice.',
  E0370:
    'Serviço de obra: a prefeitura exige o endereço do local da obra. '
    + 'Confirme o endereço do cliente ou informe o endereço da obra na emissão.',
  EM062:
    'O código do serviço e o NBS cadastrados não combinam na tabela oficial da NFS-e. '
    + 'Abra Foco Simples → MEI → Notas, edite o serviço e corrija o NBS — peça ao contador o código certo.',
  E0713:
    'A prefeitura não reconhece a empresa como optante do Simples Nacional nesta data. '
    + 'O contador precisa verificar a opção pelo Simples no cadastro da prefeitura e na Receita.',
  E0712:
    'A prefeitura aceita apenas um bloco de total de tributos. É ajuste do emissor fiscal — fale com o suporte.',
  EM016:
    'A série do RPS não é aceite pela prefeitura. Ajuste a série em Foco Simples → Certificado → Empresa (ex.: 1).',
};

/** Ruído do emissor que não ajuda o utilizador. */
const NFSE_REJECTION_NOISE = /^(erro desconhecido|erro ao realizar a requisi[çc][ãa]o)[:.\s]*/gi;

/** Frase explicativa entre parênteses no fim de cada motivo (regra do validador). */
const NFSE_REJECTION_EXPLANATION = /\s*\([^()]*\)\s*$/;

/**
 * Motivo de rejeição legível: aceita o JSON com `Codigo`/`Descricao` e o formato do ISSNET
 * (`E0370-descrição | E0713-descrição`).
 *
 * @param {string} rawReason
 * @returns {{ text: string, codes: string[] }}
 */
export const formatNfseRejectionReason = (rawReason = '') => {
  const raw = String(rawReason || '').trim();
  if (!raw) return { text: '', codes: [] };

  const codes = [];
  const parts = [];
  const pairs = raw.matchAll(/"Codigo"\s*:\s*"([^"]+)"\s*,\s*"Descricao"\s*:\s*"([^"]+)"/g);
  for (const [, codigo, descricao] of pairs) {
    const code = codigo.trim().toUpperCase();
    codes.push(code);
    parts.push(`${code} — ${descricao.trim()}`);
  }

  if (parts.length) return { text: parts.join('\n'), codes };

  for (const [, codigo, descricao] of raw.matchAll(/(?:^|\|)\s*([A-Z]{1,4}\d{2,4})\s*-\s*([^|]+)/g)) {
    const code = codigo.trim().toUpperCase();
    codes.push(code);
    parts.push(`${code} — ${descricao.replace(NFSE_REJECTION_EXPLANATION, '').trim()}`);
  }

  if (parts.length) return { text: parts.join('\n'), codes };

  const cleaned = raw.replace(NFSE_REJECTION_NOISE, '').trim();
  return { text: cleaned || raw, codes: [] };
};

/**
 * Linha de "o que fazer" para os códigos reconhecidos.
 * @param {string[]} codes
 */
export const resolveNfseRejectionAction = (codes = []) => {
  for (const code of Array.isArray(codes) ? codes : []) {
    const action = NFSE_REJECTION_ACTIONS[String(code).trim().toUpperCase()];
    if (action) return action;
  }
  return '';
};

export const formatValorBr = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '').trim() || '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const tipoNotaLabel = (documentType) => {
  const dt = String(documentType || '').toUpperCase();
  if (dt === 'NFE') return 'NF-e (produto)';
  if (dt === 'NFCE') return 'NFC-e (varejo)';
  return 'NFS-e (serviço)';
};

const quantidadeItensLabel = (quantidade) => {
  const n = Number(quantidade);
  const qtd = Number.isFinite(n) && n > 0 ? n : 1;
  return qtd === 1 ? '1 item' : `${qtd} itens`;
};

const formatNfePreviewItemBlock = (row = {}) => {
  const nome = String(row.produtoDescricao || row.descricao || row.discriminacao || 'Produto').trim();
  const qtd = row.quantidade;
  const unit = formatValorBr(row.valorUnitario);
  const lineTotal = formatValorBr(row.valorTotal ?? row.valor);
  return [
    `${nome} ${quantidadeItensLabel(qtd)}`,
    `Preço: ${unit}`,
    `Valor total: ${lineTotal}`,
  ].join('\n');
};

const formatNfPreviewItensBlock = (preview = {}) => {
  const dt = String(preview.documentType || '').toUpperCase();
  const isProduto = dt === 'NFE' || dt === 'NFCE';
  const itens = Array.isArray(preview.itens) ? preview.itens : [];

  if (isProduto) {
    const rows = itens.length
      ? itens
      : [{
        produtoDescricao: preview.produtoDescricao || preview.discriminacao,
        quantidade: preview.quantidade,
        valorUnitario: preview.valorUnitario,
        valorTotal: preview.valorTotal,
      }];
    const blocks = rows.map(formatNfePreviewItemBlock);
    if (rows.length > 1) {
      return `${blocks.join('\n\n')}\n\nValor total da nota: ${formatValorBr(preview.valorTotal)}`;
    }
    return blocks[0];
  }

  if (itens.length > 1) {
    const lines = itens.map((row, index) => {
      const nome = String(row.produtoDescricao || row.descricao || row.discriminacao || 'Item').trim();
      const qtd = row.quantidade != null ? ` × ${row.quantidade}` : '';
      const valor = formatValorBr(row.valorTotal ?? row.valor ?? row.valorUnitario);
      return `  ${index + 1}. ${nome}${qtd} — ${valor}`;
    });
    return [`• Serviços:`, ...lines].join('\n');
  }
  const item = String(
    preview.discriminacao || preview.produtoDescricao || preview.codigoServico || 'Item',
  ).trim();
  return `• Serviço: ${item}`;
};

/**
 * Pedido de confirmação antes de emitir.
 * @param {{ documentType?: string, tomadorRazaoSocial?: string, destinatarioRazaoSocial?: string, discriminacao?: string, produtoDescricao?: string, valorServico?: number, valorTotal?: number, itens?: object[] }} preview
 */
export const buildNfConfirmRequestUserMessage = (preview = {}) => {
  const cliente = String(
    preview.tomadorRazaoSocial || preview.destinatarioRazaoSocial || 'Cliente',
  ).trim();
  const valor = formatValorBr(preview.valorServico ?? preview.valorTotal);
  const tipo = tipoNotaLabel(preview.documentType);
  const itensBlock = formatNfPreviewItensBlock(preview);
  const multiItem = Array.isArray(preview.itens) && preview.itens.length > 1;
  const isNfeProduto = ['NFE', 'NFCE'].includes(String(preview.documentType || '').toUpperCase());
  const cfop = String(preview.cfop || '').trim();
  const ufLinha = preview.emitenteUf && preview.destinatarioUf
    ? `• UF: ${preview.emitenteUf} → ${preview.destinatarioUf}`
    : '';

  return [
    'Resumo da nota fiscal:',
    `• Tipo: ${tipo}`,
    `• Cliente: ${cliente}`,
    itensBlock,
    ...(isNfeProduto ? [] : [`• ${multiItem ? 'Valor total' : 'Valor'}: ${valor}`]),
    ...(!isNfeProduto && !multiItem && cfop ? [`• CFOP: ${cfop}`] : []),
    ...(ufLinha ? [ufLinha] : []),
    '',
    'Posso emitir? Responda *sim* ou *confirmo* que eu envio a nota.',
  ].join('\n');
};

/**
 * @param {object} preview
 * @param {{ status?: string, pdfSent?: boolean, pdfPending?: boolean }} opts
 */
export const buildNfEmittedUserMessage = (preview = {}, opts = {}) => {
  const cliente = String(
    preview.tomadorRazaoSocial || preview.destinatarioRazaoSocial || 'Cliente',
  ).trim();
  const valor = formatValorBr(preview.valorServico ?? preview.valorTotal);
  const tipo = tipoNotaLabel(preview.documentType);
  const itensBlock = formatNfPreviewItensBlock(preview);
  const multiItem = Array.isArray(preview.itens) && preview.itens.length > 1;
  const isNfeProduto = ['NFE', 'NFCE'].includes(String(preview.documentType || '').toUpperCase());
  const status = String(opts.status || 'processando').trim();

  let footer = '';
  if (opts.pdfSent) {
    footer = 'Enviei o PDF da nota aqui no WhatsApp.';
  } else if (opts.pdfPending) {
    footer = 'Assim que a nota for autorizada, envio o PDF neste chat.';
  } else {
    footer = 'Se o PDF não aparecer neste chat, responda *manda o PDF*.';
  }

  const lines = [
    'Nota fiscal enviada para emissão.',
    `• Tipo: ${tipo}`,
    `• Cliente: ${cliente}`,
    itensBlock,
    ...(isNfeProduto ? [] : [`• ${multiItem ? 'Valor total' : 'Valor'}: ${valor}`]),
    `• Situação: ${status}`,
  ];
  if (footer) lines.push('', footer);
  return lines.join('\n');
};

/** Instrução só para o agente (não mostrar ao utilizador). */
export const BOT_NF_CONFIRM_INSTRUCTION =
  'INSTRUÇÃO INTERNA: se o utilizador responder sim/confirmo/pode emitir/ok, chame emit_nfse ou emit_nfe '
  + 'com os MESMOS dados do preview e "confirm":true no JSON do mf-curl. '
  + 'PROIBIDO pedir payload, confirm:true ou comandos técnicos ao utilizador. '
  + 'AGUARDE o exec terminar antes de responder — nunca repita o preview enquanto o exec corre.';

/** Evita loop preview → sim → preview quando o utilizador já confirmou. */
export const BOT_NF_PREVIEW_LOOP_GUARD =
  'Se o utilizador JÁ disse sim/confirmo nesta conversa, PROIBIDO repetir este resumo — '
  + 'chame emit_nfse (ou emit_nfe) com confirm:true e os MESMOS dados.';

/** Após falha na emissão (não voltar ao preview). */
export const BOT_NF_EMIT_FAILED_INSTRUCTION =
  'Emissão falhou. Repita APENAS message ao utilizador (motivo em português curto). '
  + 'Se pedir para tentar de novo: emit_nfse com confirm:true e os MESMOS dados — '
  + 'PROIBIDO chamar emit_nfse sem confirm:true após falha ou confirmação. '
  + 'AGUARDE o exec terminar antes de responder. '
  + 'PROIBIDO chamar emit_nfe/emit_nfse mais de uma vez para o mesmo preview confirmado.';

/** Após emissão bem-sucedida — evita triplicar nota no WhatsApp. */
export const BOT_NF_EMIT_SUCCESS_GUARD =
  'Nota JÁ emitida nesta conversa. PROIBIDO chamar emit_nfe ou emit_nfse de novo com os mesmos dados. '
  + 'Repita APENAS message ao utilizador; se pedirem PDF, use get_nfe_pdf / send_nfe_whatsapp ou aguarde envio automático.';

/**
 * Mensagem amigável para erros técnicos de emissão NFS-e (WhatsApp).
 * @param {string} rawMessage
 */
export const formatNfseEmitErrorForUser = (rawMessage = '') => {
  const msg = String(rawMessage || '').trim();
  if (/alinhar a numeração|operation was aborted|aborted/i.test(msg)) {
    return (
      'Não consegui concluir a emissão agora — a PlugNotas demorou a responder '
      + '(sincronização da numeração). Aguarde cerca de 1 minuto e diga *tentar de novo*, '
      + 'ou emita pelo app Foco Simples → MEI → Notas.'
    );
  }
  if (/certificado|plugnotas/i.test(msg)) {
    return (
      'Não foi possível emitir a nota. Verifique certificado A1 e dados fiscais '
      + 'no app Foco Simples → MEI → Notas.'
    );
  }
  return msg || 'Não foi possível emitir a nota fiscal agora. Tente de novo em instantes.';
};

/**
 * Mensagem amigável para erros de emissão NF-e (WhatsApp / OpenClaw).
 * @param {string} rawMessage
 * @param {{ nfeAtivo?: boolean }} [context]
 */
export const formatNfeEmitErrorForUser = (rawMessage = '', context = {}) => {
  const msg = String(rawMessage || '').trim();
  const lower = msg.toLowerCase();

  if (/emissor\s+n[aã]o\s+habilitado\s+para\s+emiss[aã]o\s+da\s+nf-?e/i.test(lower)) {
    return (
      'A Receita recusou: a empresa ainda não está credenciada para emitir NF-e neste estado. '
      + 'Peça ao contador habilitar a NF-e no portal da SEFAZ com o certificado A1. '
      + 'Isso não é erro de produto nem de valor.'
    );
  }

  if (/nfe.*n[aã]o est[aá] activ|nfe_plugnotas_inactive|nfe_plugnotas_activate/i.test(lower)) {
    return (
      'A NF-e (produto) não está activa no emissor fiscal. '
      + 'Abra Foco Simples → Certificado → Empresa, marque NF-e, grave o cadastro e tente emitir de novo.'
    );
  }

  if (/erro interno/i.test(msg)) {
    const hints = [
      'O emissor fiscal recusou a nota com erro genérico.',
    ];
    if (context.nfeAtivo === false) {
      hints.push('Sua empresa pode não ter NF-e activa no Plugnotas — verifique em Certificado → Empresa.');
    }
    hints.push(
      'Confira CPF/CNPJ, endereço completo do cliente (CEP, cidade, UF, IBGE), NCM e valor do produto.',
    );
    hints.push(
      'Em vendas para outro estado, o CFOP deve ser interestadual (ex.: 6108) — confira se o cliente está noutro UF que o emitente.',
    );
    hints.push('Se persistir, emita pelo app Foco Simples → Notas.');
    return hints.join(' ');
  }

  if (/certificado|plugnotas/i.test(msg)) {
    return (
      'Não foi possível emitir a NF-e. Verifique certificado A1 e dados fiscais '
      + 'no app Foco Simples → Certificado → Empresa.'
    );
  }

  return formatNfseEmitErrorForUser(msg);
};

const CONFIRM_WORDS = new Set([
  'sim',
  'confirmo',
  'confirmado',
  'ok',
  'manda',
  'emite',
  'pode',
  'pode emitir',
]);

/** Aceita confirm:true ou texto de confirmação do utilizador no campo confirm/confirmar. */
export const isNfEmitConfirmed = (payload = {}) => {
  if (payload?.confirm === true || payload?.confirmar === true) return true;
  const raw = String(payload?.confirm ?? payload?.confirmar ?? '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'true') return true;
  return CONFIRM_WORDS.has(raw);
};

const VAGUE_NF_ITEM_REGEX = [
  /^notas?(\s+fiscal(is)?)?(\s+de)?(\s+servicos?)?$/i,
  /^prestacao\s+de\s+servicos?$/i,
  /^servicos?$/i,
  /^emissao\s+de\s+nota/i,
  /^emitir\s+nota/i,
  /^fazer\s+nota/i,
  /^tirar\s+nota/i,
  /^nota\s+para\b/i,
  /^cobranca$/i,
];

const normalizeNfItemLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const VAGUE_NF_ITEM_EXACT = new Set([
  'nota',
  'notas',
  'nota fiscal',
  'nota fiscal de servico',
  'nota fiscal de servicos',
  'prestacao de servicos',
  'servico',
  'servicos',
  'emissao de nota',
  'emitir nota',
  'fazer nota',
  'tirar nota',
  'cobranca',
]);

/** Nome genérico vindo do áudio/LLM — não é item do catálogo. */
export const isVagueNfItemLabel = (value) => {
  const s = normalizeNfItemLabel(value);
  if (!s) return true;
  if (s.length <= 3) return true;
  if (VAGUE_NF_ITEM_EXACT.has(s)) return true;
  return VAGUE_NF_ITEM_REGEX.some((re) => re.test(s));
};

export const formatNfseCatalogChoiceMessage = (produtos = [], options = {}) => {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) {
    return 'Você ainda não tem serviços cadastrados. Cadastre na app (MEI → Notas) e peça a nota de novo.';
  }
  const intro = String(options.prefix || '').trim()
    || 'Qual serviço você quer na nota? Responda com o número ou o nome exato:';
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `${intro}\n${lines.join('\n')}`;
};

export const formatNfeCatalogChoiceMessage = (produtos = []) => {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) {
    return 'Você ainda não tem produtos cadastrados. Cadastre na app (MEI → Notas) e peça a nota de novo.';
  }
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `Qual produto você quer na nota? Responda com o número ou o nome exato:\n${lines.join('\n')}`;
};

export const formatNfCatalogAmbiguousMessage = (label, matches = [], documentType = 'NFSE') => {
  const tipo = documentType === 'NFE' ? 'produto' : 'serviço';
  const list = Array.isArray(matches) ? matches : [];
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `Encontrei vários ${tipo}s parecidos com "${label}". Qual é?\n${lines.join('\n')}`;
};

/** Documento do catálogo com rótulo CPF/CNPJ — nunca inventar número. */
const formatClienteDocumentoLabel = (documento) => {
  const doc = String(documento || '').replace(/\D/g, '');
  if (doc.length === 14) return `CNPJ ${doc}`;
  if (doc.length === 11) return `CPF ${doc}`;
  return doc || 'sem documento';
};

/**
 * Clientes homónimos no catálogo NFS-e: a lista vai no próprio `message` para o agente
 * repetir o texto sem inventar documentos.
 */
export const formatNfseClienteAmbiguousMessage = (nome, matches = []) => {
  const list = Array.isArray(matches) ? matches : [];
  const lines = list.map(
    (c, i) => `${i + 1}. ${String(c.nome || '—').trim()} (${formatClienteDocumentoLabel(c.documento)})`,
  );
  return `Encontrei vários clientes com o nome "${nome}". Qual deles?\n${lines.join('\n')}`;
};

export const formatNfCatalogNotFoundMessage = (label, catalog = [], documentType = 'NFSE') => {
  const tipo = documentType === 'NFE' ? 'produto' : 'serviço';
  const list = Array.isArray(catalog) ? catalog : [];
  if (!list.length) {
    return `Não encontrei o ${tipo} "${label}" e seu catálogo está vazio. Cadastre na app (MEI → Notas).`;
  }
  const lines = list.map((p, i) => `${i + 1}. ${String(p.discriminacao || '—').trim()}`);
  return `Não encontrei o ${tipo} "${label}". Escolha um do seu catálogo:\n${lines.join('\n')}`;
};
