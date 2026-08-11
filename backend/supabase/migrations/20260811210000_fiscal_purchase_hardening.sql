-- Fiscal Engine v3.1 — Fase 2 hardening: autenticidade, status documental, unidade estoque

alter table public.fiscal_purchase_invoices
  add column if not exists authorization_status varchar(20) not null default 'UNKNOWN',
  add column if not exists event_status varchar(24) not null default 'NOT_CHECKED',
  add column if not exists signature_status varchar(16) not null default 'UNVERIFIED';

alter table public.fiscal_purchase_invoices
  drop constraint if exists fiscal_purchase_invoices_authorization_status_check;

alter table public.fiscal_purchase_invoices
  add constraint fiscal_purchase_invoices_authorization_status_check check (
    authorization_status in ('AUTHORIZED', 'NOT_AUTHORIZED', 'UNKNOWN')
  );

alter table public.fiscal_purchase_invoices
  drop constraint if exists fiscal_purchase_invoices_event_status_check;

alter table public.fiscal_purchase_invoices
  add constraint fiscal_purchase_invoices_event_status_check check (
    event_status in ('NOT_CHECKED', 'CANCELED', 'ACTIVE_AS_OF_CHECK', 'UNKNOWN')
  );

alter table public.fiscal_purchase_invoices
  drop constraint if exists fiscal_purchase_invoices_signature_status_check;

alter table public.fiscal_purchase_invoices
  add constraint fiscal_purchase_invoices_signature_status_check check (
    signature_status in ('VALID', 'INVALID', 'UNVERIFIED')
  );

alter table public.fiscal_purchase_items
  add column if not exists stock_unit_resolution_json jsonb not null default '{}'::jsonb;

alter table public.fiscal_stock_lots
  add column if not exists stock_unit_resolution_json jsonb not null default '{}'::jsonb;

comment on column public.fiscal_purchase_invoices.authorization_status is
  'Autorização SEFAZ no momento da importação — não implica ausência de cancelamento posterior.';
comment on column public.fiscal_purchase_invoices.event_status is
  'Status de eventos (cancelamento etc.) — NOT_CHECKED até ingestão de procEventoNFe.';
comment on column public.fiscal_purchase_invoices.signature_status is
  'Validação criptográfica da assinatura XML — distinto do SHA-256 do arquivo.';
