import { query } from "@/lib/db";
import { requireUser } from "@/lib/session";

// GET /api/recommendations/for-you — personalized vector recommendations.
// Builds a "taste vector" by averaging the embeddings of songs the current
// user rated 4+ or has listened to, then runs a cosine-distance nearest-
// neighbor search against every OTHER song's embedding, excluding songs
// already heard/rated. Demonstrates the vector paradigm doing something a
// plain SQL aggregate query can't: similarity in a learned/engineered
// feature space rather than exact-match filtering.
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const liked = await query<{ song_id: number }>(
    `SELECT DISTINCT song_id FROM (
       SELECT song_id FROM Ratings WHERE user_id = $1 AND rating_value >= 4
       UNION
       SELECT song_id FROM Listening_History WHERE user_id = $1
     ) AS heard`,
    [user!.userId]
  );

  if (liked.rows.length === 0) {
    return Response.json({
      recommendations: [],
      message: "Listen to or rate some songs first to get personalized recommendations.",
    });
  }

  const heardIds = liked.rows.map((r) => r.song_id);

  // pgvector has no native "average these N vectors" SQL aggregate, so the
  // taste vector is computed with plain SQL AVG() over each unnested
  // dimension, then re-assembled into a vector literal for the <=> search.
  const centroid = await query<{ centroid: string }>(
    `SELECT '[' || string_agg(avg_dim::text, ',') || ']' AS centroid
     FROM (
       SELECT dim_index, AVG(dim_value) AS avg_dim
       FROM Song_Embeddings e, unnest(e.embedding::float4[]) WITH ORDINALITY AS u(dim_value, dim_index)
       WHERE e.song_id = ANY($1)
       GROUP BY dim_index
       ORDER BY dim_index
     ) sub`,
    [heardIds]
  );

  const result = await query(
    `SELECT s.song_id, s.title, a.title AS album_title,
            (e.embedding <=> $1) AS distance
     FROM Song_Embeddings e
     JOIN Songs s ON s.song_id = e.song_id
     JOIN Albums a ON a.album_id = s.album_id
     WHERE NOT (e.song_id = ANY($2))
     ORDER BY e.embedding <=> $1
     LIMIT 5`,
    [centroid.rows[0].centroid, heardIds]
  );

  return Response.json({ recommendations: result.rows });
}
