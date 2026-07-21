import { getServiceRoleClient } from '../config/supabase.js';
import { query } from '../config/pg.js';
import { isLocalAuthMode } from './local-auth.service.js';
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
  if (isLocalAuthMode()) {
    const { rows: linkRows } = await query(
      `SELECT r.roles
       FROM public.role_x_user_x_empresa link
       JOIN public.roles r ON r.id = link.roles_id
       WHERE link.user_id = $1 AND link.status = true
       ORDER BY link.created_at DESC
       LIMIT 1`,
      [userId],
    );
    if (linkRows[0]?.roles) return normalizeRole(linkRows[0].roles);
    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return normalizeRole(profileRows[0]?.role);
  }

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

const resolveAdminRoleIdPg = async () => {
  const { rows } = await query(
    `SELECT id FROM public.roles WHERE lower(trim(roles)) = 'admin' LIMIT 1`,
  );
  return rows[0]?.id || ADMIN_ROLE_ID;
};

const fetchActorEmail = async (sb, actorUserId) => {
  if (!actorUserId) return null;
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT email FROM public.users WHERE id = $1 LIMIT 1`,
      [actorUserId],
    );
    return rows[0]?.email ?? null;
  }
  const { data } = await sb.auth.admin.getUserById(actorUserId);
  return data?.user?.email ?? null;
};

/**
 * Pendentes em AUTH_MODE=local.
 */
export const listPendingAccessRequestsLocal = async () => {
  const { rows: pendingLinks } = await query(
    `SELECT user_id, created_at
     FROM public.role_x_user_x_empresa
     WHERE status = false`,
  );
  if (!pendingLinks.length) return [];

  const requests = [];
  for (const link of pendingLinks) {
    const { rows: userRows } = await query(
      `SELECT id, email, phone, raw_user_meta_data
       FROM public.users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [link.user_id],
    );
    const user = userRows[0];
    if (!user) continue;

    const { rows: empresaRows } = await query(
      `SELECT empresa, cnpj, razao_social, nome_fantasia, logradouro, numero,
              complemento, bairro, cidade, estado, cep, telefone, email
       FROM public.empresas
       WHERE requested_by = $1 AND status = 'pending'
       LIMIT 1`,
      [link.user_id],
    );
    const empresa = empresaRows[0];
    if (!empresa) continue;

    const meta = user.raw_user_meta_data || {};
    const enderecoParts = [
      empresa.logradouro,
      empresa.numero,
      empresa.complemento,
      empresa.bairro,
      empresa.cidade,
      empresa.estado,
    ].filter(Boolean);

    requests.push({
      userId: String(link.user_id),
      email: user.email ?? null,
      fullName: meta.full_name ?? meta.display_name ?? meta.name ?? null,
      phone: meta.phone ?? user.phone ?? null,
      observacao: meta.access_request_observacao ?? meta.observacao ?? null,
      requestedAt: link.created_at ?? null,
      empresa: {
        nome: empresa.empresa ?? null,
        cnpj: empresa.cnpj ?? null,
        razaoSocial: empresa.razao_social ?? null,
        nomeFantasia: empresa.nome_fantasia ?? null,
        endereco: enderecoParts.join(', '),
        cep: empresa.cep ?? null,
        telefone: empresa.telefone ?? null,
        email: empresa.email ?? null,
      },
    });
  }

  return requests;
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} [sb]
 */
export const listPendingAccessRequests = async (sb) => {
  if (isLocalAuthMode()) {
    return listPendingAccessRequestsLocal();
  }

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
  const { actorUserId, userId } = input;

  if (isLocalAuthMode()) {
    const actorEmail = await fetchActorEmail(null, actorUserId);
    const approvedAt = new Date().toISOString();
    const adminRoleId = await resolveAdminRoleIdPg();

    const { rows: pendingLinks } = await query(
      `SELECT user_id FROM public.role_x_user_x_empresa
       WHERE user_id = $1 AND status = false LIMIT 1`,
      [userId],
    );
    if (!pendingLinks[0]) return { ok: false, reason: 'not_pending' };

    const { rows: pendingEmpresas } = await query(
      `SELECT empresa, razao_social, nome_fantasia
       FROM public.empresas
       WHERE requested_by = $1 AND status = 'pending' LIMIT 1`,
      [userId],
    );
    const pendingEmpresa = pendingEmpresas[0];
    if (!pendingEmpresa) return { ok: false, reason: 'not_pending' };

    await query(
      `UPDATE public.role_x_user_x_empresa
       SET status = true, roles_id = $1, mei = false
       WHERE user_id = $2 AND status = false`,
      [adminRoleId, userId],
    );
    await query(
      `UPDATE public.empresas SET status = 'active'
       WHERE requested_by = $1 AND status = 'pending'`,
      [userId],
    );
    await query(
      `UPDATE public.users
       SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [
        userId,
        JSON.stringify({
          access_approved_at: approvedAt,
          access_approved_by: actorUserId,
          access_approved_by_email: actorEmail,
        }),
      ],
    );
    await query(
      `INSERT INTO public.profiles (id, role) VALUES ($1, 'admin')
       ON CONFLICT (id) DO UPDATE SET role = 'admin'`,
      [userId],
    );

    const { rows: userRows } = await query(
      `SELECT email, raw_user_meta_data FROM public.users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const meta = userRows[0]?.raw_user_meta_data || {};
    return {
      ok: true,
      fullName: meta.full_name ?? meta.display_name ?? meta.name ?? null,
      email: userRows[0]?.email ?? null,
      empresaNome:
        pendingEmpresa.empresa
        ?? pendingEmpresa.razao_social
        ?? pendingEmpresa.nome_fantasia
        ?? null,
    };
  }

  const sb = getServiceRoleClient();

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
  const { userId } = input;

  if (isLocalAuthMode()) {
    const { rows: pendingLinks } = await query(
      `SELECT user_id FROM public.role_x_user_x_empresa
       WHERE user_id = $1 AND status = false LIMIT 1`,
      [userId],
    );
    if (!pendingLinks[0]) return { ok: false, reason: 'not_pending' };

    await query(
      `DELETE FROM public.role_x_user_x_empresa WHERE user_id = $1 AND status = false`,
      [userId],
    );
    await query(
      `DELETE FROM public.empresas WHERE requested_by = $1 AND status = 'pending'`,
      [userId],
    );
    await query(`DELETE FROM public.profiles WHERE id = $1`, [userId]).catch(() => {});
    await query(`DELETE FROM public.users WHERE id = $1`, [userId]);
    return { ok: true };
  }

  const sb = getServiceRoleClient();

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
