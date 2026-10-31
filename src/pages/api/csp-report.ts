import type { APIRoute } from "astro";

export const prerender = false;

/**
 * Rapports de la Content-Security-Policy, posée en Report-Only dans vercel.json.
 *
 * Rien n'est bloqué : le navigateur signale seulement ce que la politique
 * aurait refusé. Chaque rapport part dans les journaux Vercel (préfixe
 * `[csp]`), le temps de compléter la liste des origines avant de passer la
 * politique en mode bloquant. Ni base, ni cookie, ni adresse IP : la directive,
 * l'URL refusée et la page, rien d'autre.
 *
 * Deux formats coexistent : l'ancien `report-uri` (application/csp-report, un
 * objet) et la Reporting API (application/reports+json, une liste).
 */
const MAX_BYTES = 8000;

const short = (value: unknown, max = 200) => (typeof value === "string" ? value.slice(0, max) : null);

export const POST: APIRoute = async ({ request }) => {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BYTES) return new Response(null, { status: 204 });
  try {
    const body = JSON.parse(text);
    const reports: Record<string, unknown>[] = Array.isArray(body)
      ? body.map((r) => (r && typeof r === "object" ? (r.body ?? {}) : {}))
      : [body?.["csp-report"] ?? {}];
    for (const r of reports.slice(0, 10)) {
      console.warn(
        "[csp]",
        JSON.stringify({
          directive: short(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"], 60),
          blocked: short(r["blocked-uri"] ?? r.blockedURL),
          page: short(r["document-uri"] ?? r.documentURL),
          source: short(r["source-file"] ?? r.sourceFile),
        })
      );
    }
  } catch {
    /* rapport illisible : rien à journaliser */
  }
  return new Response(null, { status: 204 });
};
