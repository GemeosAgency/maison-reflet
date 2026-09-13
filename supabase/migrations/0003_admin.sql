-- =============================================================================
-- Tour de contrôle (13 septembre 2026) : les événements du site, stockés chez
-- nous sans identité, et le journal des accès à l'administration.
--
-- À coller dans le SQL Editor du dashboard Supabase (le projet n'expose pas
-- automatiquement les nouvelles tables : les GRANT sont explicites).
-- =============================================================================

-- ------------------------------------------------------------ site_events
-- Ce que font les visiteurs sur le site : écoutes des portraits et des
-- recommandations, filtres du guide, carte des six, menu, ajouts au panier,
-- départs en paiement. `anon_id` est un identifiant aléatoire posé par le
-- navigateur (localStorage `mr_anon`), jamais un email ni une adresse IP.
create table if not exists site_events (
  id         bigserial primary key,
  anon_id    text        not null,
  name       text        not null,
  props      jsonb       not null default '{}'::jsonb,
  path       text,
  locale     text        check (locale in ('fr', 'en', 'ar')),
  country    text,
  created_at timestamptz not null default now()
);
create index if not exists site_events_name_idx    on site_events (name, created_at);
create index if not exists site_events_anon_idx    on site_events (anon_id);
create index if not exists site_events_created_idx on site_events (created_at);

comment on table site_events is
  'Événements de navigation anonymes (identifiant aléatoire navigateur). Rétention 13 mois (CNIL, mesure d''audience), purge par /api/admin/retention.';

-- ------------------------------------------------------------ admin_audit
-- Qui a fait quoi dans la tour de contrôle : connexions, lectures de
-- conversations, exports et effacements RGPD, passages de la rétention.
create table if not exists admin_audit (
  id         bigserial primary key,
  actor      text        not null,
  action     text        not null,
  target     text,
  details    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on admin_audit (created_at);

comment on table admin_audit is
  'Journal des accès et actions de l''administration (RGPD : traçabilité des exports et effacements).';

-- ------------------------------------------------------------ sécurité
-- RLS activée sans politique : seules les routes serveur (clé service) lisent
-- et écrivent, jamais le navigateur.
alter table site_events enable row level security;
alter table admin_audit enable row level security;

grant select, insert, update, delete on table site_events, admin_audit to service_role;
grant usage, select on sequence site_events_id_seq, admin_audit_id_seq to service_role;
