import { badRequest } from '../utils/errors.js';
import { createManualFiscalOpeningLot } from '../fiscal-engine/acquisition/manual-opening-lot.service.js';

export const postManualOpeningLot = async (req, res, next) => {
  try {
    const tenantId = req.requesterContext?.empresaId;
    const actorUserId = req.requesterContext?.userId;
    if (!tenantId) return next(badRequest('Empresa não vinculada ao usuário'));
    if (!actorUserId) return next(badRequest('Autenticação obrigatória'));

    const {
      establishmentId,
      produtoCatalogoId,
      quantidade,
      origemMercadoria,
      priorStStatus,
      observacao = null,
      confirmationRequestId = null,
      createdByUserId: payloadActorUserId = null,
    } = req.body ?? {};

    const result = await createManualFiscalOpeningLot({
      tenantId,
      establishmentId,
      produtoCatalogoId,
      quantidade,
      origemMercadoria,
      priorStStatus,
      observacao,
      confirmationRequestId,
      actorUserId,
      payloadActorUserId,
    });

    return res.status(result.idempotentReplay ? 200 : 201).json({
      idempotentReplay: result.idempotentReplay,
      lot: result.lot,
      auditLogId: result.auditLogId,
    });
  } catch (err) {
    if (err?.fiscalIssues) {
      return next(badRequest(err.message, { fiscalIssues: err.fiscalIssues }));
    }
    return next(err);
  }
};
