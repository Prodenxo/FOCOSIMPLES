-- Fiscal Engine v3.1 — Phase 8F.5: estoque fiscal inicial (MANUAL_FISCAL_CONFIRMATION)

alter table public.fiscal_stock_lots
  add column if not exists lot_source varchar(32),
  add column if not exists origem_mercadoria_source varchar(32),
  add column if not exists manual_confirmation_json jsonb not null default '{}'::jsonb,
  add column if not exists created_by_user_id uuid;

-- Lotes históricos possuem purchase_item_id NOT NULL — classificar como PURCHASE_XML
update public.fiscal_stock_lots
set lot_source = 'PURCHASE_XML'
where lot_source is null;

alter table public.fiscal_stock_lots
  alter column lot_source set default 'PURCHASE_XML';

alter table public.fiscal_stock_lots
  alter column lot_source set not null;

alter table public.fiscal_stock_lots
  drop constraint if exists fiscal_stock_lots_purchase_item_unique;

alter table public.fiscal_stock_lots
  alter column purchase_item_id drop not null;

create unique index if not exists fiscal_stock_lots_purchase_item_uidx
  on public.fiscal_stock_lots (purchase_item_id)
  where purchase_item_id is not null;

alter table public.fiscal_stock_lots
  drop constraint if exists fiscal_stock_lots_lot_source_check;

alter table public.fiscal_stock_lots
  add constraint fiscal_stock_lots_lot_source_check check (
    lot_source in ('PURCHASE_XML', 'MANUAL_FISCAL_CONFIRMATION')
  );

alter table public.fiscal_stock_lots
  drop constraint if exists fiscal_stock_lots_origem_mercadoria_source_check;

alter table public.fiscal_stock_lots
  add constraint fiscal_stock_lots_origem_mercadoria_source_check check (
    origem_mercadoria_source is null
    or origem_mercadoria_source in (
      'LOT_CONFIRMED',
      'PURCHASE_XML_CONFIRMED',
      'MANUAL_FISCAL_CONFIRMATION',
      'UNKNOWN'
    )
  );

alter table public.fiscal_stock_lots
  drop constraint if exists fiscal_stock_lots_source_item_coherence_check;

alter table public.fiscal_stock_lots
  add constraint fiscal_stock_lots_source_item_coherence_check check (
    (lot_source = 'PURCHASE_XML' and purchase_item_id is not null)
    or (lot_source = 'MANUAL_FISCAL_CONFIRMATION' and purchase_item_id is null)
  );

comment on column public.fiscal_stock_lots.lot_source is
  'Provenance do lote fiscal: PURCHASE_XML ou MANUAL_FISCAL_CONFIRMATION (Phase 8F.5).';

comment on column public.fiscal_stock_lots.origem_mercadoria_source is
  'Fonte fiscal da origem da mercadoria (ORIGEM_FISCAL_SOURCE).';

comment on column public.fiscal_stock_lots.manual_confirmation_json is
  'Metadados auxiliares da confirmação manual pelo contador (note, reason, confirmationRequestId).';

comment on column public.fiscal_stock_lots.created_by_user_id is
  'Actor autenticado que registrou o lote manual — sem FK para auth.users.';
