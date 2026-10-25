import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; songId: string }> };

// DELETE /api/playlists/:id/songs/:songId — remove a song (owner or admin only).
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id, songId } = await ctx.params;
  const playlistId = Number(id);
  const songIdNum = Number(songId);
  if (!Number.isInteger(playlistId) || !Number.isInteger(songIdNum)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const owner = await query<{ user_id: number }>(
    `SELECT user_id FROM Playlists WHERE playlist_id = $1`,
    [playlistId]
  );
  if (owner.rows.length === 0) return Response.json({ error: "Playlist not found" }, { status: 404 });
  if (owner.rows[0].user_id !== user!.userId && user!.role !== "admin") {
    return Response.json({ error: "Not your playlist" }, { status: 403 });
  }

  const result = await query(
    `DELETE FROM Playlist_Songs WHERE playlist_id = $1 AND song_id = $2 RETURNING playlist_id`,
    [playlistId, songIdNum]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "Song not in this playlist" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
