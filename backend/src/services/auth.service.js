import { createSupabaseClient, getServiceRoleClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest, forbidden, unauthorized, serviceUnavailable } from '../utils/errors.js';
import { assertStrongPassword } from '../utils/passwordPolicy.js';
import {
  canonicalizeBrazilWhatsappPhone,
  canonicalizeWhatsappPhone,
  normalizeWhatsappPhoneDigits,
} from '../utils/whatsapp-phone.js';
import {
  assertN8nPhoneNotLinkedToOtherUser,
  assignN8nPhoneToUser,
  buildPhoneLookupCandidates,
} from './n8n-link-phone.service.js';
import crypto from 'crypto';
import {
  sendPasswordResetEmail,
  sendPasswordResetViaSupabase,
} from './password-reset-email.service.js';
import { buildSignupOriginMetadata, resolveAppOriginFromRequest } from '../utils/app-origin.js';

const assertValidWhatsappPhone = (phone) => {
  const digits = normalizeWhatsappPhoneDigits(phone);
  if (!digits) {
    throw badRequest('Telefone é obrigatório');
  }

  if (digits.startsWith('55')) {
    const cleaned = canonicalizeBrazilWhatsappPhone(digits);
    const national = cleaned.slice(2);
    if (!national || national.length < 10 || national.length > 11) {
      throw badRequest('Telefone inválido. Informe DDD + número (ex.: 21996185328 ou 6696851098).');
    }
    return cleaned;
  }

  if (digits.length < 10 || digits.length > 15) {
    throw badRequest('Telefone internacional inválido.');
  }

  return canonicalizeWhatsappPhone(digits);
};

const phoneLookupVariantSet = (cleanedPhone) => {
  const variants = new Set(buildPhoneLookupCandidates(cleanedPhone));
  variants.add(cleanedPhone);
  return variants;
};

/** Supabase bloqueia telefone duplicado em `user_metadata` — liberta outras contas antes de gravar. */
const releaseAuthPhoneFromOtherUsers = async (adminClient, cleanedPhone, userId) => {
  const variants = phoneLookupVariantSet(cleanedPhone);
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw badRequest(error.message);

    const users = data?.users || [];
    for (const other of users) {
      if (other.id === userId) continue;
      const metaPhone = canonicalizeWhatsappPhone(other.user_metadata?.phone || '');
      if (!metaPhone || !variants.has(metaPhone)) continue;

      const { error: clearError } = await adminClient.auth.admin.updateUserById(other.id, {
        user_metadata: { ...other.user_metadata, phone: null },
      });
      if (clearError) {
        throw badRequest(
          'Este número de WhatsApp já está ligado a outra conta. Peça ao suporte para desvincular.',
          { code: 'PHONE_ALREADY_LINKED' },
        );
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }
};

const mapAuthPhoneUpdateError = (authError) => {
  const msg = String(authError?.message || '').trim();
  if (!msg || msg === 'Error updating user') {
    throw badRequest(
      'Não foi possível salvar este telefone. Ele pode já estar em outra conta ou ser inválido.',
      { code: 'PHONE_UPDATE_FAILED' },
    );
  }
  throw badRequest(msg);
};

const hashInviteToken = (rawToken) => crypto.createHash('sha256').update(String(rawToken).trim(), 'utf8').digest('hex');

const ROLE_DEFAULT = 'usuario';
const ROLE_ALLOWED = new Set(['superadmin', 'admin', 'usuario', 'outsider']);

const normalizeRoleValue = (role) => {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'user') return 'usuario';
  return normalized;
};

const getRoleCandidates = (role) => {
  const normalized = normalizeRoleValue(role);
  if (!normalized) return [];
  if (normalized === 'usuario') return ['user', 'usuario'];
  return [normalized];
};

const ensureSignupRoleLink = async (adminClient, userId, empresaId = null) => {
  const { data: activeLink, error: activeLinkError } = await adminClient
    .from('role_x_user_x_empresa')
    .select('id')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeLinkError) {
    console.error('[AuthService] ensureSignupRoleLink: falha ao buscar link ativo', activeLinkError);
  }

  if (activeLink) return activeLink;

  const { data: roleData, error: roleError } = await adminClient
    .from('roles')
    .select('id')
    .eq('roles', 'User')
    .single();

  if (roleError || !roleData) {
    console.error('[AuthService] ensureSignupRoleLink: falha ao buscar role User', roleError);
    return null;
  }

  const { error: linkError } = await adminClient
    .from('role_x_user_x_empresa')
    .insert({
      user_id: userId,
      roles_id: roleData.id,
      empresas_id: empresaId,
      status: true,
      mei: false
    });

  if (linkError) {
    console.error('[AuthService] ensureSignupRoleLink: falha ao criar link inicial', linkError);
  }

  return null;
};

const getRoleAndCompanyFromLink = async ({ accessToken, userId }) => {
  if (!accessToken || !userId) return { role: null, empresaId: null, mei: null };

  const linkClient = env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseClient({ useServiceRole: true })
    : createSupabaseClient({ accessToken });
  const { data: linkData, error } = await linkClient
    .from('role_x_user_x_empresa')
    .select('empresas_id, roles_id, mei')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[Auth] role_x_user_x_empresa lookup error:', error.message);
  }

  if (!error && linkData?.roles_id) {
    const { data: roleData, error: roleError } = await linkClient
      .from('roles')
      .select('roles')
      .eq('id', linkData.roles_id)
      .maybeSingle();

    if (roleError) {
      console.warn('[Auth] roles lookup error:', roleError.message);
    }

    if (roleData?.roles) {
      const mei = typeof linkData?.mei === 'boolean' ? linkData.mei : false;
      return {
        role: normalizeRoleValue(roleData.roles),
        empresaId: linkData.empresas_id || null,
        mei
      };
    }
  }

  return { role: null, empresaId: null, mei: null };
};

const ensureUserNotBlocked = async ({ accessToken, userId }) => {
  if (!accessToken || !userId || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: linkData } = await adminClient
    .from('role_x_user_x_empresa')
    .select('id, status, expires_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkData?.status === false) {
    throw forbidden('Seu perfil está bloqueado', { code: 'PROFILE_BLOCKED' });
  }

  if (linkData?.expires_at && new Date(linkData.expires_at) < new Date()) {
    if (linkData?.id) {
      await adminClient
        .from('role_x_user_x_empresa')
        .update({ status: false })
        .eq('id', linkData.id);
    }
    throw forbidden('Seu acesso expirou', { code: 'ACCESS_EXPIRED' });
  }
};

const getOrCreateProfileRole = async ({ accessToken, userId }) => {
  if (!accessToken || !userId) return ROLE_DEFAULT;

  const userClient = createSupabaseClient({ accessToken });
  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.role) return profile.role;

  if (!env.SUPABASE_SERVICE_ROLE_KEY) return ROLE_DEFAULT;

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: created } = await adminClient
    .from('profiles')
    .insert({ id: userId, role: ROLE_DEFAULT })
    .select('role')
    .single();

  return created?.role || ROLE_DEFAULT;
};

const getResolvedRoleAndCompany = async ({ accessToken, userId }) => {
  const linkResult = await getRoleAndCompanyFromLink({ accessToken, userId });
  if (linkResult.role) {
    return linkResult;
  }

  const profileRole = await getOrCreateProfileRole({ accessToken, userId });
  const mei = typeof linkResult.mei === 'boolean' ? linkResult.mei : false;
  return { role: profileRole, empresaId: linkResult.empresaId || null, mei };
};

export const signUp = async ({ email, password, phone, displayName, inviteToken, appOrigin }, deps = {}) => {
  if (!email || !password) {
    throw badRequest('Email e senha são obrigatórios');
  }
  assertStrongPassword(password);

  const createSupabaseClientFn = deps.createSupabaseClientFn || createSupabaseClient;
  const cleanedPhone = phone ? canonicalizeWhatsappPhone(phone) : '';
  const supabase = createSupabaseClientFn({ useServiceRole: !!env.SUPABASE_SERVICE_ROLE_KEY });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: cleanedPhone || null,
        display_name: displayName || null,
        ...buildSignupOriginMetadata(
          appOrigin ?? deps.appOrigin ?? resolveAppOriginFromRequest({}, deps.headers ?? {}),
        ),
      }
    }
  });

  if (error) {
    throw badRequest(error.message);
  }

  const userId = data.user?.id;

  if (userId && env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminClient = createSupabaseClientFn({ useServiceRole: true });
    
    let empresaId = null;
    const tokenToUse = inviteToken || deps.inviteToken;
    console.log('[AuthService] Tentando processar convite no signUp. Token:', tokenToUse);
    
    if (tokenToUse) {
      const tokenHash = hashInviteToken(tokenToUse);
      console.log('[AuthService] Hash gerado:', tokenHash);
      
      const { data: inviteData, error: inviteErr } = await adminClient
        .from('empresa_invites')
        .select('id, empresas_id, expires_at, used_at, revoked_at, is_reusable, uses_count')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      
      if (inviteErr) {
        console.error('[AuthService] Erro DB ao buscar convite:', inviteErr);
      }
      
      const now = new Date();
      const expires = inviteData?.expires_at ? new Date(inviteData.expires_at) : null;
      const isExpired = expires && expires <= now;

      // Se for reutilizável, ignoramos used_at
      const isPending = inviteData && 
                        (inviteData.is_reusable || !inviteData.used_at) && 
                        !inviteData.revoked_at && 
                        !isExpired;

      if (isPending) {
        empresaId = inviteData.empresas_id;
        
        if (inviteData.is_reusable) {
          // Apenas incrementa o contador
          await adminClient.rpc('increment_invite_uses', { invite_id: inviteData.id });
          // Fallback caso a RPC não exista:
          await adminClient
            .from('empresa_invites')
            .update({ uses_count: (inviteData.uses_count || 0) + 1 })
            .eq('id', inviteData.id);
        } else {
          // Comportamento clássico: marca como usado
          await adminClient
            .from('empresa_invites')
            .update({ used_at: new Date().toISOString(), uses_count: 1 })
            .eq('id', inviteData.id);
        }
      }
 else {
        console.warn('[AuthService] Convite inválido, expirado ou já usado.');
      }
    }

    await adminClient
      .from('profiles')
      .insert({ 
        id: userId, 
        role: ROLE_DEFAULT,
        display_name: displayName || null,
        phone: cleanedPhone || null
      })
      .select('role')
      .single();

    await ensureSignupRoleLink(adminClient, userId, empresaId);
  }

  if (userId && cleanedPhone) {
    try {
      const adminClient = createSupabaseClientFn({ useServiceRole: true });
      await assertN8nPhoneNotLinkedToOtherUser(adminClient, userId, cleanedPhone);
      await assignN8nPhoneToUser(adminClient, userId, cleanedPhone);
    } catch (err) {
      const code = err?.errors?.code;
      if (code === 'PHONE_ALREADY_LINKED') {
        throw badRequest(
          'Este número de WhatsApp já está ligado a outra conta. Entre na conta certa ou peça ao suporte para desvincular.',
        );
      }
      console.warn('[AuthService] Falha ao sincronizar n8n_link no signup:', err);
    }
  }

  const session = data.session || null;
  return {
    user: data.user,
    userId,
    phone: cleanedPhone || data.user?.user_metadata?.phone || null,
    displayName: displayName || data.user?.user_metadata?.display_name || null,
    session: session
      ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at
        }
      : null
  };
};

const isHttpError = (err) => err && typeof err.status === 'number';

export const signIn = async ({ email, password }) => {
  if (!email || !password) {
    throw badRequest('Email e senha são obrigatórios');
  }

  const { data, error } = await createSupabaseClient().auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    const rawMessage = error.message || '';
    if (rawMessage.toLowerCase().includes('invalid login credentials')) {
      throw unauthorized('Email ou senha incorretos');
    }
    if (error.status === 429) {
      throw badRequest('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    }
    throw unauthorized(rawMessage || 'Falha ao autenticar');
  }

  await ensureUserNotBlocked({
    accessToken: data.session?.access_token ?? null,
    userId: data.user?.id ?? ''
  });

  const { role, empresaId, mei } = await getResolvedRoleAndCompany({
    accessToken: data.session?.access_token ?? null,
    userId: data.user?.id ?? ''
  });

  return {
    user: data.user,
    userId: data.user?.id || null,
    phone: data.user?.user_metadata?.phone || null,
    displayName: data.user?.user_metadata?.display_name || null,
    role,
    empresaId,
    mei,
    session: data.session
  };
};

export const signOut = async (accessToken) => {
  if (!accessToken) return;
  const { error } = await createSupabaseClient({ accessToken }).auth.signOut();
  if (error) {
    throw badRequest(error.message);
  }
};

export const getSession = async (accessToken) => {
  if (!accessToken) return null;

  const supabase = createSupabaseClient({ accessToken });
  const { data: { user } = {}, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  await ensureUserNotBlocked({ accessToken, userId: user.id });

  const { role, empresaId, mei } = await getResolvedRoleAndCompany({ accessToken, userId: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.user_metadata?.phone || null,
      displayName: user.user_metadata?.display_name || null
    },
    access_token: accessToken,
    role,
    empresaId,
    mei
  };
};

export const resetPasswordForEmail = async (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw badRequest('Email é obrigatório');
  const baseUrl = env.FRONTEND_URL ? env.FRONTEND_URL.replace(/\/$/, '') : '';
  const redirectTo = baseUrl ? `${baseUrl}/reset-password` : undefined;

  if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    await sendPasswordResetEmail(normalized, redirectTo);
    return;
  }

  await sendPasswordResetViaSupabase(normalized, redirectTo);
};

export const processRecoveryHash = async ({ access_token, refresh_token, type }) => {
  if (type !== 'recovery' || !access_token) {
    throw badRequest('Hash inválido');
  }

  const recoveryClient = createSupabaseClient({ accessToken: access_token });
  const { data: { session } = {}, error } = await recoveryClient.auth.setSession({
    access_token,
    refresh_token: refresh_token || ''
  });

  if (error || !session) {
    throw badRequest(error?.message || 'Token inválido ou expirado');
  }

  return {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user
    }
  };
};

export const exchangeCodeForSession = async (code) => {
  if (!code) throw badRequest('Código de recuperação ausente');
  const supabase = createSupabaseClient();
  const { data: { session } = {}, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !session) {
    throw badRequest(error?.message || 'Código inválido ou expirado');
  }
  return {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user
    }
  };
};

export const updatePassword = async ({ accessToken, userId, newPassword }) => {
  if (!newPassword) throw badRequest('Senha inválida');
  assertStrongPassword(newPassword);

  if (env.SUPABASE_SERVICE_ROLE_KEY && userId) {
    const adminClient = createSupabaseClient({ useServiceRole: true });
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword
    });
    if (error) throw badRequest(error.message);
    return;
  }

  if (!accessToken) {
    throw unauthorized('Token ausente');
  }

  const supabase = createSupabaseClient({ accessToken });
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (String(error.message || '').toLowerCase().includes('session')) {
      throw badRequest('Sessão inválida. Solicite um novo link de recuperação.');
    }
    throw badRequest(error.message);
  }
};

export const updatePhone = async (accessToken, phone) => {
  if (!accessToken) throw unauthorized();
  if (!phone) throw badRequest('Telefone é obrigatório');

  const supabase = createSupabaseClient({ accessToken });
  const { data: { user } = {}, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw unauthorized();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }

  const cleanedPhone = assertValidWhatsappPhone(phone);
  const adminClient = createSupabaseClient({ useServiceRole: true });

  await releaseAuthPhoneFromOtherUsers(adminClient, cleanedPhone, user.id);

  const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      phone: cleanedPhone,
    },
  });
  if (authError) mapAuthPhoneUpdateError(authError);

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ phone: cleanedPhone })
    .eq('id', user.id);
  if (profileError && profileError.code !== '42703') {
    console.warn('[AuthService] profiles.phone não atualizado:', profileError.message);
  }

  await assignN8nPhoneToUser(adminClient, user.id, cleanedPhone);

  return cleanedPhone;
};

export const updateDisplayName = async (accessToken, displayName) => {
  if (!accessToken) throw unauthorized();
  if (!displayName) throw badRequest('Nome inválido');

  const supabase = createSupabaseClient({ accessToken });
  const { data: { user } = {}, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw unauthorized();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });

  // 1. Atualiza no Auth (Metadata) - FUNDAMENTAL: manter metadados existentes
  const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: { 
      ...user.user_metadata, 
      display_name: displayName 
    }
  });
  if (authError) throw badRequest(authError.message);

  // 2. Sincroniza com a tabela profiles
  await adminClient
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id);
};

export const getLastSeenUpdate = async (accessToken) => {
  if (!accessToken) throw unauthorized();
  const supabase = createSupabaseClient({ accessToken });
  const { data: { user } = {}, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw unauthorized();

  const { data, error } = await supabase
    .from('profiles')
    .select('last_seen_update_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  return { lastSeenUpdateId: data?.last_seen_update_id ?? null };
};

export const updateLastSeenUpdate = async (accessToken, updateId) => {
  if (!accessToken) throw unauthorized();
  if (!updateId || typeof updateId !== 'string') throw badRequest('updateId é obrigatório');

  const supabase = createSupabaseClient({ accessToken });
  const { data: { user } = {}, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw unauthorized();

  const adminClient = getServiceRoleClient();
  const { error } = await adminClient
    .from('profiles')
    .upsert({ id: user.id, last_seen_update_id: updateId }, { onConflict: 'id' });

  if (error) throw badRequest(error.message);
  return { success: true };
};

export const updateRole = async (accessToken, userId, role) => {
  if (!accessToken) throw unauthorized();
  if (!userId || !role) throw badRequest('userId e role são obrigatórios');
  if (!ROLE_ALLOWED.has(role)) throw badRequest('Role inválida');

  const supabase = createSupabaseClient({ accessToken });
  const { data: { user } = {}, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw unauthorized();

  const { data: requesterProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (requesterProfile?.role !== 'superadmin') {
    throw forbidden();
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { error } = await adminClient
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) throw badRequest(error.message);

  return { success: true };
};

export const resolveRequesterContext = async (accessToken) => {
  const session = await getSession(accessToken);
  if (!session) throw unauthorized('Sessão expirada ou inválida');

  return {
    userId: session.user.id,
    role: session.role,
    empresaId: session.empresaId
  };
};

/**
 * Gera um token de impersonação (magic link hash) para um usuário alvo.
 * Apenas Superadmin ou Admin da mesma empresa podem realizar esta ação.
 */
export const impersonate = async (accessToken, targetUserId) => {
  if (!accessToken || !targetUserId) throw badRequest('Token e usuário alvo são obrigatórios');

  // 1. Resolve o contexto de quem está pedindo
  const { userId, role, empresaId } = await resolveRequesterContext(accessToken);

  if (role !== 'superadmin' && role !== 'admin') {
    throw forbidden('Apenas administradores podem acessar outras contas');
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });

  // 2. Busca dados do usuário alvo (email e empresa)
  const { data: targetUser, error: userErr } = await adminClient.auth.admin.getUserById(targetUserId);
  if (userErr || !targetUser?.user) throw badRequest('Usuário alvo não encontrado');

  const { empresaId: targetEmpresaId } = await getResolvedRoleAndCompany({ 
    userId: targetUserId, 
    accessToken: null // Forçamos o uso do service role via getResolvedRoleAndCompany internally if possible or manual check
  });

  // 3. Validação de Escopo
  if (role === 'admin') {
    // Garantir que temos o ID da empresa do alvo via service role
    let finalTargetEmpresaId = targetEmpresaId;
    if (!finalTargetEmpresaId) {
      const { data: link } = await adminClient
        .from('role_x_user_x_empresa')
        .select('empresas_id')
        .eq('user_id', targetUserId)
        .eq('status', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      finalTargetEmpresaId = link?.empresas_id;
    }

    console.log('[Impersonate] Admin check:', { 
      requesterId: userId,
      requesterEmpresaId: empresaId, 
      targetUserId,
      targetEmpresaId: finalTargetEmpresaId 
    });

    if (!empresaId || empresaId !== finalTargetEmpresaId) {
      // Mensagem detalhada para depuração (pode ser simplificada depois)
      const msg = `Você só pode acessar usuários da sua própria empresa. (Sua: ${empresaId || 'null'}, Alvo: ${finalTargetEmpresaId || 'null'})`;
      throw forbidden(msg);
    }

    // Segurança adicional: Admin não pode impersonar Superadmin
    const { role: targetRole } = await getResolvedRoleAndCompany({ userId: targetUserId, accessToken: null });
    if (targetRole === 'superadmin') {
      throw forbidden('Administradores não podem acessar contas de Superadmin');
    }
  }

  // 4. Gera o link de acesso (silent magic link)
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.user.email
  });

  if (linkErr) {
    throw serviceUnavailable('Falha ao gerar acesso: ' + linkErr.message);
  }

  // 5. Retorna o hash para o frontend usar no verifyOtp
  return {
    email: targetUser.user.email,
    token_hash: linkData.properties.hashed_token,
    redirect_to: linkData.properties.action_link
  };
};
