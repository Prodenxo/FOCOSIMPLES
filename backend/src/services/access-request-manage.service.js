import { getServiceRoleClient } from '../config/supabase.js';
import { notifyApplicantAccessApproved } from './access-request-whatsapp.service.js';

export const ADMIN_ROLE_ID = '849af65c-fe71-464c-8d26-1c61166b29a1';

const normalizeRole = (role) => {
  if (!role) return null;
  const n = String(role).trim().toLowerCase();
  if (n === 'superadmin') return 'superadmin';
  if (n === 'admin') return 'admin';
  if (n === 'user' || n === 'usuario') return 'usuario';
  if (n === 'outsider') return 'outsider';
  return null;
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} userId
 */
export const getUserRole = async (sb, userId) => {
  const { data: linkData } = await sb
    .from('role_x_user_x_empresa')
    .select('roles_id, status')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkData?.roles_id) {
    const { data: roleData } = await sb
      .from('roles')
      .select('roles')
      .eq('id', linkData.roles_id)
      .maybeSingle();
    return normalizeRole(roleData?.roles);
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return normalizeRole(profile?.role);
};

const fetchActorEmail = async (sb, actorUserId) => {
  if (!actorUserId) return null;
  const { data } = await sb.auth.admin.getUserById(actorUserId);
  return data?.user?.email ?? null;
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
export const listPendingAccessRequests = async (sb) => {
  const { data: pendingLinks, error: linksErr } = await sb
    .from('role_x_user_x_empresa')
    .select('user_id, created_at')
    .eq('status', false);

  if (linksErr) throw linksErr;
  if (!pendingLinks?.length) return [];

  const requests = (
    await Promise.all(
      pendingLinks.map(async (link) => {
        const { data: authData } = await sb.auth.admin.getUserById(link.user_id);
        const meta = authData?.user?.user_metadata ?? {};

        const { data: empresa } = await sb
          .from('empresas')
          .select('empresa, cnpj, razao_social, nome_fantasia')
          .eq('requested_by', link.user_id)
          .eq('status', 'pending')
          .maybeSingle();

        if (!empresa) return null;

        return {
          userId: link.user_id,
          email: authData?.user?.email ?? null,
          fullName: meta.full_name ?? meta.name ?? null,
          phone: meta.phone ?? authData?.user?.phone ?? null,
          observacao: meta.access_request_observacao ?? meta.observacao ?? null,
          requestedAt: link.created_at ?? null,
          empresa: {
            nome: empresa.empresa ?? null,
            cnpj: empresa.cnpj ?? null,
            razaoSocial: empresa.razao_social ?? null,
            nomeFantasia: empresa.nome_fantasia ?? null,
          },
        };
      }),
    )
  ).filter(Boolean);

  return requests;
};

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {Awaited<ReturnType<typeof listPendingAccessRequests>>} pending
 * @param {string} identifier
 */
export const findPendingAccessRequestByIdentifier = (pending, identifier) => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const idDigits = onlyDigits(raw);

  if (UUID_RE.test(raw)) {
    return pending.find((r) => r.userId === raw) ?? null;
  }

  if (raw.includes('@')) {
    return pending.find((r) => String(r.email || '').toLowerCase() === lower) ?? null;
  }

  if (idDigits.length === 14) {
    return pending.find((r) => onlyDigits(r.empresa?.cnpj) === idDigits) ?? null;
  }

  if (idDigits.length >= 10) {
    return pending.find((r) => {
      const phoneDigits = onlyDigits(r.phone);
      return phoneDigits === idDigits
        || phoneDigits.endsWith(idDigits)
        || idDigits.endsWith(phoneDigits);
    }) ?? null;
  }

  const byName = pending.filter((r) => {
    const name = String(r.fullName || '').toLowerCase();
    const empresa = String(r.empresa?.nome || r.empresa?.razaoSocial || '').toLowerCase();
    return name.includes(lower) || empresa.includes(lower);
  });
  if (byName.length === 1) return byName[0];
  return null;
};

/**
 * @param {{ actorUserId: string, userId: string }} input
 */
export const approveAccessRequest = async (input) => {
  const sb = getServiceRoleClient();
  const { actorUserId, userId } = input;

  const actorEmail = await fetchActorEmail(sb, actorUserId);
  const approvedAt = new Date().toISOString();

  const { data: pendingLink } = await sb
    .from('role_x_user_x_empresa')
    .select('user_id')
    .eq('user_id', userId)
    .eq('status', false)
    .maybeSingle();

  if (!pendingLink) {
    return { ok: false, reason: 'not_pending' };
  }

  const { data: pendingEmpresa } = await sb
    .from('empresas')
    .select('empresa, razao_social, nome_fantasia')
    .eq('requested_by', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!pendingEmpresa) {
    return { ok: false, reason: 'not_pending' };
  }

  await sb
    .from('role_x_user_x_empresa')
    .update({ status: true, roles_id: ADMIN_ROLE_ID, mei: false })
    .eq('user_id', userId)
    .eq('status', false);

  await sb
    .from('empresas')
    .update({ status: 'active' })
    .eq('requested_by', userId)
    .eq('status', 'pending');

  const { data: authData } = await sb.auth.admin.getUserById(userId);
  const prevMeta = authData?.user?.user_metadata ?? {};
  await sb.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...prevMeta,
      access_approved_at: approvedAt,
      access_approved_by: actorUserId,
      access_approved_by_email: actorEmail,
    },
  });

  const fullName = prevMeta.full_name ?? prevMeta.display_name ?? prevMeta.name ?? null;
  const email = authData?.user?.email ?? null;
  void notifyApplicantAccessApproved(sb, userId, { fullName, email }).catch(() => {});

  const empresaNome = pendingEmpresa.empresa
    ?? pendingEmpresa.razao_social
    ?? pendingEmpresa.nome_fantasia
    ?? null;

  return { ok: true, fullName, email, empresaNome };
};

/**
 * @param {{ userId: string }} input
 */
export const rejectAccessRequest = async (input) => {
  const sb = getServiceRoleClient();
  const { userId } = input;

  const { data: pendingLink } = await sb
    .from('role_x_user_x_empresa')
    .select('user_id')
    .eq('user_id', userId)
    .eq('status', false)
    .maybeSingle();

  if (!pendingLink) {
    return { ok: false, reason: 'not_pending' };
  }

  await sb
    .from('role_x_user_x_empresa')
    .delete()
    .eq('user_id', userId)
    .eq('status', false);

  await sb
    .from('empresas')
    .delete()
    .eq('requested_by', userId)
    .eq('status', 'pending');

  await sb.auth.admin.deleteUser(userId);

  return { ok: true };
};
