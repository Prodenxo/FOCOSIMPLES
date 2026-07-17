import { env } from '../config/env.js';
import * as stripeBillingService from '../services/stripe-billing.service.js';
import { unauthorized } from '../utils/errors.js';

const parseBooleanLike = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'sim'].includes(text)) return true;
  if (['0', 'false', 'no', 'nao', 'não'].includes(text)) return false;
  return fallback;
};

const requireWebhookSecret = () => {
  const requireSecret = parseBooleanLike(
    env.STRIPE_WEBHOOK_REQUIRE_SECRET,
    env.NODE_ENV !== 'development'
  );
  const secret = String(env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    if (requireSecret) {
      throw unauthorized('Webhook Stripe: STRIPE_WEBHOOK_SECRET não configurado');
    }
    return null;
  }
  return secret;
};

/**
 * `req.body` deve ser Buffer (rota montada com express.raw).
 */
export const postStripeWebhook = async (req, res, next) => {
  try {
    const secret = requireWebhookSecret();
    const sig = req.headers['stripe-signature'];
    const buf = req.body;
    if (!Buffer.isBuffer(buf)) {
      throw unauthorized('Webhook Stripe: body inválido');
    }

    const stripe = stripeBillingService.getStripe();
    let event;
    if (secret && sig) {
      event = stripe.webhooks.constructEvent(buf, sig, secret);
    } else {
      // eslint-disable-next-line no-console
      console.warn('[Stripe] webhook sem verificação de assinatura (apenas desenvolvimento)');
      event = JSON.parse(buf.toString('utf8'));
    }

    // eslint-disable-next-line no-console
    console.log('[Stripe] webhook', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription') {
          await stripeBillingService.finalizeMeiLineFromCheckoutSession(session);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await stripeBillingService.syncMeiLineFromStripeSubscriptionObject(event.data.object);
        break;
      }
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
};
