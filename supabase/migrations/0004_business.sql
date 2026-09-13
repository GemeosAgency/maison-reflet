-- =============================================================================
-- Tour de contrôle, volet business (13 septembre 2026) : les commandes payées,
-- posées par le webhook Shopify orders/paid (src/pages/api/webhooks/shopify-orders.ts).
-- Aucune donnée personnelle : ni email, ni nom, ni adresse — le pays, les lignes,
-- les montants, la source, et l'identifiant anonyme du parcours (mr_anon).
-- =============================================================================
create table if not exists shop_orders (
  id               bigint primary key,           -- id Shopify de la commande
  name             text,                          -- « #1001 »
  created_at       timestamptz not null,
  processed_at     timestamptz,
  test             boolean not null default false,
  financial_status text,
  currency         text,
  total            numeric(12, 2) not null default 0,
  subtotal         numeric(12, 2) not null default 0,
  discounts        numeric(12, 2) not null default 0,
  shipping         numeric(12, 2) not null default 0,
  country          text,
  locale           text,
  source_name      text,                          -- web, shop_app, pos…
  referring_site   text,                          -- hôte du referrer Shopify
  landing_site     text,                          -- première page (avec utm)
  discount_codes   text[] not null default '{}',
  lines            jsonb not null default '[]'::jsonb, -- [{variant_id, product_id, title, quantity, price, total}]
  anon_id          text,                          -- attribut de panier mr_anon → parcours site_events
  ga_client        text,
  received_at      timestamptz not null default now()
);
create index if not exists shop_orders_created_idx on shop_orders (created_at);
create index if not exists shop_orders_anon_idx    on shop_orders (anon_id);

comment on table shop_orders is
  'Commandes payées (webhook Shopify orders/paid), sans donnée personnelle. Sert la tour de contrôle : CA, panier moyen, conversion, par Reflet, sources.';

alter table shop_orders enable row level security;
grant select, insert, update, delete on table shop_orders to service_role;
