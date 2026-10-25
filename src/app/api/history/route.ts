import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

// GET /api/history — the current user's listening history, most recent first.
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const result = await query(
    `SELECT h.history_id, h.played_at, h.play_duration_seconds,
            s.song_id, s.title, a.title AS album_title
     FROM Listening_History h
     JOIN Songs s ON s.song_id = h.song_id
     JOIN Albums a ON a.album_id = s.album_id
     WHERE h.user_id = $1
     ORDER BY h.played_at DESC
     LIMIT 50`,
    [user!.userId]
  );
  return Response.json({ history: result.rows });
}

const LogSchema = z.object({
  song_id: z.number().int(),
  play_duration_seconds: z.number().int().min(0),
});

// POST /api/history — log a play via the log_listen() stored function
// (demonstrates the Stored Procedures/Functions advanced feature; the
// cross-table "duration can't exceed song length" rule is enforced by the
// fn_validate_play_duration trigger inside that same insert).
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = LogSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await query<{ log_listen: number }>(
      `SELECT log_listen($1, $2, $3) AS log_listen`,
      [user!.userId, parsed.data.song_id, parsed.data.play_duration_seconds]
    );
    return Response.json({ historyId: result.rows[0].log_listen }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { message?: string; code?: string };
    if (pgErr.code === "23503") {
      return Response.json({ error: "song_id does not reference an existing song" }, { status: 400 });
    }
    // Raised by fn_validate_play_duration — surface the trigger's own message.
    return Response.json({ error: pgErr.message ?? "Could not log play" }, { status: 400 });
  }
}
