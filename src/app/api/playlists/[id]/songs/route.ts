import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const AddSongSchema = z.object({ song_id: z.number().int() });

// POST /api/playlists/:id/songs — append a song to the playlist (owner only).
export async function POST(request: NextRequest, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await ctx.params;
  const playlistId = Number(id);
  if (!Number.isInteger(playlistId)) {
    return Response.json({ error: "Invalid playlist id" }, { status: 400 });
  }

  const owner = await query<{ user_id: number }>(
    `SELECT user_id FROM Playlists WHERE playlist_id = $1`,
    [playlistId]
  );
  if (owner.rows.length === 0) return Response.json({ error: "Playlist not found" }, { status: 404 });
  if (owner.rows[0].user_id !== user!.userId && user!.role !== "admin") {
    return Response.json({ error: "Not your playlist" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AddSongSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const nextPos = await query<{ next: number }>(
      `SELECT COALESCE(MAX(position_order), 0) + 1 AS next FROM Playlist_Songs WHERE playlist_id = $1`,
      [playlistId]
    );
    const result = await query(
      `INSERT INTO Playlist_Songs (playlist_id, song_id, position_order)
       VALUES ($1, $2, $3)
       RETURNING playlist_id, song_id, position_order`,
      [playlistId, parsed.data.song_id, nextPos.rows[0].next]
    );
    return Response.json({ playlistSong: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return Response.json({ error: "Song already in this playlist" }, { status: 409 });
    }
    if (pgErr.code === "23503") {
      return Response.json({ error: "song_id does not reference an existing song" }, { status: 400 });
    }
    throw err;
  }
}
