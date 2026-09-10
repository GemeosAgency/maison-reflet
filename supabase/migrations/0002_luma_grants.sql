-- Luma — droits d'accès pour le rôle serveur.
--
-- Le projet Supabase a été créé avec « Automatically expose new tables »
-- désactivé : les tables de 0001_luma.sql n'ont donc AUCUN droit, pas même pour
-- service_role (erreur 42501 « permission denied » via l'API REST, alors que la
-- clé est la bonne). C'est le verrouillage voulu pour anon/authenticated — on
-- n'ouvre volontairement rien à ces deux rôles : RLS est active sans politique,
-- et les visiteurs ne doivent jamais pouvoir lire un transcript. Seul le rôle
-- serveur, utilisé par les routes API, reçoit les droits.
--
-- Idempotent : relançable sans casse.

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.luma_sessions,
  public.luma_messages,
  public.luma_profile_signals,
  public.luma_events
to service_role;

-- Les colonnes bigserial (luma_messages.id, luma_events.id) tirent leur valeur
-- d'une séquence : sans USAGE dessus, un INSERT échoue même avec les droits
-- sur la table.
grant usage, select on sequence
  public.luma_messages_id_seq,
  public.luma_events_id_seq
to service_role;

-- La fonction de rétention est SECURITY DEFINER, mais l'appelant doit quand
-- même avoir le droit de l'exécuter (cron Vercel via RPC).
grant execute on function public.luma_anonymise_old_sessions() to service_role;

-- Pour ne pas retomber dans le même piège à la prochaine migration : toute
-- table ou séquence créée à l'avenir dans public donne ses droits à
-- service_role automatiquement. Toujours rien pour anon/authenticated.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
