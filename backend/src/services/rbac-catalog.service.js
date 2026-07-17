import { badRequest } from '../utils/errors.js';
import { createSupabaseClient } from '../config/supabase.js';

export const ROLE_LABELS = ['superadmin', 'admin', 'usuario', 'outsider'];

const normalizeRole = (role) => {
  if (!role) return null;
  const n = String(role).trim().toLowerCase().replace(/\s+/g, '');
  if (n === 'user') return 'usuario';
  return n;
};

/**
 * Matriz estática alinhada ao SOUL Midas e middlewares requireAdmin / requireSuperAdmin.
 * `scope`: app | bot | admin_panel
 */
const PERMISSIONS_BY_ROLE = {
  superadmin: [
    { key: 'app.manage_all_tenants', scope: 'app', description: 'Gestão global na plataforma (painel).' },
    { key: 'app.impersonate_any', scope: 'app', description: 'Aceder a outras contas (impersonate).' },
    { key: 'app.change_user_roles', scope: 'app', description: 'Alterar role em profiles (superadmin).' },
    { key: 'bot.own_transactions', scope: 'bot', description: 'Lançamentos na própria conta (phone remetente).' },
    { key: 'bot.own_categories', scope: 'bot', description: 'Listar categorias da própria conta.' },
    { key: 'bot.own_das', scope: 'bot', description: 'DAS da própria conta.' },
    { key: 'bot.das_other_user', scope: 'bot', description: 'DAS de outro utilizador com telefone em n8n_link.' },
    { key: 'admin_panel.full', scope: 'admin_panel', description: 'Rotas /api/admin/* e gestão global.' },
  ],
  admin: [
    { key: 'app.manage_own_company', scope: 'app', description: 'Gere utilizadores e dados só da sua empresa.' },
    { key: 'app.impersonate_company_users', scope: 'app', description: 'Impersonate de utilizadores da mesma empresa (não superadmin).' },
    { key: 'app.empresa_invites', scope: 'app', description: 'Convites e vínculos da empresa.' },
    { key: 'bot.own_transactions', scope: 'bot', description: 'Lançamentos na própria conta.' },
    { key: 'bot.own_categories', scope: 'bot', description: 'Categorias da própria conta.' },
    { key: 'bot.own_das', scope: 'bot', description: 'DAS próprio.' },
    { key: 'bot.das_colaborador_same_company', scope: 'bot', description: 'DAS de colaborador com mesmo empresaId (validar resolve_user nos dois telefones).' },
    { key: 'admin_panel.company_scope', scope: 'admin_panel', description: 'Admin limitado à empresa do requester.' },
  ],
  usuario: [
    { key: 'app.own_profile', scope: 'app', description: 'Perfil e finanças pessoais.' },
    { key: 'app.mei_own', scope: 'app', description: 'MEI próprio onde aplicável.' },
    { key: 'bot.own_transactions', scope: 'bot', description: 'Listar/criar/apagar próprios lançamentos.' },
    { key: 'bot.own_categories', scope: 'bot', description: 'Listar categorias próprias.' },
    { key: 'bot.own_das', scope: 'bot', description: 'DAS próprio.' },
  ],
  outsider: [
    { key: 'app.limited_access', scope: 'app', description: 'Acesso restrito até vínculo empresa activo.' },
    { key: 'bot.own_transactions', scope: 'bot', description: 'Operações na própria conta se telefone ligado.' },
    { key: 'bot.own_categories', scope: 'bot', description: 'Categorias próprias.' },
    { key: 'bot.own_das', scope: 'bot', description: 'DAS próprio se aplicável.' },
  ],
};

const ROLE_SUMMARIES = {
  superadmin: 'Plataforma inteira; no bot pode usar telefone alvo para DAS; gestão global no painel.',
  admin: 'Só a própria empresa na app; no bot DAS de colaborador com mesmo empresaId.',
  usuario: 'Só o próprio perfil e finanças; no bot apenas conta do remetente.',
  outsider: 'Vínculo empresa inactivo ou sem papel; capacidades limitadas.',
};

/** @returns {Array<{ id: string, label: string, summary: string, permissions: object[] }>} */
export const listRolesCatalog = () =>
  ROLE_LABELS.map((id) => ({
    id,
    label: id,
    summary: ROLE_SUMMARIES[id] || '',
    permissions: PERMISSIONS_BY_ROLE[id] || [],
  }));

/**
 * @param {string} role
 */
export const getPermissionsForRole = (role) => {
  const id = normalizeRole(role);
  if (!id || !ROLE_LABELS.includes(id)) {
    throw badRequest(
      `Role inválida. Use: ${ROLE_LABELS.join(', ')}.`,
    );
  }
  return {
    role: id,
    summary: ROLE_SUMMARIES[id] || '',
    permissions: PERMISSIONS_BY_ROLE[id] || [],
  };
};

/**
 * Papel efectivo para decisões do bot (prioridade: superadmin > admin > usuario > outsider).
 * @param {{ profileRole?: string | null, memberships?: Array<{ role?: string | null }>, hasSuperadminCapability?: boolean }} actorContext
 */
export const resolvePrimaryRoleFromActorContext = (actorContext) => {
  if (actorContext?.hasSuperadminCapability) return 'superadmin';
  const roles = new Set();
  const pr = normalizeRole(actorContext?.profileRole);
  if (pr) roles.add(pr);
  for (const m of actorContext?.memberships || []) {
    const r = normalizeRole(m?.role);
    if (r) roles.add(r);
  }
  if (roles.has('superadmin')) return 'superadmin';
  if (roles.has('admin')) return 'admin';
  if (roles.has('usuario')) return 'usuario';
  if (roles.has('outsider')) return 'outsider';
  return pr || 'usuario';
};

/**
 * @param {{ profileRole?: string | null, memberships?: Array<{ role?: string | null }>, hasSuperadminCapability?: boolean, hasActiveMembership?: boolean }} actorContext
 */
export const resolveEffectivePermissionsForActor = (actorContext) => {
  const primaryRole = resolvePrimaryRoleFromActorContext(actorContext);
  const base = getPermissionsForRole(primaryRole);
  const allRoleKeys = new Set([primaryRole]);
  const pr = normalizeRole(actorContext?.profileRole);
  if (pr) allRoleKeys.add(pr);
  for (const m of actorContext?.memberships || []) {
    const r = normalizeRole(m?.role);
    if (r) allRoleKeys.add(r);
  }

  /** @type {Map<string, object>} */
  const merged = new Map();
  for (const r of allRoleKeys) {
    if (!ROLE_LABELS.includes(r)) continue;
    for (const p of PERMISSIONS_BY_ROLE[r] || []) {
      merged.set(p.key, p);
    }
  }

  return {
    primaryRole,
    profileRole: pr,
    membershipRoles: [...allRoleKeys].filter((r) => r !== primaryRole),
    hasActiveMembership: Boolean(actorContext?.hasActiveMembership),
    hasSuperadminCapability: Boolean(actorContext?.hasSuperadminCapability),
    summary: ROLE_SUMMARIES[primaryRole] || '',
    permissions: [...merged.values()],
  };
};

/**
 * @param {object} actorContext
 * @param {string} permissionKey
 */
export const checkActorPermission = (actorContext, permissionKey) => {
  const key = String(permissionKey || '').trim();
  if (!key) throw badRequest('permission é obrigatório');
  const effective = resolveEffectivePermissionsForActor(actorContext);
  const allowed = effective.permissions.some((p) => p.key === key);
  return {
    permission: key,
    allowed,
    primaryRole: effective.primaryRole,
    reason: allowed
      ? null
      : `O papel efectivo "${effective.primaryRole}" não inclui "${key}".`,
  };
};

/**
 * Roles registadas na tabela `roles` (referência BD).
 */
export const listRolesFromDatabase = async () => {
  const admin = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await admin.from('roles').select('id, roles').order('roles');
  if (error) throw badRequest(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    roles: normalizeRole(row.roles) || row.roles,
  }));
};
