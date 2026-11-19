import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/history/:id — delete one play. Owner or admin only.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const historyId = Number(id);
  if (!Number.isInteger(historyId)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const r = await query<{ user_id: number }>(`SELECT user_id FROM Listening_History WHERE history_id=$1`, [historyId]);
  if (r.rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  if (r.rows[0].user_id !== user!.userId && user!.role !== "admin") {
    return Response.json({ error: "Not your history" }, { status: 403 });
  }
  await query(`DELETE FROM Listening_History WHERE history_id=$1`, [historyId]);
  return Response.json({ ok: true });
}
