import type { APIRoute } from "astro";
import { adminDb, audit } from "../../../lib/admin/db";

export const prerender = false;

/**
 * Rétention, lancée chaque nuit par le cron Vercel (vercel.json) :
 *  - Luma : au-delà de 90 jours, le contenu des messages et l'email sont
 *    effacés (fonction SQL luma_anonymise_old_sessions, brief section 8) ;
 *  - site : les événements de navigation de plus de 13 mois sont supprimés
 *    (durée maximale admise pour la mesure d'audience).
 * Vercel envoie `Authorization: Bearer <CRON_SECRET>` ; sans ce secret posé
 * dans l'environnement, la route refuse tout.
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
  if (!secret) return new Response(JSON.stringify({ ok: false, error: "CRON_SECRET manquant : rétention non planifiable." }), { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response(JSON.stringify({ ok: false }), { status: 401 });

  const db = adminDb();
  const { data: touched, error } = await db.rpc("luma_anonymise_old_sessions");
  if (error) {
    await audit("cron", "retention_failed", null, { error: error.message });
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
  let siteDeleted = 0;
  try {
    const limit = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
    const { count } = await db.from("site_events").delete({ count: "exact" }).lt("created_at", limit);
    siteDeleted = count ?? 0;
  } catch {
    siteDeleted = 0;
  }
  await audit("cron", "retention", null, { luma_messages_anonymised: touched ?? 0, site_events_deleted: siteDeleted });
  return new Response(JSON.stringify({ ok: true, luma_messages_anonymised: touched ?? 0, site_events_deleted: siteDeleted }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
