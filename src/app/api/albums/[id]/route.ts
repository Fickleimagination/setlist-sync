import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/albums/:id — album detail + its songs, ordered by track number.
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId)) {
    return Response.json({ error: "Invalid album id" }, { status: 400 });
  }

  const album = await query(
    `SELECT album_id, title, release_date, album_type FROM Albums WHERE album_id = $1`,
    [albumId]
  );
  if (album.rows.length === 0) {
    return Response.json({ error: "Album not found" }, { status: 404 });
  }

  const songs = await query(
    `SELECT s.song_id, s.title, s.track_number, s.duration_seconds, s.genre,
            COALESCE(p.popularity_score, 0) AS popularity_score
     FROM Songs s
     LEFT JOIN Song_Popularity p ON p.song_id = s.song_id
     WHERE s.album_id = $1
     ORDER BY s.track_number ASC`,
    [albumId]
  );

  return Response.json({ album: album.rows[0], songs: songs.rows });
}

const AlbumPatchSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  release_date: z.string().optional(),
  album_type: z.enum(["studio", "live", "compilation"]).optional(),
});

// PUT /api/albums/:id — admin only.
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId)) {
    return Response.json({ error: "Invalid album id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AlbumPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fields = parsed.data;
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => fields[k]);
  const result = await query(
    `UPDATE Albums SET ${setClause} WHERE album_id = $${keys.length + 1}
     RETURNING album_id, title, release_date, album_type`,
    [...values, albumId]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "Album not found" }, { status: 404 });
  }
  return Response.json({ album: result.rows[0] });
}

// DELETE /api/albums/:id — admin only. Cascades to Songs via FK.
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId)) {
    return Response.json({ error: "Invalid album id" }, { status: 400 });
  }

  const result = await query(`DELETE FROM Albums WHERE album_id = $1 RETURNING album_id`, [albumId]);
  if (result.rows.length === 0) {
    return Response.json({ error: "Album not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
