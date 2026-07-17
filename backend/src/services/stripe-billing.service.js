import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { createSupabaseClient } from "../config/supabase.js";
import { env } from "../config/env.js";
import { badRequest, forbidden } from "../utils/errors.js";
import { getRequesterContext } from "./users.service.js";
import {
  resolveMeiPricing as resolveMeiPricingRaw,
  MEI_PRICING_INVALID_MESSAGE,
  MEI_PUBLIC_PACKAGES,
} from "./mei-billing-pricing.js";

const ONLY_DIGITS = (s) => String(s || "").replace(/\D/g, "");

const parseBoolEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const t = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "sim"].includes(t)) return true;
  if (["0", "false", "no", "nao", "não"].includes(t)) return false;
  return fallback;
};

const resolveMeiPricing = (meiSlots) => {
  const pricing = resolveMeiPricingRaw(meiSlots);
  if (!pricing) {
    if (!Number.isInteger(meiSlots) || meiSlots <= 0) {
      throw badRequest("meiSlots inválido");
    }
    throw badRequest(MEI_PRICING_INVALID_MESSAGE);
  }
  return pricing;
};

const mapStripeSubscriptionStatus = (stripeStatus) => {
  const s = String(stripeStatus || "").toLowerCase();
  if (s === "active" || s === "trialing") return "active";
  if (s === "canceled" || s === "incomplete_expired") return "cancelled";
  return "pending";
};

const normalizeBillingTiming = (raw) => {
  const t = String(raw || "checkout")
    .trim()
    .toLowerCase();
  if (
    ["next_cycle", "next_invoice", "proxima_fatura", "próxima_fatura"].includes(
      t,
    )
  ) {
    return "next_cycle";
  }
  return "checkout";
};

/**
 * Escolhe uma Subscription Stripe ativa da empresa (mais recente na BD).
 */
const resolveStripeSubscriptionIdForEmpresa = async (
  adminClient,
  empresaId,
  explicitSubId,
) => {
  const explicit = String(explicitSubId || "").trim();
  if (explicit) return explicit;

  const { data: rows, error } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("stripe_subscription_id")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .not("stripe_subscription_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw badRequest(error.message);
  const first = (rows || []).find((r) =>
    String(r.stripe_subscription_id || "").trim(),
  );
  return first ? String(first.stripe_subscription_id).trim() : "";
};

let stripeSingleton = null;
export const getStripe = () => {
  const key = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    throw badRequest("Stripe não configurado: defina STRIPE_SECRET_KEY");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
};

/**
 * Atualiza `empresas.max_mei` com a soma de `mei_slots` das linhas Stripe ativas.
 * @param {object} [options]
 * @param {boolean} [options.force] — `true`: evento da Stripe ou ação superadmin (sempre grava).
 *   `false`/omitido: respeita `STRIPE_SYNC_MAX_MEI=false` para não sobrescrever limite manual em fluxos futuros.
 *   **Todos os webhooks e confirmações de cobrança Stripe usam `force: true`.**
 */
export const syncEmpresaMaxMeiFromLines = async (
  adminClient,
  empresaId,
  options = {},
) => {
  const force = options.force === true;
  if (!force && !parseBoolEnv(env.STRIPE_SYNC_MAX_MEI, true)) return;

  const { data: lines, error } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("mei_slots")
    .eq("empresa_id", empresaId)
    .eq("status", "active");

  if (error) throw badRequest(error.message);

  const sum = (lines || []).reduce(
    (acc, row) => acc + Number(row.mei_slots || 0),
    0,
  );
  const { error: upErr } = await adminClient
    .from("empresas")
    .update({ max_mei: sum })
    .eq("id", empresaId);

  if (upErr) throw badRequest(upErr.message);

  return { max_mei: sum };
};

/**
 * Após pagamento: empresa active + admin criador com mei=true (libera o app).
 */
export const activateEmpresaMeiAccessAfterPayment = async (
  adminClient,
  empresaId,
) => {
  const id = String(empresaId || "").trim();
  if (!id) return { activated: false };

  await adminClient.from("empresas").update({ status: "active" }).eq("id", id);

  const { data: empresa } = await adminClient
    .from("empresas")
    .select("requested_by")
    .eq("id", id)
    .maybeSingle();

  const ownerId = String(empresa?.requested_by || "").trim();
  if (ownerId) {
    await adminClient
      .from("role_x_user_x_empresa")
      .update({ status: true, mei: true })
      .eq("user_id", ownerId)
      .eq("empresas_id", id);
  }

  return { activated: true, ownerId: ownerId || null };
};

/**
 * Superadmin: força `max_mei` = soma das linhas ativas (corrige histórico quando o sync estava desligado).
 */
export const forceSyncEmpresaMaxMeiFromLines = async (
  accessToken,
  empresaId,
) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const id = String(empresaId || "").trim();
  if (!id) throw badRequest("empresaId é obrigatório");

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const result = await syncEmpresaMaxMeiFromLines(adminClient, id, {
    force: true,
  });
  return result || { max_mei: 0 };
};

/**
 * Garante Customer Stripe na empresa (CNPJ BR + nome + email).
 */
export const ensureEmpresaStripeCustomer = async (adminClient, empresa) => {
  if (empresa.stripe_customer_id) {
    return empresa.stripe_customer_id;
  }

  const stripe = getStripe();
  const cnpjDigits = ONLY_DIGITS(empresa.cnpj);
  if (!cnpjDigits || cnpjDigits.length !== 14) {
    throw badRequest(
      "Empresa sem CNPJ válido (14 dígitos) para cadastro na Stripe",
    );
  }

  const name =
    String(
      empresa.razao_social || empresa.nome_fantasia || empresa.empresa || "",
    ).trim() || `Empresa ${cnpjDigits}`;
  const email = String(empresa.email || "").trim();
  if (!email) {
    throw badRequest("Empresa sem email para cadastro na Stripe");
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      empresa_id: String(empresa.id),
      cnpj: cnpjDigits,
    },
  });

  const { error } = await adminClient
    .from("empresas")
    .update({ stripe_customer_id: customer.id })
    .eq("id", empresa.id);

  if (error) throw badRequest(error.message);

  return customer.id;
};

/**
 * Cria Checkout Session (pagamento já) ou acrescenta item à assinatura existente (cobrança no próximo ciclo).
 * `billingTiming`: `checkout` (padrão) | `next_cycle` (próxima fatura, sem prorata).
 * Superadmin (qualquer empresa) ou admin da própria empresa (self-serve).
 */
export const createMeiStripeCheckoutSession = async (
  accessToken,
  input = {},
) => {
  const requester = await getRequesterContext(accessToken);
  const isSuperadmin = requester.role === "superadmin";
  const isAdmin = requester.role === "admin";
  if (!isSuperadmin && !isAdmin) throw forbidden();

  let empresaId = String(input.empresaId || "").trim();
  if (isAdmin) {
    if (!requester.empresaId) throw forbidden("Empresa não vinculada ao usuário");
    empresaId = String(requester.empresaId);
  }

  const meiSlots = Number(input.meiSlots);
  const pricing = resolveMeiPricing(meiSlots);
  const providedValue = input.value === undefined ? null : Number(input.value);
  const description =
    String(input.description || "").trim() ||
    `Assinatura MEI (${meiSlots} vagas - R$ ${pricing.total.toFixed(2)}/mês)`;
  const billingTiming = normalizeBillingTiming(input.billingTiming);

  if (!empresaId) throw badRequest("empresaId é obrigatório");
  if (
    providedValue !== null &&
    (!Number.isFinite(providedValue) || providedValue <= 0)
  ) {
    throw badRequest("value inválido");
  }
  if (
    providedValue !== null &&
    Math.abs(providedValue - pricing.total) > 0.01
  ) {
    throw badRequest(
      `value divergente: para ${meiSlots} MEIs o valor correto é ${pricing.total.toFixed(2)}`,
    );
  }

  // Self-serve (admin): só checkout da 1ª assinatura — add-on next_cycle fica no painel superadmin.
  if (isAdmin && !isSuperadmin && billingTiming !== "checkout") {
    throw badRequest(
      'Para contratar o plano, use o Checkout. Ampliação de vagas: fale com o suporte.',
    );
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: empresa, error: empErr } = await adminClient
    .from("empresas")
    .select(
      "id, empresa, cnpj, razao_social, nome_fantasia, email, stripe_customer_id",
    )
    .eq("id", empresaId)
    .maybeSingle();

  if (empErr) throw badRequest(empErr.message);
  if (!empresa?.id) throw badRequest("Empresa não encontrada");

  const unitAmount = Math.round(pricing.total * 100);
  if (!Number.isFinite(unitAmount) || unitAmount < 50) {
    throw badRequest("Valor em centavos inválido para Stripe");
  }

  const externalReference =
    String(input.externalReference || "").trim() || randomUUID();
  const stripe = getStripe();

  if (billingTiming === "next_cycle") {
    await ensureEmpresaStripeCustomer(adminClient, empresa);
    const subId = await resolveStripeSubscriptionIdForEmpresa(
      adminClient,
      empresaId,
      input.stripeSubscriptionId,
    );
    if (!subId) {
      throw badRequest(
        'Nenhuma assinatura Stripe ativa para esta empresa. Use billingTiming "checkout" na primeira compra ou informe stripeSubscriptionId.',
      );
    }

    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ["items.data"],
    });
    const st = String(sub.status || "").toLowerCase();
    if (st !== "active" && st !== "trialing") {
      throw badRequest(
        "Assinatura Stripe não está ativa; não é possível acrescentar na próxima fatura",
      );
    }

    const itemsPayload = (sub.items?.data || []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
    }));

    // subscriptions.update exige price_data.product (ID), não product_data (Checkout aceita product_data).
    const product = await stripe.products.create({
      name: description,
      metadata: { mei_slots: String(meiSlots) },
    });

    itemsPayload.push({
      price_data: {
        currency: "brl",
        unit_amount: unitAmount,
        product: product.id,
        recurring: { interval: "month" },
      },
      quantity: 1,
    });

    const updated = await stripe.subscriptions.update(subId, {
      items: itemsPayload,
      proration_behavior: "none",
    });

    const { data: row, error: insErr } = await adminClient
      .from("empresa_mei_subscription_lines")
      .insert({
        empresa_id: empresaId,
        mei_slots: meiSlots,
        stripe_subscription_id: subId,
        status: "active",
        value_numeric: pricing.total,
        billing_type: "stripe_next_cycle",
        external_reference: externalReference,
        description,
      })
      .select()
      .maybeSingle();

    if (insErr) throw badRequest(insErr.message);

    await syncEmpresaMaxMeiFromLines(adminClient, empresaId, { force: true });
    await activateEmpresaMeiAccessAfterPayment(adminClient, empresaId);

    return {
      line: row,
      checkoutUrl: null,
      billingTiming: "next_cycle",
      pricing,
      stripe: { subscription: updated },
    };
  }

  const existingActiveSubId = await resolveStripeSubscriptionIdForEmpresa(
    adminClient,
    empresaId,
    null,
  );
  if (existingActiveSubId) {
    throw badRequest(
      'Esta empresa já possui assinatura MEI ativa na Stripe. Use billingTiming "next_cycle" para acrescentar vagas (sem novo Checkout).',
    );
  }

  const baseFrontend = String(
    env.FRONTEND_URL || "http://localhost:3000",
  ).replace(/\/$/, "");
  const defaultSuccess = isAdmin && !isSuperadmin
    ? `${baseFrontend}/planos?stripe_mei=success&session_id={CHECKOUT_SESSION_ID}`
    : `${baseFrontend}/admin?stripe_mei=success&session_id={CHECKOUT_SESSION_ID}`;
  const defaultCancel = isAdmin && !isSuperadmin
    ? `${baseFrontend}/planos?stripe_mei=cancel`
    : `${baseFrontend}/admin?stripe_mei=cancel`;
  const successUrl =
    String(input.successUrl || "").trim() || defaultSuccess;
  const cancelUrl =
    String(input.cancelUrl || "").trim() || defaultCancel;

  if (!successUrl.includes("{CHECKOUT_SESSION_ID}")) {
    throw badRequest(
      "successUrl deve conter o placeholder {CHECKOUT_SESSION_ID}",
    );
  }

  const customerId = await ensureEmpresaStripeCustomer(adminClient, empresa);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: empresaId,
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: unitAmount,
          recurring: { interval: "month" },
          product_data: {
            name: description,
            metadata: { mei_slots: String(meiSlots) },
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      empresa_id: empresaId,
      mei_slots: String(meiSlots),
      external_reference: externalReference,
      self_serve: isAdmin && !isSuperadmin ? "1" : "0",
    },
    subscription_data: {
      metadata: {
        empresa_id: empresaId,
        mei_slots: String(meiSlots),
        external_reference: externalReference,
      },
    },
  });

  const { data: row, error: insErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .insert({
      empresa_id: empresaId,
      mei_slots: meiSlots,
      stripe_checkout_session_id: session.id,
      status: "pending",
      value_numeric: pricing.total,
      billing_type: "stripe_checkout",
      external_reference: externalReference,
      description,
    })
    .select()
    .maybeSingle();

  if (insErr) throw badRequest(insErr.message);

  return {
    line: row,
    checkoutUrl: session.url,
    billingTiming: "checkout",
    pricing,
  };
};

export const listSubscriptionLinesForEmpresa = async (
  accessToken,
  empresaId,
) => {
  const requester = await getRequesterContext(accessToken);
  const isSuperadmin = requester.role === "superadmin";
  const isAdmin = requester.role === "admin";
  if (!isSuperadmin && !isAdmin) throw forbidden();

  let id = String(empresaId || "").trim();
  if (isAdmin && !isSuperadmin) {
    id = String(requester.empresaId || "").trim();
  }
  if (!id) throw badRequest("empresaId é obrigatório");

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("*")
    .eq("empresa_id", id)
    .order("created_at", { ascending: false });

  if (error) throw badRequest(error.message);
  return { lines: data || [] };
};

/** Status de cobrança da empresa do requester (gate /planos). */
export const getMeiBillingStatusForRequester = async (accessToken) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role === "superadmin") {
    return { required: false, maxMei: null, hasActiveSubscription: true };
  }
  if (requester.role !== "admin" || !requester.empresaId) {
    return { required: false, maxMei: null, hasActiveSubscription: false };
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const empresaId = String(requester.empresaId);

  const { data: empresa, error } = await adminClient
    .from("empresas")
    .select("id, max_mei")
    .eq("id", empresaId)
    .maybeSingle();

  if (error) throw badRequest(error.message);

  const maxMei = Number(empresa?.max_mei || 0);
  const { data: lines } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .limit(1);

  const hasActiveSubscription = Array.isArray(lines) && lines.length > 0;
  const required = maxMei <= 0 && !hasActiveSubscription;

  return {
    required,
    maxMei,
    hasActiveSubscription,
    empresaId,
    packages: MEI_PUBLIC_PACKAGES,
  };
};

/**
 * Após checkout: grava subscription id e status conforme assinatura na Stripe.
 */
export const finalizeMeiLineFromCheckoutSession = async (session) => {
  const sessionId = String(session?.id || "").trim();
  if (!sessionId) return { updated: false };

  const subRef = session.subscription;
  const subId =
    typeof subRef === "string" ? subRef : subRef?.id ? String(subRef.id) : "";

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: existing, error: findErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, empresa_id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (findErr || !existing?.id) return { updated: false };

  let status = "pending";
  if (subId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subId);
      status = mapStripeSubscriptionStatus(sub.status);
    } catch {
      status = session.payment_status === "paid" ? "active" : "pending";
    }
  } else if (session.payment_status === "paid") {
    status = "active";
  }

  const { error: upErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .update({
      stripe_subscription_id: subId || null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (upErr) throw badRequest(upErr.message);

  await syncEmpresaMaxMeiFromLines(adminClient, existing.empresa_id, {
    force: true,
  });
  if (status === "active") {
    await activateEmpresaMeiAccessAfterPayment(
      adminClient,
      existing.empresa_id,
    );
  }
  return { updated: true, empresaId: existing.empresa_id };
};

/**
 * Atualiza linha pelo id da Subscription Stripe (webhook).
 */
export const touchSubscriptionLineByStripeSubscriptionId = async (
  stripeSubscriptionId,
  patch,
) => {
  const subId = String(stripeSubscriptionId || "").trim();
  if (!subId) return { updated: false };

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: rows, error: findErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, empresa_id")
    .eq("stripe_subscription_id", subId);

  if (findErr || !rows?.length) return { updated: false };

  const ids = rows.map((r) => r.id);
  const empresaId = rows[0].empresa_id;

  const { error: upErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (upErr) throw badRequest(upErr.message);

  await syncEmpresaMaxMeiFromLines(adminClient, empresaId, { force: true });
  if (String(patch?.status || "").toLowerCase() === "active") {
    await activateEmpresaMeiAccessAfterPayment(adminClient, empresaId);
  }
  return { updated: true, empresaId, rowsUpdated: ids.length };
};

export const syncMeiLineFromStripeSubscriptionObject = async (subscription) => {
  const subId = String(subscription?.id || "").trim();
  if (!subId) return { updated: false };

  const status = mapStripeSubscriptionStatus(subscription.status);
  return touchSubscriptionLineByStripeSubscriptionId(subId, { status });
};
