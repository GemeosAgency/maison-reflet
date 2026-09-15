-- La tour de contrôle lit les événements Luma par session : sans index, chaque
-- affichage balayait toute la table. Les messages et les signaux avaient déjà
-- le leur, pas les événements.
create index if not exists luma_events_session_idx on luma_events (session_id, id);
