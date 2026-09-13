/**
 * Le client Supabase de la tour de contrôle — clé service, côté serveur
 * seulement (les pages /admin et les routes /api/admin ne sont jamais
 * pré-rendues). Même construction que lib/luma/store.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function env(name: string): string | undefined {
  return (typeof process !== "undefined" ? process.env[name] : undefined) ?? (import.meta.env as Record<string, string | undefined>)?.[name];
}

export function adminDb(): SupabaseClient {
  if (client) return client;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante — voir .env.example § Luma.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export function supabaseUrl(): string {
  const url = env("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL manquante.");
  return url.replace(/\/$/, "");
}

export function serviceKey(): string {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante.");
  return key;
}

/** Trace une action d'administration (connexion, lecture, export, effacement, rétention). Ne bloque jamais. */
export async function audit(actor: string, action: string, target: string | null = null, details: Record<string, unknown> = {}): Promise<void> {
  try {
    await adminDb().from("admin_audit").insert({ actor, action, target, details });
  } catch (error) {
    console.error("[admin/audit]", error);
  }
}
