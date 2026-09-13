/**
 * L'accès à la tour de contrôle.
 *
 * Deux adresses autorisées (ADMIN_EMAILS, virgules ; défaut : Sandro), un
 * lien magique envoyé par Supabase Auth, puis un cookie de session signé par
 * ce serveur (HMAC, 7 jours) : `mr_admin`. Aucun mot de passe, rien côté
 * navigateur à part le cookie httpOnly. Le lien magique exige que l'URL de
 * retour `/admin/callback` soit autorisée dans Supabase → Authentication →
 * URL Configuration (Redirect URLs).
 */
import type { AstroCookies } from "astro";
import { supabaseUrl, serviceKey } from "./db";

export const ADMIN_COOKIE = "mr_admin";
const SESSION_DAYS = 7;
const encoder = new TextEncoder();

function env(name: string): string | undefined {
  return (typeof process !== "undefined" ? process.env[name] : undefined) ?? (import.meta.env as Record<string, string | undefined>)?.[name];
}

export function allowedEmails(): string[] {
  const raw = env("ADMIN_EMAILS") ?? "sandro.dasilva@gemeosagency.com";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function isAllowed(email: string | null | undefined): boolean {
  return Boolean(email) && allowedEmails().includes(email!.trim().toLowerCase());
}

function secret(): string {
  const s = env("ADMIN_SESSION_SECRET") ?? env("LUMA_VOICE_SECRET") ?? env("SUPABASE_SERVICE_ROLE_KEY");
  if (!s) throw new Error("ADMIN_SESSION_SECRET (ou SUPABASE_SERVICE_ROLE_KEY) manquante : impossible de signer la session.");
  return s;
}
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(input: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input))));
}

export type Admin = { email: string; expires: number };

/** Fabrique la valeur du cookie de session : email et expiration, signés. */
export async function sessionCookieValue(email: string): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${email.toLowerCase()}|${expires}`;
  return `${b64url(encoder.encode(payload))}.${await hmac(payload)}`;
}

export async function readSession(cookies: AstroCookies): Promise<Admin | null> {
  const raw = cookies.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  const [payloadB64, sig] = raw.split(".");
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try {
    const b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    payload = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  if ((await hmac(payload)) !== sig) return null;
  const [email, exp] = payload.split("|");
  const expires = Number(exp);
  if (!email || !Number.isFinite(expires) || expires < Date.now() || !isAllowed(email)) return null;
  return { email, expires };
}

export function setSessionCookie(cookies: AstroCookies, value: string, secure: boolean): void {
  cookies.set(ADMIN_COOKIE, value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}
export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(ADMIN_COOKIE, { path: "/" });
}

/** Demande à Supabase Auth d'envoyer le lien magique. Ne révèle jamais si l'adresse existe. */
export async function sendMagicLink(email: string, redirectTo: string): Promise<boolean> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) console.error("[admin/auth] otp", res.status, (await res.text().catch(() => "")).slice(0, 300));
  return res.ok;
}

/** Vérifie le jeton renvoyé par le lien magique et rend l'adresse qu'il porte. */
export async function emailFromAccessToken(token: string): Promise<string | null> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: serviceKey(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { email?: string } | null;
  return data?.email?.toLowerCase() ?? null;
}
