import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// GET /api/admin/history — admin only. Latest 200 plays across all users.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const r = await query(
    `SELECT h.history_id, u.username, s.title, h.played_at, h.play_duration_seconds
     FROM Listening_History h JOIN Users u ON u.user_id=h.user_id JOIN Songs s ON s.song_id=h.song_id
     ORDER BY h.played_at DESC LIMIT 200`
  );
  return Response.json({ history: r.rows });
}
