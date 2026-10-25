import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function assertOwnership(playlistId: number, userId: number, role: string) {
  const result = await query<{ user_id: number }>(
    `SELECT user_id FROM Playlists WHERE playlist_id = $1`,
    [playlistId]
  );
  if (result.rows.length === 0) return "not_found" as const;
  if (result.rows[0].user_id !== userId && role !== "admin") return "forbidden" as const;
  return "ok" as const;
}

// GET /api/playlists/:id — playlist detail with ordered songs. Owner or admin only.
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await ctx.params;
  const playlistId = Number(id);
  if (!Number.isInteger(playlistId)) {
    return Response.json({ error: "Invalid playlist id" }, { status: 400 });
  }

  const check = await assertOwnership(playlistId, user!.userId, user!.role);
  if (check === "not_found") return Response.json({ error: "Playlist not found" }, { status: 404 });
  if (check === "forbidden") return Response.json({ error: "Not your playlist" }, { status: 403 });

  const playlist = await query(
    `SELECT playlist_id, playlist_name, created_at FROM Playlists WHERE playlist_id = $1`,
    [playlistId]
  );
  const songs = await query(
    `SELECT s.song_id, s.title, a.title AS album_title, ps.position_order
     FROM Playlist_Songs ps
     JOIN Songs s ON s.song_id = ps.song_id
     JOIN Albums a ON a.album_id = s.album_id
     WHERE ps.playlist_id = $1
     ORDER BY ps.position_order ASC`,
    [playlistId]
  );

  return Response.json({ playlist: playlist.rows[0], songs: songs.rows });
}

// DELETE /api/playlists/:id — owner or admin only. Cascades to Playlist_Songs.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await ctx.params;
  const playlistId = Number(id);
  if (!Number.isInteger(playlistId)) {
    return Response.json({ error: "Invalid playlist id" }, { status: 400 });
  }

  const check = await assertOwnership(playlistId, user!.userId, user!.role);
  if (check === "not_found") return Response.json({ error: "Playlist not found" }, { status: 404 });
  if (check === "forbidden") return Response.json({ error: "Not your playlist" }, { status: 403 });

  await query(`DELETE FROM Playlists WHERE playlist_id = $1`, [playlistId]);
  return Response.json({ ok: true });
}
