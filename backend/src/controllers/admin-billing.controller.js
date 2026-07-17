import * as stripeBillingService from '../services/stripe-billing.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export const listStripeMeiSubscriptionLines = async (req, res, next) => {
  try {
    const empresaId = String(req.query?.empresaId || '').trim();
    const data = await stripeBillingService.listSubscriptionLinesForEmpresa(
      req.accessToken,
      empresaId
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const createStripeMeiCheckoutSession = async (req, res, next) => {
  try {
    const data = await stripeBillingService.createMeiStripeCheckoutSession(
      req.accessToken,
      req.body
    );
    const msg = data?.checkoutUrl
      ? 'Checkout Stripe criado: envie o link ao admin da empresa para concluir o pagamento'
      : 'Pacote MEI acrescentado à assinatura Stripe (valor na próxima fatura, sem prorata imediata)';
    return sendCreated(res, data, msg);
  } catch (error) {
    return next(error);
  }
};

export const syncStripeMaxMeiFromLines = async (req, res, next) => {
  try {
    const empresaId = String(req.body?.empresaId || '').trim();
    const data = await stripeBillingService.forceSyncEmpresaMaxMeiFromLines(
      req.accessToken,
      empresaId
    );
    return sendSuccess(res, data, 'Limite MEI alinhado com a soma dos pacotes Stripe ativos');
  } catch (error) {
    return next(error);
  }
};
