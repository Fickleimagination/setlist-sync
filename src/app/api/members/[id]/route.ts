import { NextRequest } from "next/server";
import { query } from "@/lib/db";

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
