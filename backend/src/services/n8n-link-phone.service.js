import { badRequest } from '../utils/errors.js';
import {
  canonicalizeWhatsappPhone,
  expandWhatsappPhoneLookupVariants,
  isBrazilWhatsappDigits,
} from '../utils/whatsapp-phone.js';

/**
 * Tenta bater com o que está em `n8n_link.user_number` (pode estar com ou sem 55).
 * @param {string} digits
 * @returns {string[]}
 */
export const buildPhoneLookupCandidates = (digits) => {
  const out = new Set();
  for (const v of expandWhatsappPhoneLookupVariants(digits)) {
    out.add(v);
    if (!isBrazilWhatsappDigits(v)) continue;
    if (v.startsWith('55') && v.length > 11) {
      out.add(v.slice(2));
    }
    if (!v.startsWith('55') && v.length >= 10 && v.length <= 11) {
      out.add(`55${v}`);
    }
  }
  return [...out];
};

/**
 * Vários registos com o mesmo `user_number` quebram `.maybeSingle()`.
 * @param {Array<{ user_id?: string | null }> | null | undefined} rows
 * @param {string} matchedNumber
 * @returns {string | null}
 */
/**
 * Agrega user_id encontrados em todas as variantes do telefone (55 vs sem 55, nono dígito).
 * @returns {Map<string, string>} userId → user_number que bateu
 */
export const collectUserIdsFromN8nLinkCandidates = async (admin, lookupCandidates) => {
  const matches = new Map();

  for (const num of lookupCandidates) {
    const { data: rows, error } = await admin
      .from('n8n_link')
      .select('user_id')
      .eq('user_number', num)
      .limit(20);

    if (error) throw badRequest(error.message);

    for (const row of rows || []) {
      const userId = row?.user_id != null ? String(row.user_id).trim() : '';
      if (userId && !matches.has(userId)) {
        matches.set(userId, num);
      }
    }
  }

  return matches;
};

/**
 * Várias contas com o mesmo WhatsApp (formatos diferentes) — prefere vínculo activo e histórico.
 * @returns {string | null} userId preferido ou null se empate total
 */
export const pickPreferredUserIdFromPhoneMatches = async (admin, userIds) => {
  if (!userIds?.length) return null;
  if (userIds.length === 1) return userIds[0];

  const scores = await Promise.all(
    userIds.map(async (uid) => {
      const { data: memberships } = await admin
        .from('role_x_user_x_empresa')
        .select('status')
        .eq('user_id', uid)
        .eq('status', true)
        .limit(1);

      const { count, error: countError } = await admin
        .from('lancamentos_id')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid);

      if (countError) throw badRequest(countError.message);

      return {
        uid,
        hasActiveMembership: (memberships || []).length > 0,
        txCount: count || 0,
      };
    }),
  );

  scores.sort((a, b) => {
    if (a.hasActiveMembership !== b.hasActiveMembership) {
      return a.hasActiveMembership ? -1 : 1;
    }
    return b.txCount - a.txCount;
  });

  const best = scores[0];
  const second = scores[1];
  if (
    second
    && best.hasActiveMembership === second.hasActiveMembership
    && best.txCount === second.txCount
  ) {
    return null;
  }

  return best.uid;
};

export const pickUserIdFromN8nLinkRows = (rows, matchedNumber) => {
  const userIds = [
    ...new Set(
      (rows || [])
        .map((r) => (r?.user_id != null ? String(r.user_id).trim() : ''))
        .filter(Boolean),
    ),
  ];

  if (userIds.length === 0) return null;
  if (userIds.length === 1) return userIds[0];

  throw badRequest(
    `O telefone ${matchedNumber} está associado a ${userIds.length} contas no sistema. `
    + 'Peça ao suporte para corrigir o vínculo WhatsApp (tabela n8n_link) e tente de novo.',
    { code: 'PHONE_AMBIGUOUS', userIds, matchedNumber },
  );
};

/**
 * Impede que dois utilizadores partilhem o mesmo WhatsApp em `n8n_link`.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} userId
 * @param {string} userNumber
 */
export const assertN8nPhoneNotLinkedToOtherUser = async (admin, userId, userNumber) => {
  const { data: rows, error } = await admin
    .from('n8n_link')
    .select('user_id')
    .eq('user_number', userNumber)
    .limit(20);

  if (error) throw badRequest(error.message);

  const otherIds = [
    ...new Set(
      (rows || [])
        .map((r) => (r?.user_id != null ? String(r.user_id).trim() : ''))
        .filter((id) => id && id !== userId),
    ),
  ];

  if (otherIds.length > 0) {
    throw badRequest(
      'Este número de WhatsApp já está ligado a outra conta Meu Financeiro.',
      { code: 'PHONE_ALREADY_LINKED', otherUserIds: otherIds },
    );
  }
};

/**
 * Atribui o WhatsApp à conta actual e remove o mesmo número de outras contas.
 * Usado quando o utilizador guarda o telefone no perfil (site/app).
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} userId
 * @param {string} userNumber — formato canónico (ex.: 5521996185328)
 */
export const assignN8nPhoneToUser = async (admin, userId, userNumber) => {
  const canonical = canonicalizeWhatsappPhone(userNumber);
  if (!canonical) throw badRequest('Telefone inválido');

  const lookupCandidates = buildPhoneLookupCandidates(canonical);

  for (const num of lookupCandidates) {
    const { error: deleteError } = await admin
      .from('n8n_link')
      .delete()
      .eq('user_number', num)
      .neq('user_id', userId);

    if (deleteError) throw badRequest(deleteError.message);
  }

  const { error } = await admin
    .from('n8n_link')
    .upsert(
      { user_id: userId, user_number: canonical },
      { onConflict: 'user_id' },
    );

  if (error) throw badRequest(error.message);
};
