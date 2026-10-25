import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { query } from "@/lib/db";
import { verifyPassword, signSession, SESSION_COOKIE } from "@/lib/auth";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Username and password are required" }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const result = await query<{
    user_id: number;
    username: string;
    password_hash: string;
    role: string;
  }>(`SELECT user_id, username, password_hash, role FROM Users WHERE username = $1`, [username]);

  const user = result.rows[0];
  // Same generic error whether the username doesn't exist or the password
  // is wrong — avoids leaking which usernames are registered.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

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
