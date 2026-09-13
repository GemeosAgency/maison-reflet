import type { APIRoute } from "astro";
import { readSession } from "../../../lib/admin/auth";
import { audit } from "../../../lib/admin/db";
import { rgpdDelete, rgpdExport } from "../../../lib/admin/data";

export const prerender = false;

/** Droits des personnes : export (JSON téléchargé) ou effacement, sur une adresse ou un identifiant. Tout est journalisé. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const admin = await readSession(cookies);
  if (!admin) return new Response("Non autorisé", { status: 401 });
  const form = await request.formData().catch(() => null);
  const action = String(form?.get("action") ?? "");
  const q = String(form?.get("q") ?? "").trim();
  if (!q) return redirect("/admin/rgpd", 303);

  if (action === "export") {
    const data = await rgpdExport(q);
    await audit(admin.email, "rgpd_export", q, { sessions: data.sessions.length, messages: data.messages.length, site_events: data.siteEvents.length });
    const name = `maison-reflet-export-${q.replace(/[^a-z0-9@._-]/gi, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
    });
  }
  if (action === "delete") {
    const result = await rgpdDelete(q);
    await audit(admin.email, "rgpd_delete", q, result);
    return redirect(`/admin/rgpd?q=${encodeURIComponent(q)}&deleted=${result.sessions}&events=${result.events}`, 303);
  }
  return redirect("/admin/rgpd", 303);
};
