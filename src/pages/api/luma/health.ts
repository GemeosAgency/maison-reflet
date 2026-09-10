import type { APIRoute } from "astro";

export const prerender = false;

/**
 * État de Luma sans rien appeler : la présence des clés suffit à dire si la
 * fonction PEUT répondre. Aucune valeur ne sort, seulement des booléens.
 */
export const GET: APIRoute = () => {
  const has = (v: unknown) => Boolean(v && String(v).trim());
  const checks = {
    anthropic: has(import.meta.env.ANTHROPIC_API_KEY),
    supabase: has(import.meta.env.SUPABASE_URL) && has(import.meta.env.SUPABASE_SERVICE_ROLE_KEY),
    sanity: has(import.meta.env.SANITY_PROJECT_ID),
    shopify: has(import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN) && has(import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN),
  };
  const ok = Object.values(checks).every(Boolean);
  return new Response(JSON.stringify({ ok, checks }), {
    status: ok ? 200 : 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
