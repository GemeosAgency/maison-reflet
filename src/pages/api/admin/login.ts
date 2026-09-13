import type { APIRoute } from "astro";
import { isAllowed, sendMagicLink } from "../../../lib/admin/auth";
import { audit } from "../../../lib/admin/db";

export const prerender = false;

/** Formulaire de connexion : envoie le lien magique si l'adresse est autorisée. Répond pareil dans les deux cas. */
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();
  if (!email) return redirect("/admin/login", 303);
  if (isAllowed(email)) {
    const ok = await sendMagicLink(email, `${new URL(request.url).origin}/admin/callback`);
    await audit(email, ok ? "magic_link_sent" : "magic_link_failed");
    if (!ok) return redirect("/admin/login?error=send", 303);
  } else {
    await audit(email, "login_denied");
  }
  return redirect("/admin/login?sent=1", 303);
};
