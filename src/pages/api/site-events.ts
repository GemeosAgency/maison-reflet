import type { APIRoute } from "astro";
import { adminDb } from "../../lib/admin/db";

export const prerender = false;

/**
 * Les événements de navigation, stockés chez nous (table site_events) pour la
 * tour de contrôle : écoutes, filtres du guide, carte des six, menu, ajouts au
 * panier, départs en paiement. Anonymes — un identifiant aléatoire posé par le
 * navigateur, jamais d'email ni d'adresse IP. Liste blanche de noms, taille
 * bornée, même origine.
 */
const ALLOWED = new Set([
  "page_view",
  "product_view",
  "audio_play",
  "audio_complete",
  "guide_filter",
  "map_select",
  "map_pair",
  "menu_reflet",
  "layering_add",
  "accord_add",
  "add_to_cart",
  "checkout",
  "sample_pick",
]);
const ALLOWED_ORIGINS = new Set(["https://staging.maisonreflet.com", "https://maisonreflet.com", "https://www.maisonreflet.com", "http://localhost:4321"]);
const ANON_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
  const text = await request.text().catch(() => "");
  if (!text || text.length > 4000) return new Response(null, { status: 400 });
  let body: { name?: unknown; props?: unknown; anon?: unknown; path?: unknown; locale?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const anon = typeof body.anon === "string" ? body.anon : "";
  if (!ALLOWED.has(name) || !ANON_RE.test(anon)) return new Response(null, { status: 400 });
  const props = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? (body.props as Record<string, unknown>) : {};
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : null;
  const locale = typeof body.locale === "string" && ["fr", "en", "ar"].includes(body.locale) ? body.locale : null;
  const cookieCountry = request.headers.get("cookie")?.match(/(?:^|;\s*)mr_country=([A-Z]{2})/)?.[1] ?? null;
  const country = cookieCountry ?? request.headers.get("x-vercel-ip-country") ?? null;
  // La ville d'après l'infrastructure (en-tête encodé en URL), jamais l'adresse IP elle-même.
  const rawCity = request.headers.get("x-vercel-ip-city");
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).slice(0, 80) || null;
    } catch {
      city = rawCity.slice(0, 80);
    }
  }
  try {
    const { error } = await adminDb().from("site_events").insert({ anon_id: anon, name, props, path, locale, country, city });
    if (error) console.error("[site-events]", error.message);
  } catch (error) {
    console.error("[site-events]", error);
  }
  return new Response(null, { status: 204 });
};
