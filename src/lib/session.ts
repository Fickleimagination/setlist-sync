import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/auth";

/**
 * Reads and verifies the session cookie for the current request.
 * This is the authoritative auth check — called inside every protected
 * route handler directly, not relied on via proxy.ts alone (per Next.js
 * 16 guidance: proxy can be bypassed by Server Functions on unmatched
 * routes, so each handler must verify for itself).
 */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { user, error: null };
}

export async function requireAdmin() {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };
  if (user!.role !== "admin") {
    return { user: null, error: Response.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { user, error: null };
}
