-- =============================================================================
-- « Tout ce qui est fait sur staging va dans Test, même le trafic, comme ça on
-- ne pollue pas » (Sandro, 14 septembre 2026).
--
-- Une colonne `test` sur les deux tables qui reçoivent du trafic : elle vaut
-- vrai quand l'événement ou la conversation vient d'un environnement qui n'est
-- pas le site de production (staging, previews Vercel, localhost). La tour de
-- contrôle les écarte par défaut et les montre quand on coche « données de
-- test ». Les commandes ont déjà leur propre `test` (Shopify) ; le webhook y
-- ajoute celles dont le panier a été créé hors production (attribut mr_env).
-- =============================================================================
alter table site_events   add column if not exists test boolean not null default false;
alter table luma_sessions add column if not exists test boolean not null default false;

create index if not exists site_events_test_idx   on site_events (test, created_at);
create index if not exists luma_sessions_test_idx on luma_sessions (test, created_at);

comment on column site_events.test is 'Vrai si l''événement vient de staging, d''une preview ou de localhost : écarté des chiffres par défaut.';
comment on column luma_sessions.test is 'Vrai si la conversation vient de staging, d''une preview ou de localhost : écartée des chiffres par défaut.';
