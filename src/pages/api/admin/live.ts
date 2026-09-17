import type { APIRoute } from "astro";
import { readSession } from "../../../lib/admin/auth";
import { live } from "../../../lib/admin/business";

export const prerender = false;

/** Ce qui se passe maintenant sur le site, pour le globe (/admin/live) — réservé à la session admin. */
export const GET: APIRoute = async ({ cookies, url }) => {
  const admin = await readSession(cookies);
  if (!admin) return new Response(JSON.stringify({ error: "non autorisé" }), { status: 401, headers: { "Content-Type": "application/json" } });
  try {
    const payload = await live(url.searchParams.get("test") === "1");
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin/live]", error);
    return new Response(JSON.stringify({ error: "indisponible" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
