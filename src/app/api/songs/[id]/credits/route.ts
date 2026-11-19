import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const CreditSchema = z.object({
  member_id: z.number().int(),
  contribution_type: z.string().min(1).max(50),
});

// POST /api/songs/:id/credits — admin only. Add a member credit to a song.
export async function POST(request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const songId = Number(id);
  if (!Number.isInteger(songId)) return Response.json({ error: "Invalid song id" }, { status: 400 });
  const parsed = CreditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const r = await query(
      `INSERT INTO Song_Members (song_id, member_id, contribution_type) VALUES ($1,$2,$3)
       RETURNING song_id, member_id, contribution_type`,
      [songId, parsed.data.member_id, parsed.data.contribution_type]
    );
    return Response.json({ credit: r.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "23505") return Response.json({ error: "That credit already exists" }, { status: 409 });
    if (code === "23503") return Response.json({ error: "Song or member does not exist" }, { status: 400 });
    throw err;
  }
}

// DELETE /api/songs/:id/credits?member_id=&contribution_type= — admin only.
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const songId = Number(id);
  const sp = new URL(request.url).searchParams;
  const memberId = Number(sp.get("member_id"));
  const type = sp.get("contribution_type");
  if (!Number.isInteger(songId) || !Number.isInteger(memberId) || !type) {
    return Response.json({ error: "song id, member_id and contribution_type are required" }, { status: 400 });
  }
  const r = await query(
    `DELETE FROM Song_Members WHERE song_id=$1 AND member_id=$2 AND contribution_type=$3 RETURNING song_id`,
    [songId, memberId, type]
  );
  if (r.rows.length === 0) return Response.json({ error: "Credit not found" }, { status: 404 });
  return Response.json({ ok: true });
}
