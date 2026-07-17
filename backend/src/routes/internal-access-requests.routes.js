import { Router } from 'express';
import { getServiceRoleClient } from '../config/supabase.js';
import { badRequest, unauthorized } from '../utils/errors.js';
import { normalizeEnvSecret } from '../config/env.js';
import { buildAccessRequestReport } from '../services/access-request-report.service.js';
import {
  approveAccessRequest,
  getUserRole,
  listPendingAccessRequests,
  rejectAccessRequest,
} from '../services/access-request-manage.service.js';
import { notifySuperadminAccessRequestSubmitted } from '../services/access-request-whatsapp.service.js';
import { canonicalizeBrazilWhatsappPhone } from '../utils/whatsapp-phone.js';
import { buildSignupOriginMetadata, resolveAppOriginFromRequest } from '../utils/app-origin.js';

const router = Router();

const normalizeText = (value) => {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
};

const requireInternalSecret = (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return next(unauthorized());
  const token = normalizeEnvSecret(authHeader.replace(/^Bearer\s+/i, '').trim());
  const secret = normalizeEnvSecret(process.env.ACCESS_REQUEST_INTERNAL_SECRET || '');
  if (!secret || token !== secret) return next(unauthorized());
  return next();
};

// POST /api/internal/access-requests/manage
router.post('/manage', requireInternalSecret, async (req, res, next) => {
  try {
    const { action, actorUserId, userId } = req.body ?? {};

    if (!actorUserId) return next(badRequest('actorUserId obrigatório'));
    if (!action) return next(badRequest('action obrigatória'));

    const sb = getServiceRoleClient();
    const role = await getUserRole(sb, actorUserId);
    if (role !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas superadmin.' });
    }

    // LIST: busca usuários com role_x_user_x_empresa.status = false E empresa pendente
    if (action === 'list') {
      const pending = await listPendingAccessRequests(sb);
      const requests = await Promise.all(
        pending.map(async (item) => {
          const { data: empresa } = await sb
            .from('empresas')
            .select(
              'empresa, cnpj, razao_social, nome_fantasia, logradouro, numero, complemento, bairro, cidade, estado, cep, telefone, email',
            )
            .eq('requested_by', item.userId)
            .eq('status', 'pending')
            .maybeSingle();

          if (!empresa) return null;

          const enderecoParts = [
            empresa.logradouro,
            empresa.numero,
            empresa.complemento,
            empresa.bairro,
            empresa.cidade,
            empresa.estado,
          ].filter(Boolean);

          return {
            userId: item.userId,
            email: item.email,
            fullName: item.fullName,
            phone: item.phone,
            observacao: item.observacao,
            requestedAt: item.requestedAt,
            empresa: {
              nome: empresa.empresa ?? item.empresa?.nome ?? null,
              cnpj: empresa.cnpj ?? item.empresa?.cnpj ?? null,
              razaoSocial: empresa.razao_social ?? item.empresa?.razaoSocial ?? null,
              nomeFantasia: empresa.nome_fantasia ?? item.empresa?.nomeFantasia ?? null,
              endereco: enderecoParts.join(', '),
              cep: empresa.cep ?? null,
              telefone: empresa.telefone ?? null,
              email: empresa.email ?? null,
            },
          };
        }),
      );

      return res.json({ requests: requests.filter(Boolean) });
    }

    // REPORT: histórico derivado de empresas + auth metadata (sem tabela de auditoria)
    if (action === 'report') {
      const limit = Math.min(Math.max(Number(req.body?.limit) || 200, 1), 500);
      const eventType = normalizeText(req.body?.eventType);

      let { entries } = await buildAccessRequestReport(limit);
      if (eventType && ['submitted', 'approved'].includes(eventType)) {
        entries = entries.filter((e) => e.eventType === eventType);
      }

      return res.json({ entries });
    }

    // APPROVE: ativa o vínculo e a empresa
    if (action === 'approve') {
      if (!userId) return next(badRequest('userId obrigatório para approve'));

      const result = await approveAccessRequest({ actorUserId, userId });
      if (!result.ok) {
        return res.status(404).json({ error: 'Solicitação não encontrada ou já processada.' });
      }

      return res.json({ ok: true });
    }

    // REJECT: remove o vínculo pendente, a empresa e o usuário
    if (action === 'reject') {
      if (!userId) return next(badRequest('userId obrigatório para reject'));

      const result = await rejectAccessRequest({ userId });
      if (!result.ok) {
        return res.status(404).json({ error: 'Solicitação não encontrada ou já processada.' });
      }

      return res.json({ ok: true });
    }

    return next(badRequest(`Ação desconhecida: ${action}`));
  } catch (err) {
    return next(err);
  }
});

// POST /api/internal/access-requests/submit
router.post('/submit', requireInternalSecret, async (req, res, next) => {
  try {
    const {
      buildOriginMetaFromBody,
      submitSelfServeEmpresaSignup,
    } = await import('../services/self-serve-signup.service.js');
    const originMeta = buildOriginMetaFromBody(req.body ?? {}, req.headers);
    const result = await submitSelfServeEmpresaSignup(req.body ?? {}, originMeta);
    return res.json(result);
  } catch (err) {
    if (err?.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    return next(err);
  }
});

export default router;
