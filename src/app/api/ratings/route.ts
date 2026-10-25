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
