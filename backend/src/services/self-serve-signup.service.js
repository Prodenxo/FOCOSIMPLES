import { getServiceRoleClient } from '../config/supabase.js';
import { query } from '../config/pg.js';
import { badRequest } from '../utils/errors.js';
import { canonicalizeBrazilWhatsappPhone } from '../utils/whatsapp-phone.js';
import {
  buildSignupOriginMetadata,
  resolveAppOriginFromRequest,
} from '../utils/app-origin.js';
import { notifySuperadminAccessRequestSubmitted } from './access-request-whatsapp.service.js';
import { ADMIN_ROLE_ID } from './access-request-manage.service.js';
import {
  hashPassword,
  isLocalAuthMode,
} from './local-auth.service.js';
import { assertStrongPassword } from '../utils/passwordPolicy.js';

const normalizeText = (value) => {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
};

const normalizeSignupMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'manual_approval' || mode === 'manual' || mode === 'pending') {
    return 'manual_approval';
  }
  return 'self_serve';
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const resolveAdminRoleIdPg = async () => {
  const { rows } = await query(
    `SELECT id, roles FROM public.roles WHERE lower(trim(roles)) = 'admin' LIMIT 1`,
  );
  if (rows[0]?.id) return rows[0].id;
  return ADMIN_ROLE_ID;
};

/**
 * Cadastro empresa em AUTH_MODE=local (Postgres, sem Supabase Auth).
 */
const submitSelfServeEmpresaSignupLocal = async (body = {}, originMeta = {}) => {
  const user = body.user ?? {};
  const empresaInput = body.empresa ?? {};
  const observacao = normalizeText(body.observacao);
  const signupMode = normalizeSignupMode(body.signupMode ?? body.mode);
  const isManualApproval = signupMode === 'manual_approval';

  const email = normalizeEmail(user.email);
  const password = String(user.password || '').trim();
  const fullName = normalizeText(user.fullName);
  const phone = normalizeText(user.phone);

  if (!email) throw badRequest('E-mail é obrigatório.');
  if (!fullName) throw badRequest('Nome completo é obrigatório.');
  assertStrongPassword(password);

  const cnpj = String(empresaInput.cnpj || '').replace(/\D/g, '');
  if (cnpj.length !== 14) throw badRequest('CNPJ inválido (14 dígitos).');

  const razaoSocial = normalizeText(empresaInput.razaoSocial);
  const nomeFantasia = normalizeText(empresaInput.nomeFantasia);
  const empresaNome = razaoSocial || nomeFantasia;
  if (!empresaNome) throw badRequest('Informe razão social ou nome fantasia.');

  const { rows: existingUsers } = await query(
    `SELECT id FROM public.users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
    [email],
  );
  if (existingUsers[0]) {
    const err = badRequest('Este e-mail já está cadastrado.');
    err.status = 409;
    throw err;
  }

  const { rows: empresaRows } = await query(
    `INSERT INTO public.empresas (
      empresa, cnpj, razao_social, nome_fantasia, cep, logradouro, numero,
      complemento, bairro, cidade, estado, telefone, email, max_mei, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $14
    )
    RETURNING id`,
    [
      empresaNome,
      cnpj,
      razaoSocial,
      nomeFantasia,
      String(empresaInput.cep || '').replace(/\D/g, '') || null,
      normalizeText(empresaInput.logradouro),
      normalizeText(empresaInput.numero),
      normalizeText(empresaInput.complemento),
      normalizeText(empresaInput.bairro),
      normalizeText(empresaInput.cidade),
      normalizeText(empresaInput.estado)?.toUpperCase()?.slice(0, 2) || null,
      normalizeText(empresaInput.telefone),
      normalizeText(empresaInput.email) || email,
      isManualApproval ? 'pending' : 'active',
    ],
  );
  const empresaId = empresaRows[0]?.id;
  if (!empresaId) throw badRequest('Erro ao criar empresa.');

  const meta = {
    full_name: fullName,
    display_name: fullName,
    phone: phone || null,
    access_request_observacao: observacao,
    access_requested_at: new Date().toISOString(),
    signup_mode: signupMode,
    ...originMeta,
  };

  let userId = null;
  try {
    const passwordHash = hashPassword(password);
    const { rows: userRows } = await query(
      `INSERT INTO public.users
        (email, password_hash, phone, email_confirmed_at, raw_user_meta_data)
       VALUES ($1, $2, $3, now(), $4::jsonb)
       RETURNING id`,
      [email, passwordHash, phone || null, JSON.stringify(meta)],
    );
    userId = userRows[0]?.id;
    if (!userId) throw badRequest('Erro ao criar usuário.');

    await query(
      `UPDATE public.empresas SET requested_by = $1 WHERE id = $2`,
      [userId, empresaId],
    );
    await query(
      `INSERT INTO public.profiles (id, role) VALUES ($1, 'admin')
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
      [userId],
    );

    const adminRoleId = await resolveAdminRoleIdPg();
    await query(
      `INSERT INTO public.role_x_user_x_empresa
        (user_id, roles_id, empresas_id, status, mei)
       VALUES ($1, $2, $3, $4, false)`,
      [userId, adminRoleId, empresaId, isManualApproval ? false : true],
    );

    if (phone) {
      const cleaned = canonicalizeBrazilWhatsappPhone(phone);
      if (cleaned) {
        await query(
          `INSERT INTO public.n8n_link (user_id, user_number)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET user_number = EXCLUDED.user_number`,
          [userId, cleaned],
        ).catch(() => {});
      }
    }
  } catch (err) {
    if (userId) {
      await query(`DELETE FROM public.role_x_user_x_empresa WHERE user_id = $1`, [userId]).catch(() => {});
      await query(`DELETE FROM public.profiles WHERE id = $1`, [userId]).catch(() => {});
      await query(`DELETE FROM public.users WHERE id = $1`, [userId]).catch(() => {});
    }
    await query(`DELETE FROM public.empresas WHERE id = $1`, [empresaId]).catch(() => {});
    throw err;
  }

  return {
    ok: true,
    userId,
    empresaId,
    signupMode,
    pendingApproval: isManualApproval,
  };
};

/**
 * Cadastro FocoMEI / Foco Simples.
 * - self_serve: admin status=true, mei=false → fluxo /planos (Stripe).
 * - manual_approval: status=false → “em análise”, sem checkout.
 */
export const submitSelfServeEmpresaSignup = async (body = {}, originMeta = {}) => {
  if (isLocalAuthMode()) {
    return submitSelfServeEmpresaSignupLocal(body, originMeta);
  }

  const user = body.user ?? {};
  const empresaInput = body.empresa ?? {};
  const observacao = normalizeText(body.observacao);
  const signupMode = normalizeSignupMode(body.signupMode ?? body.mode);
  const isManualApproval = signupMode === 'manual_approval';

  const email = normalizeText(user.email)?.toLowerCase();
  const password = String(user.password || '').trim();
  const fullName = normalizeText(user.fullName);
  const phone = normalizeText(user.phone);

  if (!email) throw badRequest('E-mail é obrigatório.');
  if (!fullName) throw badRequest('Nome completo é obrigatório.');
  if (password.length < 8) throw badRequest('Senha deve ter pelo menos 8 caracteres.');

  const cnpj = String(empresaInput.cnpj || '').replace(/\D/g, '');
  if (cnpj.length !== 14) throw badRequest('CNPJ inválido (14 dígitos).');

  const razaoSocial = normalizeText(empresaInput.razaoSocial);
  const nomeFantasia = normalizeText(empresaInput.nomeFantasia);
  const empresaNome = razaoSocial || nomeFantasia;
  if (!empresaNome) throw badRequest('Informe razão social ou nome fantasia.');

  const sb = getServiceRoleClient();

  const { data: listData, error: listErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const emailTaken = (listData?.users || []).some(
    (u) => String(u.email || '').toLowerCase() === email,
  );
  if (emailTaken) {
    const err = badRequest('Este e-mail já está cadastrado.');
    err.status = 409;
    throw err;
  }

  const { data: empresaRow, error: empresaErr } = await sb
    .from('empresas')
    .insert({
      empresa: empresaNome,
      cnpj,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      cep: String(empresaInput.cep || '').replace(/\D/g, '') || null,
      logradouro: normalizeText(empresaInput.logradouro),
      numero: normalizeText(empresaInput.numero),
      complemento: normalizeText(empresaInput.complemento),
      bairro: normalizeText(empresaInput.bairro),
      cidade: normalizeText(empresaInput.cidade),
      estado: normalizeText(empresaInput.estado)?.toUpperCase()?.slice(0, 2) || null,
      telefone: normalizeText(empresaInput.telefone),
      email: normalizeText(empresaInput.email) || email,
      max_mei: 0,
      status: 'active',
    })
    .select('id')
    .maybeSingle();

  if (empresaErr || !empresaRow?.id) {
    throw empresaErr ?? badRequest('Erro ao criar empresa.');
  }

  const { data: createdUser, error: createErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      display_name: fullName,
      phone: phone || null,
      access_request_observacao: observacao,
      access_requested_at: new Date().toISOString(),
      signup_mode: signupMode,
      ...originMeta,
    },
  });

  if (createErr || !createdUser?.user?.id) {
    await sb.from('empresas').delete().eq('id', empresaRow.id);
    throw createErr ?? badRequest('Erro ao criar usuário.');
  }

  const userId = createdUser.user.id;

  try {
    await sb.from('empresas').update({ requested_by: userId }).eq('id', empresaRow.id);
    await sb.from('profiles').upsert({ id: userId, role: 'admin' });

    let adminRoleId = ADMIN_ROLE_ID;
    const { data: rows } = await sb.from('roles').select('id, roles');
    const adminRole = (rows || []).find((r) => {
      const n = String(r.roles || '').trim().toLowerCase();
      return n === 'admin';
    });
    if (adminRole?.id) adminRoleId = adminRole.id;

    const { error: linkErr } = await sb.from('role_x_user_x_empresa').insert({
      user_id: userId,
      roles_id: adminRoleId,
      empresas_id: empresaRow.id,
      status: isManualApproval ? false : true,
      mei: false,
    });
    if (linkErr) throw new Error(linkErr.message);

    if (phone) {
      const cleaned = canonicalizeBrazilWhatsappPhone(phone);
      if (cleaned) {
        await sb
          .from('n8n_link')
          .upsert({ user_id: userId, user_number: cleaned }, { onConflict: 'user_id' });
      }
    }
  } catch (err) {
    await sb.from('role_x_user_x_empresa').delete().eq('user_id', userId).catch(() => {});
    await sb.from('profiles').delete().eq('id', userId).catch(() => {});
    await sb.from('empresas').delete().eq('id', empresaRow.id).catch(() => {});
    await sb.auth.admin.deleteUser(userId).catch(() => {});
    throw err;
  }

  void notifySuperadminAccessRequestSubmitted(sb, {
    fullName,
    email,
    phone: phone || null,
    empresaNome,
    cnpj,
    observacao,
  }).catch(() => {});

  return {
    ok: true,
    userId,
    empresaId: empresaRow.id,
    signupMode,
    pendingApproval: isManualApproval,
  };
};

/**
 * Usuário autenticado com vínculo pendente
 * → promove a admin ativo aguardando pagamento do plano.
 */
export const unlockPendingSelfServeSignup = async (userId) => {
  const id = String(userId || '').trim();
  if (!id) throw badRequest('userId obrigatório');

  if (isLocalAuthMode()) {
    const { rows: linkRows } = await query(
      `SELECT user_id, empresas_id, status, mei
       FROM public.role_x_user_x_empresa
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id],
    );
    const link = linkRows[0];
    if (!link?.empresas_id) {
      return { unlocked: false, reason: 'no_link' };
    }
    if (link.status === true) {
      return { unlocked: false, reason: 'already_active', empresaId: link.empresas_id };
    }

    const { rows: userRows } = await query(
      `SELECT raw_user_meta_data FROM public.users WHERE id = $1 LIMIT 1`,
      [id],
    );
    const signupMode = normalizeSignupMode(userRows[0]?.raw_user_meta_data?.signup_mode);
    if (signupMode === 'manual_approval') {
      return {
        unlocked: false,
        reason: 'manual_approval',
        empresaId: link.empresas_id,
      };
    }

    const empresaId = link.empresas_id;
    const adminRoleId = await resolveAdminRoleIdPg();
    await query(
      `UPDATE public.empresas SET status = 'active', requested_by = $1 WHERE id = $2`,
      [id, empresaId],
    );
    await query(
      `UPDATE public.role_x_user_x_empresa
       SET status = true, roles_id = $1, mei = false
       WHERE user_id = $2 AND empresas_id = $3`,
      [adminRoleId, id, empresaId],
    );
    await query(
      `INSERT INTO public.profiles (id, role) VALUES ($1, 'admin')
       ON CONFLICT (id) DO UPDATE SET role = 'admin'`,
      [id],
    );
    return { unlocked: true, empresaId };
  }

  const sb = getServiceRoleClient();

  const { data: link } = await sb
    .from('role_x_user_x_empresa')
    .select('user_id, empresas_id, status, mei')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link?.empresas_id) {
    return { unlocked: false, reason: 'no_link' };
  }

  if (link.status === true) {
    return { unlocked: false, reason: 'already_active', empresaId: link.empresas_id };
  }

  const { data: authData } = await sb.auth.admin.getUserById(id);
  const signupMode = normalizeSignupMode(
    authData?.user?.user_metadata?.signup_mode,
  );
  if (signupMode === 'manual_approval') {
    return {
      unlocked: false,
      reason: 'manual_approval',
      empresaId: link.empresas_id,
    };
  }

  const empresaId = link.empresas_id;

  await sb
    .from('empresas')
    .update({ status: 'active', requested_by: id })
    .eq('id', empresaId);

  await sb
    .from('role_x_user_x_empresa')
    .update({
      status: true,
      roles_id: ADMIN_ROLE_ID,
      mei: false,
    })
    .eq('user_id', id)
    .eq('empresas_id', empresaId);

  await sb.from('profiles').upsert({ id, role: 'admin' });

  return { unlocked: true, empresaId };
};

export const buildOriginMetaFromBody = (body, headers) => {
  const appOrigin = resolveAppOriginFromRequest(body, headers);
  return buildSignupOriginMetadata(appOrigin);
};
