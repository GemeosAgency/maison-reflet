import type { APIRoute } from "astro";
import { clearSessionCookie, readSession } from "../../../lib/admin/auth";
import { audit } from "../../../lib/admin/db";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const admin = await readSession(cookies);
  if (admin) await audit(admin.email, "logout");
  clearSessionCookie(cookies);
  return redirect("/admin/login", 303);
};
