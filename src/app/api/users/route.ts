import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// GET /api/users — admin only. All accounts with activity counts
// (LEFT JOIN + GROUP BY). Never returns password hashes.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const result = await query(
    `SELECT u.user_id, u.username, u.email, u.role, u.created_at,
            COUNT(DISTINCT p.playlist_id) AS playlist_count,
            COUNT(DISTINCT r.song_id)     AS rating_count,
            COUNT(DISTINCT h.history_id)  AS play_count
     FROM Users u
     LEFT JOIN Playlists p ON p.user_id = u.user_id
     LEFT JOIN Ratings r ON r.user_id = u.user_id
     LEFT JOIN Listening_History h ON h.user_id = u.user_id
     GROUP BY u.user_id
     ORDER BY u.user_id`
  );
  return Response.json({ users: result.rows });
}
