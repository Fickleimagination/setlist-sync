import { NextRequest } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { embeddingLiteral } from "@/lib/embeddings";

// GET /api/songs?album=&genre=&search= — list songs with optional filters,
// joined to album title and the derived popularity view.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const album = searchParams.get("album");
  const genre = searchParams.get("genre");
  const search = searchParams.get("search");

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (album) {
    values.push(Number(album));
    conditions.push(`s.album_id = $${values.length}`);
  }
  if (genre) {
    values.push(genre);
    conditions.push(`s.genre = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`s.title ILIKE $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT s.song_id, s.title, s.duration_seconds, s.track_number, s.genre,
            s.tempo_bpm, s.energy, s.danceability, s.valence,
            a.album_id, a.title AS album_title,
            COALESCE(p.popularity_score, 0) AS popularity_score,
            ROUND(AVG(r.rating_value), 2) AS avg_rating
     FROM Songs s
     JOIN Albums a ON a.album_id = s.album_id
     LEFT JOIN Song_Popularity p ON p.song_id = s.song_id
     LEFT JOIN Ratings r ON r.song_id = s.song_id
     ${where}
     GROUP BY s.song_id, s.title, s.duration_seconds, s.track_number, s.genre,
              s.tempo_bpm, s.energy, s.danceability, s.valence,
              a.album_id, a.title, p.popularity_score
     ORDER BY s.title ASC`,
    values
  );
  return Response.json({ songs: result.rows });
}

const SongSchema = z.object({
  title: z.string().min(1).max(150),
  album_id: z.number().int(),
  duration_seconds: z.number().int().positive(),
  track_number: z.number().int().positive(),
  tempo_bpm: z.number().positive(),
  energy: z.number().min(0).max(1),
  danceability: z.number().min(0).max(1),
  valence: z.number().min(0).max(1),
  genre: z.string().min(1).max(50),
});

// POST /api/songs — admin only. Inserts the song row and its vector
// embedding in one transaction (Transactions advanced feature).
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = SongSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const song = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO Songs (title, album_id, duration_seconds, track_number,
                             tempo_bpm, energy, danceability, valence, genre)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING song_id, title, album_id, duration_seconds, track_number,
                   tempo_bpm, energy, danceability, valence, genre`,
        [
          data.title, data.album_id, data.duration_seconds, data.track_number,
          data.tempo_bpm, data.energy, data.danceability, data.valence, data.genre,
        ]
      );
      const row = inserted.rows[0];
      await client.query(
        `INSERT INTO Song_Embeddings (song_id, embedding) VALUES ($1, $2)`,
        [row.song_id, embeddingLiteral(data)]
      );
      return row;
    });
    return Response.json({ song }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23503") {
      return Response.json({ error: "album_id does not reference an existing album" }, { status: 400 });
    }
    throw err;
  }
}
