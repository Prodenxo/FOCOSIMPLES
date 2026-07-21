import dotenv from "dotenv";

dotenv.config();

/**   Easypanel/Docker às vezes guardam o valor com aspas — remove uma camada só se fechar o par. */
export const normalizeEnvSecret = (raw) => {
  let s = String(raw ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
};

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${key}`);
  }
  return value;
};

const requiredInProduction = (key, fallback = "") => {
  const value = process.env[key];
  if (process.env.NODE_ENV === "production" && !value) {
    throw new Error(`Variável de ambiente obrigatória em produção: ${key}`);
  }
  return value || fallback;
};

const DEFAULT_DEV_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];
/** Origens de produto conhecidas (sempre mergeadas, mesmo com CORS_ORIGIN custom). */
const DEFAULT_PRODUCT_CORS_ORIGINS = [
  "https://focomei.com.br",
  "http://focomei.com.br",
  "https://www.focomei.com.br",
  "https://meiinfinito.com.br",
  "https://www.meiinfinito.com.br",
];
const DEFAULT_PROD_CORS_ORIGIN =
  process.env.FRONTEND_URL || "https://focomei.com.br";
const DEFAULT_CORS_ORIGINS =
  process.env.NODE_ENV === "development"
    ? DEFAULT_DEV_CORS_ORIGINS
    : [DEFAULT_PROD_CORS_ORIGIN, ...DEFAULT_DEV_CORS_ORIGINS];

/** Origens típicas do Expo Web para o app mobile em desenvolvimento no navegador. */
const EXPO_WEB_ORIGINS = ["http://localhost:8081", "http://localhost:19006"];

const normalizeOrigin = (s) => (s || "").trim().replace(/\/$/, "");
const baseOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(normalizeOrigin)
  : DEFAULT_CORS_ORIGINS;
const mergedCorsOrigin = [
  ...new Set([
    ...baseOrigins,
    ...DEFAULT_PRODUCT_CORS_ORIGINS,
    ...EXPO_WEB_ORIGINS,
  ]),
]
  .filter(Boolean)
  .join(",");

/** `local` = Auth + Postgres EasyPanel (sem Supabase). Default: `supabase`. */
const AUTH_MODE = String(process.env.AUTH_MODE || "supabase")
  .trim()
  .toLowerCase();
const isLocalAuth = AUTH_MODE === "local";

if (isLocalAuth) {
  required("DATABASE_URL");
  if (
    !normalizeEnvSecret(process.env.AUTH_JWT_SECRET) &&
    !normalizeEnvSecret(process.env.JWT_SECRET)
  ) {
    throw new Error(
      "Com AUTH_MODE=local defina AUTH_JWT_SECRET (ou JWT_SECRET)",
    );
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || "3333",
  CORS_ORIGIN: mergedCorsOrigin,
  AUTH_MODE: isLocalAuth ? "local" : "supabase",
  /** Segredo JWT do Auth local (AUTH_MODE=local). */
  AUTH_JWT_SECRET: normalizeEnvSecret(
    process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || "",
  ),
  JWT_SECRET: normalizeEnvSecret(process.env.JWT_SECRET || ""),
  DATABASE_URL: process.env.DATABASE_URL || "",
  DB_SSL: process.env.DB_SSL || "",
  SUPABASE_URL: isLocalAuth
    ? process.env.SUPABASE_URL || ""
    : required("SUPABASE_URL"),
  SUPABASE_ANON_KEY: isLocalAuth
    ? process.env.SUPABASE_ANON_KEY || ""
    : required("SUPABASE_ANON_KEY"),
  /** JWT Secret do projeto Supabase (Settings → API). Evita round-trip Auth em cada request. */
  SUPABASE_JWT_SECRET: normalizeEnvSecret(
    process.env.SUPABASE_JWT_SECRET ||
      process.env.AUTH_JWT_SECRET ||
      process.env.JWT_SECRET ||
      "",
  ),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  SUPABASE_DB_URL:
    process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "",
  DB_BOOTSTRAP_AUTO_SCHEMA: process.env.DB_BOOTSTRAP_AUTO_SCHEMA || "",
  DB_BOOTSTRAP_FAIL_FAST: process.env.DB_BOOTSTRAP_FAIL_FAST || "",
  DB_BOOTSTRAP_SSL: process.env.DB_BOOTSTRAP_SSL || "",
  /** Garante tabela calendar_checklist_completions no arranque (default true). */
  CALENDAR_CHECKLIST_SCHEMA_ENSURE:
    process.env.CALENDAR_CHECKLIST_SCHEMA_ENSURE || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://focomei.com.br",
  /** focosimples | focomei — política de produto (notas / gates). */
  APP_PRODUCT: String(process.env.APP_PRODUCT || "focosimples").trim().toLowerCase(),
  /** Resend — envio de recuperação de senha (recomendado para Hotmail/Outlook). */
  RESEND_API_KEY: normalizeEnvSecret(process.env.RESEND_API_KEY || ""),
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",
  SERPRO_OAUTH_TOKEN_URL: process.env.SERPRO_OAUTH_TOKEN_URL || "",
  SERPRO_OAUTH_TOKEN_NO_MTLS: process.env.SERPRO_OAUTH_TOKEN_NO_MTLS || "false",
  SERPRO_API_BASE_URL: process.env.SERPRO_API_BASE_URL || "",
  SERPRO_CONSUMER_KEY: process.env.SERPRO_CONSUMER_KEY || "",
  SERPRO_CONSUMER_SECRET: process.env.SERPRO_CONSUMER_SECRET || "",
  SERPRO_ROLE_TYPE: process.env.SERPRO_ROLE_TYPE || "TERCEIROS",
  SERPRO_CERT_PFX_PATH: process.env.SERPRO_CERT_PFX_PATH || "",
  SERPRO_CERT_PFX_PASS: process.env.SERPRO_CERT_PFX_PASS || "",
  SERPRO_CERT_PFX_BASE64: process.env.SERPRO_CERT_PFX_BASE64 || "",
  SERPRO_AUTENTICA_PROCURADOR_URL:
    process.env.SERPRO_AUTENTICA_PROCURADOR_URL || "",
  SERPRO_AUTENTICA_PROCURADOR_PATH:
    process.env.SERPRO_AUTENTICA_PROCURADOR_PATH || "",
  SERPRO_AUTENTICA_PROCURADOR_SIGN_URL:
    process.env.SERPRO_AUTENTICA_PROCURADOR_SIGN_URL || "",
  /** Timeout (ms) do POST para `SERPRO_AUTENTICA_PROCURADOR_SIGN_URL` (assinatura XML). Padrão 45s — undici usa ~10s de connect se não houver signal. */
  SERPRO_AUTENTICA_PROCURADOR_SIGN_TIMEOUT_MS:
    process.env.SERPRO_AUTENTICA_PROCURADOR_SIGN_TIMEOUT_MS || "45000",
  SERPRO_AUTENTICA_PROCURADOR_USE_MTLS:
    process.env.SERPRO_AUTENTICA_PROCURADOR_USE_MTLS || "false",
  SERPRO_AUTENTICA_PROCURADOR_ROLE_TYPE:
    process.env.SERPRO_AUTENTICA_PROCURADOR_ROLE_TYPE || "",
  SERPRO_AUTENTICA_PROCURADOR_BODY_KEY:
    process.env.SERPRO_AUTENTICA_PROCURADOR_BODY_KEY || "termoAutorizacao",
  SERPRO_AUTENTICA_PROCURADOR_XML_TEMPLATE:
    process.env.SERPRO_AUTENTICA_PROCURADOR_XML_TEMPLATE || "",
  SERPRO_CONTRATANTE_NUMERO: process.env.SERPRO_CONTRATANTE_NUMERO || "",
  SERPRO_CONTRATANTE_TIPO: process.env.SERPRO_CONTRATANTE_TIPO || "2",
  /** Razão social do contratante (escritório) no XML do termo — doc SERPRO: destinatario = contratante. */
  SERPRO_CONTRATANTE_NOME: process.env.SERPRO_CONTRATANTE_NOME || "",
  SERPRO_DESTINATARIO_NUMERO: process.env.SERPRO_DESTINATARIO_NUMERO || "",
  SERPRO_DESTINATARIO_NOME: process.env.SERPRO_DESTINATARIO_NOME || "",
  SERPRO_DESTINATARIO_TIPO: process.env.SERPRO_DESTINATARIO_TIPO || "PJ",
  SERPRO_ASSINADO_POR_NOME: process.env.SERPRO_ASSINADO_POR_NOME || "",
  SERPRO_AUTOR_NUMERO: process.env.SERPRO_AUTOR_NUMERO || "",
  SERPRO_AUTOR_TIPO: process.env.SERPRO_AUTOR_TIPO || "",
  SERPRO_AUTORIZACAO_VIGENCIA: process.env.SERPRO_AUTORIZACAO_VIGENCIA || "",
  SERPRO_AUTORIZACAO_VIGENCIA_DIAS:
    process.env.SERPRO_AUTORIZACAO_VIGENCIA_DIAS || "180",
  MEI_API_BASE_URL: process.env.MEI_API_BASE_URL || "",
  MEI_API_TOKEN: process.env.MEI_API_TOKEN || "",
  MEI_API_CREATE_PATH: process.env.MEI_API_CREATE_PATH || "/Consultar",
  MEI_API_DOWNLOAD_PATH:
    process.env.MEI_API_DOWNLOAD_PATH || "/mei-guide/{id}/download",
  MEI_API_PERIODS_PATH: process.env.MEI_API_PERIODS_PATH || "",
  MEI_API_TIMEOUT_MS: process.env.MEI_API_TIMEOUT_MS || "15000",
  MEI_CERT_ENCRYPTION_KEY: process.env.MEI_CERT_ENCRYPTION_KEY || "",
  /** Quando true (padrão), bloqueia certificado cujo CNPJ não seja MEI na Receita. */
  MEI_CERT_ENFORCE_MEI_CNPJ: process.env.MEI_CERT_ENFORCE_MEI_CNPJ || "true",
  PLUGNOTAS_API_BASE_URL: process.env.PLUGNOTAS_API_BASE_URL || "",
  /** Prefixo opcional antes do path (ex.: `/api`). Ver docs Plugnotas e docs/operacao-mei-nfse.md. */
  PLUGNOTAS_API_PATH_PREFIX: process.env.PLUGNOTAS_API_PATH_PREFIX || "",
  PLUGNOTAS_API_KEY: process.env.PLUGNOTAS_API_KEY || "",
  /** `true`: logs extras de diagnóstico Plugnotas (ex.: payload redigido em 400 de cadastro empresa). Ver `docs/operacao-mei-nfse.md`. */
  PLUGNOTAS_DEBUG: process.env.PLUGNOTAS_DEBUG || "",
  /**
   * Diagnóstico da cadeia GET após POST /certificado 409 (`resolverCertificadoIdAposConflito409`): off | error | warn | info | debug.
   * Padrão `warn`. Use `off` se o volume de linhas `[plugnotas] certificado 409 resolve` incomodar.
   */
  PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL:
    process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL || "warn",
  PLUGNOTAS_TIMEOUT_MS: process.env.PLUGNOTAS_TIMEOUT_MS || "15000",
  /**
   * Trilho B (P0): `true` — BFF preenche `nfse.config.prefeitura.codigoIbge` a partir de `endereco.codigoCidade`
   * (7 dígitos) quando `nfse` está activo. **Desligado por defeito** (NFR-P0-REG-01). Ver ADR apenas-NFS-e e `nfsePrefeituraPayload.js`.
   */
  PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE:
    process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE || "false",
  /**
   * DP-PLOGIN-01: `true` — BFF aceita e valida `nfse.config.prefeitura.login` / `senha` no POST/PATCH empresa.
   * **Desligado por defeito** até decisão PO / rollout. O frontend deve usar o mesmo critério via `VITE_*`.
   */
  PLUGNOTAS_NFSE_PREFEITURA_CREDENCIAIS_ENABLED:
    process.env.PLUGNOTAS_NFSE_PREFEITURA_CREDENCIAIS_ENABLED || "false",
  /**
   * DP-PLOGIN-02: `true` — BFF pode bloquear POST/PATCH empresa antes do Plugnotas quando `nfse.config.prefeitura`
   * ficar só com `codigoIbge` e o IBGE estiver em `PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES`.
   * **Desligado por defeito.** Lista vazia ⇒ sem bloqueios (evita falsos positivos globais).
   */
  PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED:
    process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED || "false",
  /** Códigos IBGE (7 dígitos), separados por vírgula — usado só com a flag acima `true`. */
  PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES:
    process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES || "",
  /** Nível de log para diagnóstico HTTP 400 em emissão (requestJson): `error` (padrão) ou `warn`. */
  PLUGNOTAS_EMIT_400_LOG_LEVEL:
    process.env.PLUGNOTAS_EMIT_400_LOG_LEVEL || "error",
  PLUGNOTAS_WEBHOOK_TOKEN: requiredInProduction("PLUGNOTAS_WEBHOOK_TOKEN"),
  PLUGNOTAS_WEBHOOK_REQUIRE_TOKEN:
    process.env.PLUGNOTAS_WEBHOOK_REQUIRE_TOKEN ||
    (process.env.NODE_ENV === "development" ? "false" : "true"),
  PLUGNOTAS_WEBHOOK_ALLOW_QUERY_TOKEN:
    process.env.PLUGNOTAS_WEBHOOK_ALLOW_QUERY_TOKEN || "false",
  PLUGNOTAS_NFSE_CANCEL_PATH:
    process.env.PLUGNOTAS_NFSE_CANCEL_PATH || "/nfse/cancelar/:id",
  PLUGNOTAS_NFE_CANCEL_PATH:
    process.env.PLUGNOTAS_NFE_CANCEL_PATH || "/nfe/:id/cancelamento",
  PLUGNOTAS_NFCE_CANCEL_PATH:
    process.env.PLUGNOTAS_NFCE_CANCEL_PATH || "/nfce/:id/cancelamento",
  N8N_WHATSAPP_WEBHOOK_URL: process.env.N8N_WHATSAPP_WEBHOOK_URL || "",
  N8N_WHATSAPP_WEBHOOK_SECRET: process.env.N8N_WHATSAPP_WEBHOOK_SECRET || "",
  /** Instância Z-API (ID na URL `/instances/{id}/token/...`). */
  ZAPI_INSTANCE_ID: (process.env.ZAPI_INSTANCE_ID || "").trim(),
  /** Token da instância (segmento `token/{...}` na URL Z-API). */
  ZAPI_TOKEN: (process.env.ZAPI_TOKEN || "").trim(),
  /** Header `Client-Token` nos POST de envio (painel Z-API → segurança). */
  ZAPI_CLIENT_TOKEN: (process.env.ZAPI_CLIENT_TOKEN || "").trim(),
  /** Base da API Z-API (opcional). Padrão `https://api.z-api.io`. */
  ZAPI_API_BASE_URL: (process.env.ZAPI_API_BASE_URL || "").trim(),
  /**
   * Canal de saída WhatsApp: `auto` (Z-API se configurada, senão n8n), `zapi`, `n8n`.
   */
  WHATSAPP_OUTBOUND_MODE: (process.env.WHATSAPP_OUTBOUND_MODE || "auto").trim(),
  /**
   * Segredo Bearer (OpenClaw / n8n → POST /api/bot/openclaw/action).
   */
  OPENCLAW_WEBHOOK_SECRET: normalizeEnvSecret(
    process.env.OPENCLAW_WEBHOOK_SECRET ||
      process.env.HERMES_WEBHOOK_SECRET ||
      "",
  ),
  /**
   * `false` desliga validação remetente (só dev local). Produção: omitir ou `true`.
   * Exige header `X-WhatsApp-Sender` = telefone de quem escreve; `phone` no JSON deve coincidir.
   */
  OPENCLAW_ENFORCE_SENDER_PHONE:
    process.env.OPENCLAW_ENFORCE_SENDER_PHONE !== "false",
  /**
   * Token partilhado na URL do webhook Z-API (`?token=`) ou header `Client-Token` / `x-zapi-webhook-token`.
   * Ver `POST /api/webhooks/zapi/inbound`.
   */
  ZAPI_WEBHOOK_TOKEN: (process.env.ZAPI_WEBHOOK_TOKEN || "").trim(),
  /**
   * URL para onde o backend reencaminha mensagens Z-API normalizadas (n8n, OpenClaw HTTP, etc.).
   */
  OPENCLAW_ZAPI_RELAY_URL: (process.env.OPENCLAW_ZAPI_RELAY_URL || "").trim(),
  /** Bearer opcional para o relay (`Authorization: Bearer …`). */
  OPENCLAW_ZAPI_RELAY_SECRET: (
    process.env.OPENCLAW_ZAPI_RELAY_SECRET || ""
  ).trim(),
  /** Timeout ms do POST de relay (1000–60000). Padrão 8000. */
  OPENCLAW_ZAPI_RELAY_TIMEOUT_MS:
    process.env.OPENCLAW_ZAPI_RELAY_TIMEOUT_MS || "8000",
  /**
   * `true`: em saudações curtas (oi, tudo bom…) envia boas-vindas pela Z-API antes do OpenClaw.
   * O `/new` no painel OpenClaw não envia WhatsApp — isto cobre o primeiro contacto no chat.
   */
  WHATSAPP_WELCOME_ENABLED: process.env.WHATSAPP_WELCOME_ENABLED || "true",
  /** Texto opcional (mesma linha WhatsApp: *negrito* com um asterisco). */
  WHATSAPP_WELCOME_MESSAGE: (process.env.WHATSAPP_WELCOME_MESSAGE || "").trim(),
  /** Transcrição de notas de voz Z-API → texto antes do relay OpenClaw. */
  WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED:
    process.env.WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED || "true",
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || "").trim(),
  GROQ_API_KEY: (process.env.GROQ_API_KEY || "").trim(),
  WHATSAPP_TRANSCRIPTION_OPENAI_API_KEY: (
    process.env.WHATSAPP_TRANSCRIPTION_OPENAI_API_KEY || ""
  ).trim(),
  /**
   * `true`: após gerar e guardar o DAS no job mensal/cron, envia WhatsApp (Z-API directo ou n8n)
   * — mesmo payload do admin, `source: mei_das_automatico`. Requer telefone em `user_metadata.phone`.
   */
  MEI_DAS_AUTO_WHATSAPP_ENABLED:
    process.env.MEI_DAS_AUTO_WHATSAPP_ENABLED || "false",
  /**
   * `true`: cron `/api/cron/agenda-lembretes` envia WhatsApp só a utilizadores com compromissos hoje
   * (`n8n_link` + `list_calendar_events`). Requer Z-API outbound ou `N8N_WHATSAPP_WEBHOOK_URL`.
   */
  AGENDA_WHATSAPP_REMINDERS_ENABLED:
    process.env.AGENDA_WHATSAPP_REMINDERS_ENABLED || "false",
  /**
   * `true` (padrão quando lembretes estão on): dispara 07:00 e 21:00 no próprio backend
   * (America/Sao_Paulo) — sem cron-job.org. `false` desliga só o scheduler interno.
   */
  AGENDA_WHATSAPP_SCHEDULER_ENABLED:
    process.env.AGENDA_WHATSAPP_SCHEDULER_ENABLED || "",
  /**
   * `true`: envia WhatsApp ~N min antes de cada compromisso (scheduler 5 min).
   * Padrão: mesmo que AGENDA_WHATSAPP_REMINDERS_ENABLED.
   */
  AGENDA_UPCOMING_WHATSAPP_ENABLED:
    process.env.AGENDA_UPCOMING_WHATSAPP_ENABLED || "",
  /** Minutos antes do início para o lembrete (padrão 30, mín 5, máx 120). */
  AGENDA_UPCOMING_MINUTES_BEFORE:
    process.env.AGENDA_UPCOMING_MINUTES_BEFORE || "30",
  /** Tick do scheduler de lembretes (1–5 min). Padrão: 2. */
  AGENDA_SCHEDULER_INTERVAL_MINUTES:
    process.env.AGENDA_SCHEDULER_INTERVAL_MINUTES || "2",
  /**
   * `true`: após `emit_nfse` pelo OpenClaw, agenda envio do PDF via Z-API (cron
   * `/api/cron/nfse-whatsapp-pending`). Requer Z-API outbound (não usa n8n).
   */
  OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED:
    process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED || "false",
  /**
   * Notificações Z-API: nova solicitação → todos os superadmins (profiles + vínculo);
   * aprovação → solicitante. Requer Z-API outbound.
   */
  ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED:
    process.env.ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED || "false",
  /** Opcional: telefones extra (vírgula), além dos superadmins na BD. */
  ACCESS_REQUEST_NOTIFY_SUPERADMIN_EXTRA_PHONES: (
    process.env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_EXTRA_PHONES ||
    process.env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_PHONE ||
    ""
  ).trim(),
  /** Link do grupo de suporte WhatsApp na mensagem de cadastro aprovado. */
  ACCESS_REQUEST_WHATSAPP_SUPPORT_GROUP_URL: (
    process.env.ACCESS_REQUEST_WHATSAPP_SUPPORT_GROUP_URL || ""
  ).trim(),
  /**
   * URL pública do frontend usada em links de convite (`/register?convite=`).
   * Se vazio, usa `FRONTEND_URL` ou header `Origin` da requisição (fallback dev `http://localhost:3000`).
   */
  INVITE_APP_BASE_URL: (process.env.INVITE_APP_BASE_URL || "").trim(),
  /**
   * Limite por IP por minuto para `GET|POST /invites/validate` (NFR-02 US-INV-02).
   * Padrão 120 em desenvolvimento e 60 caso contrário.
   */
  INVITE_VALIDATE_MAX_PER_MINUTE:
    process.env.INVITE_VALIDATE_MAX_PER_MINUTE ||
    (process.env.NODE_ENV === "development" ? "120" : "60"),
  /** Chave secreta Stripe (`sk_test_...` / `sk_live_...`). Opcional até usar cobrança MEI. */
  STRIPE_SECRET_KEY: (process.env.STRIPE_SECRET_KEY || "").trim(),
  /**
   * Segredo do endpoint de webhook (Dashboard → Webhooks → signing secret).
   * Em produção recomenda-se `STRIPE_WEBHOOK_REQUIRE_SECRET=true` e secret definido.
   */
  STRIPE_WEBHOOK_SECRET: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
  STRIPE_WEBHOOK_REQUIRE_SECRET:
    process.env.STRIPE_WEBHOOK_REQUIRE_SECRET ||
    (process.env.NODE_ENV === "development" ? "false" : "true"),
  /**
   * `true`: soma `mei_slots` das linhas `active` (MEI via Stripe) e grava em `empresas.max_mei` após webhook/checkout.
   * Por defeito `true` para o limite na plataforma acompanhar o contratado na Stripe. Defina `false` para só ajustar limite à mão.
   */
  STRIPE_SYNC_MAX_MEI: process.env.STRIPE_SYNC_MAX_MEI || "true",
};
