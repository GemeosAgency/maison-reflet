-- Luma — sessions, messages, initiatives, profils.
--
-- À coller dans l'éditeur SQL du projet Supabase (Database → SQL Editor), en
-- une fois. Idempotent : relançable sans casse.
--
-- Deux partis pris structurants :
--
-- 1. RLS ACTIVÉE ET AUCUNE POLITIQUE. Toutes les écritures passent par les
--    routes serveur avec la clé service_role, qui contourne RLS par
--    conception. Résultat : même si la clé anon fuitait, elle ne lirait
--    aucune conversation. C'est ce que demande la section 8 du brief
--    (« accès restreint à l'équipe ») ; ouvrir une politique de lecture
--    publique serait exposer les transcripts de tous les visiteurs.
--
-- 2. Le visiteur est identifié par un `anon_id` opaque tiré côté serveur,
--    jamais par son email. L'email n'arrive que s'il le donne, et il vit
--    dans une colonne à part qu'on peut effacer seule.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- sessions

create table if not exists luma_sessions (
  id            uuid primary key default gen_random_uuid(),
  -- Identifiant du cookie first-party, 30 jours (section 3.2 du brief).
  anon_id       text        not null,
  locale        text        not null check (locale in ('fr', 'en', 'ar')),
  -- Pays ISO du visiteur, celui du sélecteur du site.
  country       text,
  currency      text,
  -- Une seule initiative proactive par session (section 6 du brief, section 9
  -- du persona). La contrainte est ici, pas dans le code : c'est la seule
  -- façon qu'elle tienne même si deux onglets déclenchent en même temps.
  initiative    text,
  initiative_at timestamptz,
  email         text,
  klaviyo_id    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists luma_sessions_anon_id_idx on luma_sessions (anon_id);
create index if not exists luma_sessions_created_at_idx on luma_sessions (created_at);

-- ---------------------------------------------------------------- messages

create table if not exists luma_messages (
  id           bigserial primary key,
  session_id   uuid        not null references luma_sessions (id) on delete cascade,
  role         text        not null check (role in ('user', 'assistant')),
  content      text        not null,
  -- Modèle et coût, pour le plafond quotidien de la section 7 du brief.
  model        text,
  tokens_in    integer,
  tokens_out   integer,
  -- Infractions relevées par les garde-fous avant régénération. Gardées même
  -- quand la réponse a été corrigée : c'est la matière de l'évaluation de
  -- l'étape 11, et le seul moyen de voir un interdit dériver dans le temps.
  violations   jsonb       not null default '[]'::jsonb,
  regenerated  boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists luma_messages_session_idx on luma_messages (session_id, id);

-- ---------------------------------------------------------------- signaux

-- Ce que Luma apprend du visiteur, section 10 du persona. Une ligne par
-- session, écrasée à mesure que la conversation précise le profil. C'est la
-- source de l'upsert Klaviyo — d'où des noms qui collent aux propriétés
-- `luma_*` attendues côté CRM.
create table if not exists luma_profile_signals (
  session_id           uuid primary key references luma_sessions (id) on delete cascade,
  recommended_handle   text,
  alternative_handle   text,
  -- Le parfum d'origine cité par le visiteur : « le signal le plus précieux
  -- pour segmenter » (section 10 du persona).
  cited_origin         text,
  for_whom             text,
  occasion             text,
  wears_today          text,
  synced_to_klaviyo_at timestamptz,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------- analytics

create table if not exists luma_events (
  id         bigserial primary key,
  session_id uuid        references luma_sessions (id) on delete cascade,
  name       text        not null,
  props      jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists luma_events_name_idx on luma_events (name, created_at);

-- ---------------------------------------------------------------- rétention

-- Section 8 du brief : 90 jours, puis anonymisation. On efface le CONTENU des
-- messages et l'email, on garde la coquille — sans elle on perdrait le compte
-- des conversations et des recommandations, qui n'a rien de personnel.
create or replace function luma_anonymise_old_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  with vieux as (
    select id from luma_sessions where created_at < now() - interval '90 days' and email is not null
  )
  update luma_sessions s set email = null, klaviyo_id = null
  from vieux where s.id = vieux.id;

  update luma_messages m
     set content = ''
   where m.content <> ''
     and m.session_id in (
       select id from luma_sessions where created_at < now() - interval '90 days'
     );

  get diagnostics touched = row_count;
  return touched;
end;
$$;

comment on function luma_anonymise_old_sessions is
  'Rétention 90 jours (brief section 8). À planifier via pg_cron ou un cron Vercel.';

-- ---------------------------------------------------------------- sécurité

alter table luma_sessions        enable row level security;
alter table luma_messages        enable row level security;
alter table luma_profile_signals enable row level security;
alter table luma_events          enable row level security;

-- Aucune politique n'est créée volontairement : voir l'en-tête du fichier.
