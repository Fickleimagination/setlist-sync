import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { query } from "@/lib/db";
import { hashPassword, signSession, SESSION_COOKIE } from "@/lib/auth";

const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { username, email, password } = parsed.data;

  const existing = await query<{ user_id: number }>(
    `SELECT user_id FROM Users WHERE username = $1 OR email = $2`,
    [username, email]
  );
  if (existing.rows.length > 0) {
    return Response.json({ error: "Username or email already in use" }, { status: 409 });
  }

  const password_hash = await hashPassword(password);
  // New accounts are always 'listener' — promotion to 'admin' is a
  // deliberate admin-only action (see /api/users/[id]/role), never self-serve.
  const result = await query<{ user_id: number; username: string; role: string }>(
    `INSERT INTO Users (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'listener')
     RETURNING user_id, username, role`,
    [username, email, password_hash]
  );
  const user = result.rows[0];

  const token = await signSession({
    userId: user.user_id,
    username: user.username,
    role: user.role as "listener" | "admin",
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return Response.json({ userId: user.user_id, username: user.username, role: user.role });
}
