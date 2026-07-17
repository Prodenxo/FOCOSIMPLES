import { getServiceRoleClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';
import { canonicalizeBrazilWhatsappPhone } from '../utils/whatsapp-phone.js';
import {
  buildSignupOriginMetadata,
  resolveAppOriginFromRequest,
} from '../utils/app-origin.js';
import { notifySuperadminAccessRequestSubmitted } from './access-request-whatsapp.service.js';
import { ADMIN_ROLE_ID } from './access-request-manage.service.js';

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

/**
 * Cadastro FocoMEI.
 * - self_serve: admin status=true, mei=false → fluxo /planos (Stripe).
 * - manual_approval: status=false → “em análise”, sem checkout.
 */
export const submitSelfServeEmpresaSignup = async (body = {}, originMeta = {}) => {
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
      // Manual: fica pendente até superadmin aprovar. Self-serve: ativo aguardando plano.
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
 * Usuário autenticado com vínculo pendente (cadastro antigo / edge function antiga)
 * → promove a admin ativo aguardando pagamento do plano.
 * Não libera pedidos manuais (signup_mode = manual_approval).
 */
export const unlockPendingSelfServeSignup = async (userId) => {
  const id = String(userId || '').trim();
  if (!id) throw badRequest('userId obrigatório');

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
