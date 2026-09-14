-- =============================================================================
-- Tour de contrôle (14 septembre 2026) : le chiffre net, la ville, le paiement.
--  - shop_orders.refunds       : remboursements reçus par le webhook refunds/create,
--                                [{id, amount, at}] — le chiffre net = total − somme.
--  - shop_orders.cancelled_at  : posé par le webhook orders/cancelled ; la commande
--                                sort du chiffre et du compte.
--  - shop_orders.gateway       : le(s) mode(s) de paiement Shopify (payment_gateway_names).
--  - site_events.city          : la ville d'après l'en-tête x-vercel-ip-city (jamais l'IP).
-- =============================================================================
alter table shop_orders
  add column if not exists refunds      jsonb not null default '[]'::jsonb,
  add column if not exists cancelled_at timestamptz,
  add column if not exists gateway      text;

alter table site_events
  add column if not exists city text;

comment on column shop_orders.refunds is 'Remboursements (webhook refunds/create) : [{id, amount, at}]. Chiffre net = total − somme des montants.';
comment on column shop_orders.cancelled_at is 'Annulation (webhook orders/cancelled) : la commande est écartée du chiffre.';
comment on column shop_orders.gateway is 'Mode(s) de paiement Shopify, séparés par une virgule (Shop Pay, carte, Tabby…).';
comment on column site_events.city is 'Ville d''après x-vercel-ip-city, décodée ; pas d''adresse IP.';
