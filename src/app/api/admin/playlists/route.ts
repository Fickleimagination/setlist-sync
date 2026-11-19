import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// GET /api/admin/playlists — admin only. Every user's playlists with owner + song count.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const r = await query(
    `SELECT p.playlist_id, p.playlist_name, p.created_at, u.user_id, u.username,
            COUNT(ps.song_id) AS song_count
     FROM Playlists p
     JOIN Users u ON u.user_id = p.user_id
     LEFT JOIN Playlist_Songs ps ON ps.playlist_id = p.playlist_id
     GROUP BY p.playlist_id, u.user_id, u.username
     ORDER BY p.playlist_id`
  );
  return Response.json({ playlists: r.rows });
}
