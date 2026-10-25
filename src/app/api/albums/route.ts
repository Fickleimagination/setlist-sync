import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// GET /api/albums — list all albums with song counts (JOIN + GROUP BY).
export async function GET() {
  const result = await query(
    `SELECT a.album_id, a.title, a.release_date, a.album_type,
            COUNT(s.song_id) AS song_count
     FROM Albums a
     LEFT JOIN Songs s ON s.album_id = a.album_id
     GROUP BY a.album_id, a.title, a.release_date, a.album_type
     ORDER BY a.release_date ASC`
  );
  return Response.json({ albums: result.rows });
}

const AlbumSchema = z.object({
  title: z.string().min(1).max(150),
  release_date: z.string(),
  album_type: z.enum(["studio", "live", "compilation"]),
});

// POST /api/albums — admin only.
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = AlbumSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, release_date, album_type } = parsed.data;

  try {
    const result = await query(
      `INSERT INTO Albums (title, release_date, album_type)
       VALUES ($1, $2, $3)
       RETURNING album_id, title, release_date, album_type`,
      [title, release_date, album_type]
    );
    return Response.json({ album: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return Response.json({ error: "An album with this title and release date already exists" }, { status: 409 });
    }
    throw err;
  }
}
