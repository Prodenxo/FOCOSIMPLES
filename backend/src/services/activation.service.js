import { createSupabaseClient } from '../config/supabase.js';
import { canonicalizeBrazilWhatsappPhone } from '../utils/whatsapp-phone.js';
import { userHasMeiCertificate } from './mei-guide.service.js';
import { ensureGlobalCategoriesCopiedForUser } from './categories.service.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';

/** Cliente Supabase injetável em testes. */
let getActivationDbClient = () => createSupabaseClient({ useServiceRole: true });

export const __setActivationDbClientForTests = (fn) => {
  const prev = getActivationDbClient;
  getActivationDbClient = fn;
  return () => {
    getActivationDbClient = prev;
  };
};

const isLocalAuthMode = () => env.AUTH_MODE === 'local';

export const getMonthStartDateString = (date = new Date()) => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  return monthStart.toISOString().split('T')[0];
};

export const isProfileNameComplete = (displayName) => {
  const trimmed = String(displayName || '').trim();
  return trimmed.length >= 2;
};

export const isPhoneWhatsappComplete = (phone) => {
  return Boolean(canonicalizeBrazilWhatsappPhone(phone));
};

const STEP_COPY = {
  profile_name: {
    title: 'Seu nome',
    description: 'Como aparece no app e no bot.',
    route: 'settings:profile',
  },
  phone_whatsapp: {
    title: 'WhatsApp',
    description: 'Lance gastos e receba DAS pelo celular.',
    route: 'settings:phone',
  },
  first_account: {
    title: 'Uma conta',
    description: 'Carteira, banco ou dinheiro — onde entra e sai o dinheiro.',
    route: 'contas:new',
  },
  first_transaction: {
    title: 'Primeiro lançamento',
    description: 'Entrada ou saída; pode ser de hoje.',
    route: 'transactions:new',
  },
  first_budget: {
    title: 'Um orçamento',
    description: 'Limite mensal numa categoria (ex.: Alimentação).',
    route: 'orcamentos',
  },
  google_calendar: {
    title: 'Google Calendar',
    description: 'Lembretes de pagamento na agenda.',
    route: 'settings:google',
  },
  mei_certificate: {
    title: 'Certificado digital',
    description: 'Necessário para DAS e notas fiscais (e-CNPJ A1).',
    route: 'mei:certificate',
  },
  mei_das_view: {
    title: 'Consultar DAS',
    description: 'Veja o DAS do mês na área Notas.',
    route: 'mei:das',
  },
  mei_nfse_catalog: {
    title: 'Catálogo fiscal',
    description: 'Cadastre cliente ou produto para emitir notas.',
    route: 'mei:nfse',
  },
};

const CORE_STEP_IDS = [
  'profile_name',
  'phone_whatsapp',
  'first_account',
  'first_transaction',
  'first_budget',
];

const OPTIONAL_STEP_IDS = ['google_calendar'];

const MEI_STEP_IDS = ['mei_certificate', 'mei_das_view', 'mei_nfse_catalog'];

/** Passos exibidos no painel de ativação (com rota no app). */
export const ACTIVATION_PANEL_STEP_IDS = [
  'profile_name',
  'phone_whatsapp',
  ...MEI_STEP_IDS,
];

/**
 * @param {string} stepId
 * @param {object} ctx
 * @returns {{ status: 'completed' | 'pending', completedAt: string | null }}
 */
export const evaluateStepStatus = (stepId, ctx) => {
  const now = new Date().toISOString();
  switch (stepId) {
    case 'profile_name':
      return ctx.hasProfileName
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'phone_whatsapp':
      return ctx.hasPhone
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'first_account':
      return ctx.accountsCount > 0
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'first_transaction':
      return ctx.transactionsCount > 0
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'first_budget':
      return ctx.hasBudgetThisMonth
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'google_calendar':
      return ctx.hasGoogleCalendar
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'mei_certificate':
      return ctx.hasMeiCertificate
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'mei_das_view':
      return ctx.hasDasActivity
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'mei_nfse_catalog':
      return ctx.nfseClientsCount > 0
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    default:
      return { status: 'pending', completedAt: null };
  }
};

/**
 * @param {Array<{ id: string, required: boolean, status: string }>} steps
 */
export const computeProgressFromSteps = (steps) => {
  const requiredSteps = steps.filter((s) => s.required);
  const completedRequired = requiredSteps.filter((s) => s.status === 'completed').length;
  const totalRequired = requiredSteps.length;
  const completedAll = steps.filter((s) => s.status === 'completed').length;
  const totalAll = steps.length;
  const percent = totalRequired > 0
    ? Math.round((completedRequired / totalRequired) * 100)
    : 100;
  const percentAll = totalAll > 0
    ? Math.round((completedAll / totalAll) * 100)
    : 100;
  const isCoreComplete = totalRequired > 0 && completedRequired >= totalRequired;
  const isFullyComplete = totalAll > 0 && completedAll >= totalAll;
  const pendingCount = totalAll - completedAll;

  const panelSteps = steps.filter((s) => ACTIVATION_PANEL_STEP_IDS.includes(s.id));
  const panelCompleted = panelSteps.filter((s) => s.status === 'completed').length;
  const isPanelComplete = panelSteps.length > 0 && panelCompleted >= panelSteps.length;

  return {
    completed: completedRequired,
    totalRequired,
    completedAll,
    totalAll,
    percent,
    percentAll,
    pendingCount,
    /** @deprecated use isCoreComplete — mantido para compatibilidade */
    isComplete: isCoreComplete,
    isCoreComplete,
    /** Todos os passos da lista (incl. MEI e recomendados) concluídos */
    isFullyComplete,
    /** Painel de ativação (passos visíveis no app) — 100% concluído */
    isPanelComplete,
    panelCompleted,
    panelTotal: panelSteps.length,
    hasPendingSteps: pendingCount > 0,
  };
};

/**
 * @param {object} ctx
 * @param {{ showMei: boolean }} options
 */
export const buildActivationSteps = (ctx, { showMei = false } = {}) => {
  const ids = [
    ...CORE_STEP_IDS,
    ...OPTIONAL_STEP_IDS,
    ...(showMei ? MEI_STEP_IDS : []),
  ];

  return ids.map((id) => {
    const copy = STEP_COPY[id] || { title: id, description: '', route: id };
    const required = CORE_STEP_IDS.includes(id);
    const evaluated = evaluateStepStatus(id, ctx);
    return {
      id,
      title: copy.title,
      description: copy.description,
      status: evaluated.status,
      required,
      route: copy.route,
      completedAt: evaluated.completedAt,
    };
  });
};

const fetchAuthMetadata = async (admin, userId) => {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return { displayName: null, phone: null };
  }
  const meta = data.user.user_metadata || {};
  return {
    displayName: meta.display_name || meta.full_name || null,
    phone: meta.phone || null,
  };
};

const fetchMeiFlag = async (admin, userId) => {
  const { data, error } = await admin
    .from('role_x_user_x_empresa')
    .select('mei')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data?.mei === true;
};

/**
 * Sinais fiscais alinhados à área Notas (DAS Simples/PGDAS, catálogo NFSe/NF-e).
 * @param {{
 *   dasSimplesCount?: number,
 *   dasMensalCount?: number,
 *   nfseClientsCount?: number,
 *   nfseProdutosCount?: number,
 *   nfseNotesCount?: number,
 * }} counts
 * @param {boolean} hasMeiCertificate
 */
const resolveMeiFiscalSignals = (counts = {}, hasMeiCertificate = false) => {
  const dasTotal = (counts.dasSimplesCount ?? 0) + (counts.dasMensalCount ?? 0);
  const catalogTotal =
    (counts.nfseClientsCount ?? 0)
    + (counts.nfseProdutosCount ?? 0)
    + (counts.nfseNotesCount ?? 0);

  return {
    hasMeiCertificate: Boolean(hasMeiCertificate),
    hasDasActivity: dasTotal > 0,
    nfseClientsCount: catalogTotal,
  };
};

export const gatherActivationContext = async (userId) => {
  if (isLocalAuthMode()) {
    return gatherActivationContextPg(userId);
  }

  const admin = getActivationDbClient();
  const monthStart = getMonthStartDateString();

  const [
    profileRes,
    authMeta,
    n8nRes,
    accountsRes,
    txRes,
    budgetRes,
    googleRes,
    nfseClientsRes,
    dasMensalRes,
    dasSimplesRes,
    nfseProdutosRes,
    nfseNotesRes,
    showMei,
    hasMeiCertificate,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('display_name, phone')
      .eq('id', userId)
      .maybeSingle(),
    fetchAuthMetadata(admin, userId),
    admin.from('n8n_link').select('user_number').eq('user_id', userId).maybeSingle(),
    admin
      .from('contas_financeiras')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('ativo', true),
    admin
      .from('lancamentos_id')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    admin
      .from('orçamentos')
      .select('id')
      .eq('user_id', userId)
      .eq('date', monthStart)
      .not('valor_orçado', 'is', null)
      .limit(1),
    admin
      .from('google_tokens_id')
      .select('access_token')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('mei_nfse_clientes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    admin
      .from('das_mensal_status')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    admin
      .from('das_simples')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    admin
      .from('mei_nfse_produtos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    admin
      .from('mei_nfse')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    fetchMeiFlag(admin, userId),
    userHasMeiCertificate(userId).catch(() => false),
  ]);

  const profile = profileRes.data;
  const displayName = profile?.display_name || authMeta.displayName;
  const phoneRaw = profile?.phone || authMeta.phone || n8nRes.data?.user_number;

  const budgetRows = budgetRes.data || [];
  const hasBudgetThisMonth = budgetRows.length > 0;

  const meiFiscal = resolveMeiFiscalSignals({
    dasSimplesCount: dasSimplesRes.count ?? 0,
    dasMensalCount: dasMensalRes.count ?? 0,
    nfseClientsCount: nfseClientsRes.count ?? 0,
    nfseProdutosCount: nfseProdutosRes.count ?? 0,
    nfseNotesCount: nfseNotesRes.count ?? 0,
  }, Boolean(hasMeiCertificate));

  return {
    showMei,
    ctx: {
      hasProfileName: isProfileNameComplete(displayName),
      hasPhone: isPhoneWhatsappComplete(phoneRaw),
      accountsCount: accountsRes.count ?? 0,
      transactionsCount: txRes.count ?? 0,
      hasBudgetThisMonth,
      hasGoogleCalendar: Boolean(googleRes.data?.access_token),
      hasMeiCertificate: meiFiscal.hasMeiCertificate,
      hasDasActivity: meiFiscal.hasDasActivity,
      nfseClientsCount: meiFiscal.nfseClientsCount,
    },
  };
};

const gatherActivationContextPg = async (userId) => {
  const monthStart = getMonthStartDateString();
  const [
    userRes,
    n8nRes,
    accountsRes,
    txRes,
    budgetRes,
    googleRes,
    linkRes,
    nfseClientsRes,
    dasMensalRes,
    dasSimplesRes,
    nfseProdutosRes,
    nfseNotesRes,
    hasMeiCertificate,
  ] = await Promise.all([
    query(
      `SELECT email, phone, raw_user_meta_data FROM public.users WHERE id = $1 LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT user_number FROM public.n8n_link WHERE user_id = $1 LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT count(*)::int AS c FROM public.contas_financeiras
       WHERE user_id = $1 AND ativo = true`,
      [userId],
    ),
    query(
      `SELECT count(*)::int AS c FROM public.lancamentos_id WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT id FROM public.orcamentos
       WHERE user_id = $1 AND date = $2 AND valor_orcado IS NOT NULL
       LIMIT 1`,
      [userId, monthStart],
    ),
    query(
      `SELECT access_token FROM public.google_tokens_id WHERE user_id = $1 LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT mei FROM public.role_x_user_x_empresa
       WHERE user_id = $1 AND status = true
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT count(*)::int AS c FROM public.mei_nfse_clientes WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT count(*)::int AS c FROM public.das_mensal_status WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT count(*)::int AS c FROM public.das_simples WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT count(*)::int AS c FROM public.mei_nfse_produtos WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT count(*)::int AS c FROM public.mei_nfse WHERE user_id = $1`,
      [userId],
    ),
    userHasMeiCertificate(userId).catch(() => false),
  ]);

  const user = userRes.rows[0];
  const meta = user?.raw_user_meta_data || {};
  const displayName = meta.display_name || meta.full_name || null;
  const phoneRaw = user?.phone || meta.phone || n8nRes.rows[0]?.user_number || null;

  const meiFiscal = resolveMeiFiscalSignals({
    dasSimplesCount: dasSimplesRes.rows[0]?.c ?? 0,
    dasMensalCount: dasMensalRes.rows[0]?.c ?? 0,
    nfseClientsCount: nfseClientsRes.rows[0]?.c ?? 0,
    nfseProdutosCount: nfseProdutosRes.rows[0]?.c ?? 0,
    nfseNotesCount: nfseNotesRes.rows[0]?.c ?? 0,
  }, Boolean(hasMeiCertificate));

  return {
    showMei: linkRes.rows[0]?.mei === true,
    ctx: {
      hasProfileName: isProfileNameComplete(displayName),
      hasPhone: isPhoneWhatsappComplete(phoneRaw),
      accountsCount: accountsRes.rows[0]?.c ?? 0,
      transactionsCount: txRes.rows[0]?.c ?? 0,
      hasBudgetThisMonth: (budgetRes.rows || []).length > 0,
      hasGoogleCalendar: Boolean(googleRes.rows[0]?.access_token),
      hasMeiCertificate: meiFiscal.hasMeiCertificate,
      hasDasActivity: meiFiscal.hasDasActivity,
      nfseClientsCount: meiFiscal.nfseClientsCount,
    },
  };
};

export const getActivationProgress = async (userId) => {
  if (!isLocalAuthMode()) {
    const admin = getActivationDbClient();
    await ensureGlobalCategoriesCopiedForUser(admin, userId).catch((err) => {
      console.warn('[activation] ensureGlobalCategoriesCopiedForUser:', err?.message || err);
    });
  } else {
    await ensureGlobalCategoriesCopiedForUser(null, userId).catch((err) => {
      console.warn('[activation] ensureGlobalCategoriesCopiedForUser:', err?.message || err);
    });
  }

  const { showMei, ctx } = await gatherActivationContext(userId);
  const steps = buildActivationSteps(ctx, { showMei });
  const progress = computeProgressFromSteps(steps);

  return {
    progress: {
      ...progress,
      /** Snooze “ocultar por agora” fica só no cliente (AsyncStorage), sem persistência no banco. */
      dismissStorage: 'client',
    },
    steps,
  };
};
