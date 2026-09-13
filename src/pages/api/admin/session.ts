import type { APIRoute } from "astro";
import { emailFromAccessToken, isAllowed, sessionCookieValue, setSessionCookie } from "../../../lib/admin/auth";
import { audit } from "../../../lib/admin/db";

export const prerender = false;

/** Le jeton du lien magique devient une session signée par ce serveur, si l'adresse est sur la liste. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim();
  if (!token) return new Response(JSON.stringify({ ok: false }), { status: 400 });
  const email = await emailFromAccessToken(token);
  if (!email) return new Response(JSON.stringify({ ok: false, error: "expired" }), { status: 401 });
  if (!isAllowed(email)) {
    await audit(email, "login_denied");
    return new Response(JSON.stringify({ ok: false, error: "denied" }), { status: 403 });
  }
  setSessionCookie(cookies, await sessionCookieValue(email), new URL(request.url).protocol === "https:");
  await audit(email, "login", null, { mode: "magic_link" });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
