import { getServiceRoleClient } from '../config/supabase.js';

const ADMIN_ROLE_ID = '849af65c-fe71-464c-8d26-1c61166b29a1';

const isAccessRequestLink = (link, emp, activeMembersOnEmpresa) => {
  if (emp.requested_by && emp.requested_by === link.user_id) return true;
  if (link.status === false) return true;
  if (
    link.status === true &&
    link.roles_id === ADMIN_ROLE_ID &&
    activeMembersOnEmpresa === 1
  ) {
    return true;
  }
  return false;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const AUTH_LOOKUP_CONCURRENCY = 8;

/** Busca usuários auth com concorrência limitada (evita rate-limit / hang). */
const fetchAuthUsersByIds = async (sb, userIds) => {
  const map = new Map();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return map;

  let cursor = 0;
  const worker = async () => {
    while (cursor < unique.length) {
      const userId = unique[cursor];
      cursor += 1;
      try {
        const { data } = await sb.auth.admin.getUserById(userId);
        if (data?.user) map.set(userId, data.user);
      } catch {
        /* usuário removido */
      }
    }
  };

  const workers = Math.min(AUTH_LOOKUP_CONCURRENCY, unique.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return map;
};

const fetchEmpresasByIds = async (sb, empresaIds) => {
  const empById = new Map();
  if (!empresaIds.length) return empById;

  for (const ids of chunk(empresaIds, 80)) {
    const { data, error } = await sb
      .from('empresas')
      .select(
        'id, empresa, cnpj, razao_social, nome_fantasia, status, requested_by, created_at, email, max_mei',
      )
      .in('id', ids);
    if (error) throw error;
    for (const row of data || []) {
      empById.set(row.id, row);
    }
  }

  return empById;
};

/**
 * Histórico de solicitações (service role). Consultas em lote — sem tabela nova / RLS.
 */
export const buildAccessRequestReport = async (limit = 200) => {
  const sb = getServiceRoleClient();
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const linkCap = Math.min(cap * 3, 600);

  const { data: links, error: linksErr } = await sb
    .from('role_x_user_x_empresa')
    .select('user_id, empresas_id, created_at, status, roles_id, mei')
    .order('created_at', { ascending: false })
    .limit(linkCap);

  if (linksErr) throw linksErr;
  if (!links?.length) return { entries: [] };

  const empresaIds = [...new Set(links.map((l) => l.empresas_id).filter(Boolean))];

  const empById = await fetchEmpresasByIds(sb, empresaIds);

  const { data: activeLinks, error: activeErr } = await sb
    .from('role_x_user_x_empresa')
    .select('empresas_id')
    .in('empresas_id', empresaIds)
    .eq('status', true);

  if (activeErr) throw activeErr;

  const activeCountByEmpresa = new Map();
  for (const row of activeLinks || []) {
    if (!row.empresas_id) continue;
    activeCountByEmpresa.set(
      row.empresas_id,
      (activeCountByEmpresa.get(row.empresas_id) || 0) + 1,
    );
  }

  const seen = new Set();
  const candidates = [];

  for (const link of links) {
    const key = `${link.user_id}-${link.empresas_id}`;
    if (seen.has(key)) continue;

    const emp = empById.get(link.empresas_id);
    if (!emp) continue;

    const activeMembers = activeCountByEmpresa.get(link.empresas_id) ?? 0;
    if (!isAccessRequestLink(link, emp, activeMembers)) continue;

    seen.add(key);
    candidates.push({ link, emp, key });
    if (candidates.length >= cap) break;
  }

  const authUsers = await fetchAuthUsersByIds(
    sb,
    candidates.map((c) => c.link.user_id),
  );

  const entries = candidates.map(({ link, emp, key }) => {
    const authUser = authUsers.get(link.user_id);
    const meta = authUser?.user_metadata ?? {};
    const empresaNome = emp.empresa ?? emp.razao_social ?? emp.nome_fantasia ?? null;
    const requestedAt =
      meta.access_requested_at ?? link.created_at ?? emp.created_at ?? null;
    const isApproved = link.status === true;

    return {
      id: key,
      eventType: isApproved ? 'approved' : 'submitted',
      subjectUserId: link.user_id,
      email: authUser?.email ?? emp.email ?? null,
      fullName: meta.full_name ?? meta.name ?? empresaNome,
      empresaNome,
      cnpj: emp.cnpj ?? null,
      observacao: meta.access_request_observacao ?? meta.observacao ?? null,
      actorEmail: isApproved ? meta.access_approved_by_email ?? null : null,
      occurredAt: isApproved ? meta.access_approved_at ?? requestedAt : requestedAt,
      requestedAt,
      approvedAt: isApproved ? meta.access_approved_at ?? null : null,
    };
  });

  entries.sort((a, b) => {
    const ta = new Date(a.occurredAt || 0).getTime();
    const tb = new Date(b.occurredAt || 0).getTime();
    return tb - ta;
  });

  return { entries };
};
