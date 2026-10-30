import type { APIRoute } from "astro";
import { readSession } from "../../../lib/admin/auth";
import { adminPret, jetonAdmin } from "../../../lib/shopify-admin";

export const prerender = false;

/**
 * Diagnostic de l'accès Admin API (avoir du coffret) — réservé à la session
 * admin. Dit si un token s'obtient et s'il porte le droit de créer des codes
 * de réduction ; ne renvoie jamais le token lui-même.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const admin = await readSession(cookies);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!admin) return json({ error: "non autorisé" }, 401);
  if (!adminPret()) return json({ ok: false, raison: "aucun identifiant Admin configuré" });
  const jeton = await jetonAdmin(true);
  if (!jeton) return json({ ok: false, raison: "Shopify a refusé l'échange (voir les logs [shopify-admin])" });
  return json({
    ok: true,
    mode: jeton.mode,
    scopes: jeton.scopes,
    peutCreerLesAvoirs: jeton.mode === "permanent" ? "non vérifiable (token permanent)" : jeton.scopes.includes("write_discounts"),
  });
};
