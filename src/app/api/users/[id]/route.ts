import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const UserPatchSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().max(120).optional(),
  role: z.enum(["listener", "admin"]).optional(),
});

// PUT /api/users/:id — admin only. Edit username / email / role.
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { user: me, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) return Response.json({ error: "Invalid user id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = UserPatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const fields = parsed.data;
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return Response.json({ error: "No fields to update" }, { status: 400 });

  // Stop an admin from locking everyone out by demoting themselves.
  if (fields.role === "listener" && userId === me!.userId) {
    return Response.json({ error: "You can't demote your own account" }, { status: 400 });
  }

  try {
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const result = await query(
      `UPDATE Users SET ${setClause} WHERE user_id = $${keys.length + 1}
       RETURNING user_id, username, email, role`,
      [...keys.map((k) => fields[k]), userId]
    );
    if (result.rows.length === 0) return Response.json({ error: "User not found" }, { status: 404 });
    return Response.json({ user: result.rows[0] });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      return Response.json({ error: "Username or email already in use" }, { status: 409 });
    }
    throw err;
  }
}

// DELETE /api/users/:id — admin only. Cascades to the user's playlists,
// ratings and listening history via the schema's ON DELETE CASCADE.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { user: me, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) return Response.json({ error: "Invalid user id" }, { status: 400 });
  if (userId === me!.userId) {
    return Response.json({ error: "You can't delete your own account" }, { status: 400 });
  }
  const result = await query(`DELETE FROM Users WHERE user_id = $1 RETURNING user_id`, [userId]);
  if (result.rows.length === 0) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json({ ok: true });
}
