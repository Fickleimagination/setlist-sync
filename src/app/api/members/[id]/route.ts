import { NextRequest } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/members/:id — member detail + every song they contributed to.
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) {
    return Response.json({ error: "Invalid member id" }, { status: 400 });
  }

  const member = await query(
    `SELECT m.member_id, m.name, array_agg(DISTINCT mr.role ORDER BY mr.role) AS roles
     FROM Members m
     LEFT JOIN Member_Roles mr ON mr.member_id = m.member_id
     WHERE m.member_id = $1
     GROUP BY m.member_id, m.name`,
    [memberId]
  );
  if (member.rows.length === 0) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  const songs = await query(
    `SELECT s.song_id, s.title, sm.contribution_type, a.title AS album_title
     FROM Song_Members sm
     JOIN Songs s ON s.song_id = sm.song_id
     JOIN Albums a ON a.album_id = s.album_id
     WHERE sm.member_id = $1
     ORDER BY a.release_date ASC, s.track_number ASC`,
    [memberId]
  );

  return Response.json({ member: member.rows[0], songs: songs.rows });
}

const MemberPatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  roles: z.array(z.string().min(1).max(50)).optional(),
});

// PUT /api/members/:id — admin only. Rename and/or replace the role set
// (delete + re-insert Member_Roles) atomically.
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) return Response.json({ error: "Invalid member id" }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = MemberPatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, roles } = parsed.data;
  if (name === undefined && roles === undefined) return Response.json({ error: "No fields to update" }, { status: 400 });

  const member = await withTransaction(async (client) => {
    const exists = await client.query(`SELECT member_id FROM Members WHERE member_id = $1`, [memberId]);
    if (exists.rows.length === 0) return null;
    if (name !== undefined) await client.query(`UPDATE Members SET name = $1 WHERE member_id = $2`, [name, memberId]);
    if (roles !== undefined) {
      await client.query(`DELETE FROM Member_Roles WHERE member_id = $1`, [memberId]);
      for (const role of new Set(roles)) {
        await client.query(`INSERT INTO Member_Roles (member_id, role) VALUES ($1, $2)`, [memberId, role]);
      }
    }
    return (await client.query(`SELECT member_id, name FROM Members WHERE member_id = $1`, [memberId])).rows[0];
  });
  if (!member) return Response.json({ error: "Member not found" }, { status: 404 });
  return Response.json({ member });
}

// DELETE /api/members/:id — admin only. Cascades to Member_Roles and Song_Members.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) return Response.json({ error: "Invalid member id" }, { status: 400 });
  const result = await query(`DELETE FROM Members WHERE member_id = $1 RETURNING member_id`, [memberId]);
  if (result.rows.length === 0) return Response.json({ error: "Member not found" }, { status: 404 });
  return Response.json({ ok: true });
}
