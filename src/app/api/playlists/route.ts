import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

// GET /api/playlists — the current user's playlists with song counts.
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const result = await query(
    `SELECT p.playlist_id, p.playlist_name, p.created_at, COUNT(ps.song_id) AS song_count
     FROM Playlists p
     LEFT JOIN Playlist_Songs ps ON ps.playlist_id = p.playlist_id
     WHERE p.user_id = $1
     GROUP BY p.playlist_id, p.playlist_name, p.created_at
     ORDER BY p.created_at DESC`,
    [user!.userId]
  );
  return Response.json({ playlists: result.rows });
}

const PlaylistSchema = z.object({ playlist_name: z.string().min(1).max(100) });

// POST /api/playlists — create a playlist owned by the current user.
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = PlaylistSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO Playlists (user_id, playlist_name) VALUES ($1, $2)
     RETURNING playlist_id, playlist_name, created_at`,
    [user!.userId, parsed.data.playlist_name]
  );
  return Response.json({ playlist: result.rows[0] }, { status: 201 });
}
