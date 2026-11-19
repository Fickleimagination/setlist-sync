import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// GET /api/admin/ratings — admin only. All ratings with user + song names.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const r = await query(
    `SELECT r.user_id, u.username, r.song_id, s.title, r.rating_value, r.rated_at
     FROM Ratings r JOIN Users u ON u.user_id=r.user_id JOIN Songs s ON s.song_id=r.song_id
     ORDER BY r.rated_at DESC`
  );
  return Response.json({ ratings: r.rows });
}
