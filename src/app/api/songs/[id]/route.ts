import { NextRequest } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { computeEmbedding } from "@/lib/embeddings";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/songs/:id — song detail: album, contributing members/roles,
// derived popularity, average rating, and its stored embedding.
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const songId = Number(id);
  if (!Number.isInteger(songId)) {
    return Response.json({ error: "Invalid song id" }, { status: 400 });
  }

  const song = await query(
    `SELECT s.song_id, s.title, s.duration_seconds, s.track_number, s.genre,
            s.tempo_bpm, s.energy, s.danceability, s.valence,
            a.album_id, a.title AS album_title,
            COALESCE(p.popularity_score, 0) AS popularity_score,
            ROUND(AVG(r.rating_value), 2) AS avg_rating,
            COUNT(DISTINCT r.user_id) AS rating_count
     FROM Songs s
     JOIN Albums a ON a.album_id = s.album_id
     LEFT JOIN Song_Popularity p ON p.song_id = s.song_id
     LEFT JOIN Ratings r ON r.song_id = s.song_id
     WHERE s.song_id = $1
     GROUP BY s.song_id, s.title, s.duration_seconds, s.track_number, s.genre,
              s.tempo_bpm, s.energy, s.danceability, s.valence,
              a.album_id, a.title, p.popularity_score`,
    [songId]
  );
  if (song.rows.length === 0) {
    return Response.json({ error: "Song not found" }, { status: 404 });
  }

  const credits = await query(
    `SELECT m.member_id, m.name, sm.contribution_type
     FROM Song_Members sm
     JOIN Members m ON m.member_id = sm.member_id
     WHERE sm.song_id = $1
     ORDER BY m.name ASC`,
    [songId]
  );

  return Response.json({ song: song.rows[0], credits: credits.rows });
}

const SongPatchSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  track_number: z.number().int().positive().optional(),
  duration_seconds: z.number().int().positive().optional(),
  tempo_bpm: z.number().positive().optional(),
  energy: z.number().min(0).max(1).optional(),
  danceability: z.number().min(0).max(1).optional(),
  valence: z.number().min(0).max(1).optional(),
  genre: z.string().min(1).max(50).optional(),
});

// PUT /api/songs/:id — admin only. Recomputes the embedding whenever an
// audio-feature column changes, keeping the vector in sync with the row.
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const songId = Number(id);
  if (!Number.isInteger(songId)) {
    return Response.json({ error: "Invalid song id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SongPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fields = parsed.data;
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const song = await withTransaction(async (client) => {
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
      const values = keys.map((k) => fields[k]);
      const updated = await client.query(
        `UPDATE Songs SET ${setClause} WHERE song_id = $${keys.length + 1}
         RETURNING song_id, title, album_id, duration_seconds, track_number,
                   tempo_bpm, energy, danceability, valence, genre`,
        [...values, songId]
      );
      if (updated.rows.length === 0) return null;
      const row = updated.rows[0];

      const audioFeatureKeys: (keyof typeof fields)[] = [
        "tempo_bpm", "energy", "danceability", "valence", "duration_seconds", "genre",
      ];
      const touchedAudio = keys.some((k) => audioFeatureKeys.includes(k));
      if (touchedAudio) {
        const vec = computeEmbedding(row);
        await client.query(
          `UPDATE Song_Embeddings SET embedding = $1, updated_at = CURRENT_TIMESTAMP WHERE song_id = $2`,
          [`[${vec.join(",")}]`, row.song_id]
        );
      }
      return row;
    });
    if (!song) return Response.json({ error: "Song not found" }, { status: 404 });
    return Response.json({ song });
  } catch (err) {
    throw err;
  }
}

// DELETE /api/songs/:id — admin only. Cascades to Song_Members,
// Listening_History, Ratings, Playlist_Songs, Song_Embeddings via FK.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const songId = Number(id);
  if (!Number.isInteger(songId)) {
    return Response.json({ error: "Invalid song id" }, { status: 400 });
  }

  const result = await query(`DELETE FROM Songs WHERE song_id = $1 RETURNING song_id`, [songId]);
  if (result.rows.length === 0) {
    return Response.json({ error: "Song not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
