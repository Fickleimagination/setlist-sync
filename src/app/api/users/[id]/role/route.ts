import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const RoleSchema = z.object({ role: z.enum(["listener", "admin"]) });

// PUT /api/users/:id/role — admin-only role promotion/demotion. This is
// the deliberate, separate action referenced in register/route.ts — new
// accounts can never set their own role.
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) {
    return Response.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RoleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await query(
    `UPDATE Users SET role = $1 WHERE user_id = $2 RETURNING user_id, username, role`,
    [parsed.data.role, userId]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  return Response.json({ user: result.rows[0] });
}
