import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

const RatingSchema = z.object({
  song_id: z.number().int(),
  rating_value: z.number().int().min(1).max(5),
});

// POST /api/ratings — rate (or update a rating for) a song. Upsert on the
// composite PK (user_id, song_id) via ON CONFLICT.
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = RatingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await query(
      `INSERT INTO Ratings (user_id, song_id, rating_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, song_id)
       DO UPDATE SET rating_value = EXCLUDED.rating_value, rated_at = CURRENT_TIMESTAMP
       RETURNING user_id, song_id, rating_value, rated_at`,
      [user!.userId, parsed.data.song_id, parsed.data.rating_value]
    );
    return Response.json({ rating: result.rows[0] });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23503") {
      return Response.json({ error: "song_id does not reference an existing song" }, { status: 400 });
    }
    throw err;
  }
}

// GET /api/ratings — the current user's own ratings.
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const r = await query(
    `SELECT r.song_id, s.title, r.rating_value, r.rated_at
     FROM Ratings r JOIN Songs s ON s.song_id = r.song_id
     WHERE r.user_id = $1 ORDER BY r.rated_at DESC`,
    [user!.userId]
  );
  return Response.json({ ratings: r.rows });
}

// DELETE /api/ratings?song_id=&user_id= — remove a rating. A user can delete
// their own; an admin may also pass user_id to delete anyone's.
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const sp = new URL(request.url).searchParams;
  const songId = Number(sp.get("song_id"));
  const target = sp.get("user_id") ? Number(sp.get("user_id")) : user!.userId;
  if (!Number.isInteger(songId) || !Number.isInteger(target)) {
    return Response.json({ error: "song_id is required" }, { status: 400 });
  }
  if (target !== user!.userId && user!.role !== "admin") {
    return Response.json({ error: "Not your rating" }, { status: 403 });
  }
  const r = await query(`DELETE FROM Ratings WHERE user_id=$1 AND song_id=$2 RETURNING song_id`, [target, songId]);
  if (r.rows.length === 0) return Response.json({ error: "Rating not found" }, { status: 404 });
  return Response.json({ ok: true });
}
