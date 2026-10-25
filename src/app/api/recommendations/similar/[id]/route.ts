import { NextRequest } from "next/server";
import { query } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/recommendations/similar/:id — vector similarity search.
// Finds the songs whose embeddings are closest (cosine distance, pgvector
// `<=>` operator) to the given song's embedding. This is the project's
// vector-paradigm retrieval feature: embeddings live in Song_Embeddings
// (8-dim, derived from audio-feature columns — see src/lib/embeddings.ts),
// and the ivfflat index on that column makes this an indexed ANN search
// rather than a full scan once the catalog grows.
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const songId = Number(id);
  if (!Number.isInteger(songId)) {
    return Response.json({ error: "Invalid song id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 5), 20);

  const target = await query<{ embedding: string }>(
    `SELECT embedding FROM Song_Embeddings WHERE song_id = $1`,
    [songId]
  );
  if (target.rows.length === 0) {
    return Response.json({ error: "Song or its embedding not found" }, { status: 404 });
  }

  const result = await query(
    `SELECT s.song_id, s.title, a.title AS album_title,
            (e.embedding <=> $1) AS distance
     FROM Song_Embeddings e
     JOIN Songs s ON s.song_id = e.song_id
     JOIN Albums a ON a.album_id = s.album_id
     WHERE e.song_id != $2
     ORDER BY e.embedding <=> $1
     LIMIT $3`,
    [target.rows[0].embedding, songId, limit]
  );

  return Response.json({ songId, recommendations: result.rows });
}
