import type { APIRoute } from "astro";
import { readSession } from "../../../lib/admin/auth";
import { adminPret, modeAdmin, porteesAdmin } from "../../../lib/shopify-admin";

export const prerender = false;

/**
 * Diagnostic de l'accès Admin API (avoir du coffret), réservé à la session
 * admin : Shopify accepte-t-il les identifiants, et l'app a-t-elle le droit de
 * créer des codes de réduction. Ne renvoie jamais le token.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!(await readSession(cookies))) return json({ error: "non autorisé" }, 401);
  if (!adminPret()) return json({ ok: false, raison: "aucun accès Admin configuré (SHOPIFY_ADMIN_CLIENT_ID/SECRET ou SHOPIFY_ADMIN_TOKEN)" });
  const portees = await porteesAdmin();
  if (!portees) return json({ ok: false, mode: modeAdmin(), raison: "Shopify a refusé l'accès (détail dans les logs Vercel [shopify-admin])" });
  const manque = ["write_discounts", "read_products", "read_orders"].filter((p) => !portees.includes(p));
  return json({ ok: manque.length === 0, mode: modeAdmin(), peutCreerLesAvoirs: portees.includes("write_discounts"), porteesManquantes: manque, portees });
};
