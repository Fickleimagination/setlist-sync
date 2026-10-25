/**
 * Seed script — populates sample data and computes embeddings.
 * Run with: npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ---- Albums ----
    const albums = [
      ["Up All Night", "2011-11-18", "studio"],
      ["Take Me Home", "2012-11-09", "studio"],
      ["Midnight Memories", "2013-11-25", "studio"],
      ["Four", "2014-11-17", "studio"],
      ["Made in the A.M.", "2015-11-13", "studio"],
    ] as const;
    const albumIds: number[] = [];
    for (const [title, release_date, album_type] of albums) {
      const res = await client.query(
        `INSERT INTO Albums (title, release_date, album_type) VALUES ($1,$2,$3) RETURNING album_id`,
        [title, release_date, album_type]
      );
      albumIds.push(res.rows[0].album_id);
    }

    // ---- Members ----
    const members = ["Harry Styles", "Niall Horan", "Liam Payne", "Louis Tomlinson", "Zayn Malik"];
    const memberIds: number[] = [];
    for (const name of members) {
      const res = await client.query(
        `INSERT INTO Members (name) VALUES ($1) RETURNING member_id`,
        [name]
      );
      memberIds.push(res.rows[0].member_id);
    }
    const roles: [number, string][] = [
      [memberIds[0], "vocalist"], [memberIds[0], "songwriter"],
      [memberIds[1], "vocalist"], [memberIds[1], "guitarist"],
      [memberIds[2], "vocalist"], [memberIds[2], "songwriter"],
      [memberIds[3], "vocalist"],
      [memberIds[4], "vocalist"],
    ];
    for (const [member_id, role] of roles) {
      await client.query(`INSERT INTO Member_Roles (member_id, role) VALUES ($1,$2)`, [member_id, role]);
    }

    // ---- Songs ----
    type SongRow = [string, number, number, number, number, number, number, number, string];
    const songs: SongRow[] = [
      ["What Makes You Beautiful", 197, 1, albumIds[0], 124.0, 0.88, 0.72, 0.90, "pop"],
      ["Live While We're Young", 164, 1, albumIds[1], 124.0, 0.91, 0.75, 0.88, "pop rock"],
      ["Story of My Life", 248, 4, albumIds[2], 137.0, 0.55, 0.45, 0.35, "folk pop"],
      ["Midnight Memories", 228, 1, albumIds[2], 170.0, 0.85, 0.55, 0.60, "rock"],
      ["Steal My Girl", 221, 1, albumIds[3], 138.0, 0.70, 0.60, 0.65, "pop"],
      ["Night Changes", 230, 2, albumIds[3], 120.0, 0.45, 0.50, 0.40, "pop"],
      ["History", 200, 3, albumIds[4], 100.0, 0.40, 0.48, 0.30, "pop ballad"],
      ["Perfect", 221, 2, albumIds[4], 100.0, 0.60, 0.55, 0.55, "pop"],
    ];
    const songIds: number[] = [];
    for (const [title, duration_seconds, track_number, album_id, tempo_bpm, energy, danceability, valence, genre] of songs) {
      const res = await client.query(
        `INSERT INTO Songs (title, duration_seconds, track_number, album_id, tempo_bpm, energy, danceability, valence, genre)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING song_id`,
        [title, duration_seconds, track_number, album_id, tempo_bpm, energy, danceability, valence, genre]
      );
      songIds.push(res.rows[0].song_id);
    }

    // ---- Song_Members ----
    const songMembers: [number, number, string][] = [
      [songIds[0], memberIds[0], "vocalist"], [songIds[0], memberIds[1], "vocalist"],
      [songIds[0], memberIds[2], "vocalist"], [songIds[0], memberIds[3], "vocalist"],
      [songIds[0], memberIds[4], "vocalist"],
      [songIds[2], memberIds[0], "songwriter"], [songIds[2], memberIds[3], "songwriter"],
      [songIds[6], memberIds[3], "songwriter"], [songIds[6], memberIds[0], "songwriter"],
    ];
    for (const [song_id, member_id, contribution_type] of songMembers) {
      await client.query(
        `INSERT INTO Song_Members (song_id, member_id, contribution_type) VALUES ($1,$2,$3)`,
        [song_id, member_id, contribution_type]
      );
    }

    // ---- Users (real bcrypt hashes so login actually works in the demo) ----
    const users: [string, string, string, string][] = [
      ["bhavyaa", "bhavyaa@example.com", "admin123", "admin"],
      ["chaturya", "chaturya@example.com", "admin123", "admin"],
      ["fan_alex", "alex@example.com", "listener123", "listener"],
      ["fan_priya", "priya@example.com", "listener123", "listener"],
    ];
    const userIds: number[] = [];
    for (const [username, email, plainPassword, role] of users) {
      const password_hash = await bcrypt.hash(plainPassword, 10);
      const res = await client.query(
        `INSERT INTO Users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING user_id`,
        [username, email, password_hash, role]
      );
      userIds.push(res.rows[0].user_id);
    }

    // ---- Listening_History ----
    const plays: [number, number, number][] = [
      [userIds[2], songIds[0], 197], [userIds[2], songIds[0], 197], [userIds[2], songIds[2], 248],
      [userIds[3], songIds[0], 190], [userIds[3], songIds[3], 228], [userIds[3], songIds[3], 228], [userIds[3], songIds[6], 200],
      [userIds[0], songIds[2], 248], [userIds[1], songIds[6], 200], [userIds[1], songIds[6], 195],
    ];
    for (const [user_id, song_id, play_duration_seconds] of plays) {
      await client.query(`SELECT log_listen($1,$2,$3)`, [user_id, song_id, play_duration_seconds]);
    }

    // ---- Ratings ----
    const ratings: [number, number, number][] = [
      [userIds[2], songIds[0], 5], [userIds[2], songIds[2], 4],
      [userIds[3], songIds[3], 5], [userIds[3], songIds[6], 5],
      [userIds[0], songIds[2], 5], [userIds[1], songIds[6], 4],
    ];
    for (const [user_id, song_id, rating_value] of ratings) {
      await client.query(
        `INSERT INTO Ratings (user_id, song_id, rating_value) VALUES ($1,$2,$3)`,
        [user_id, song_id, rating_value]
      );
    }

    // ---- Playlists ----
    const p1 = await client.query(
      `INSERT INTO Playlists (user_id, playlist_name) VALUES ($1,$2) RETURNING playlist_id`,
      [userIds[2], "Road Trip Anthems"]
    );
    const p2 = await client.query(
      `INSERT INTO Playlists (user_id, playlist_name) VALUES ($1,$2) RETURNING playlist_id`,
      [userIds[3], "Late Night Feels"]
    );
    const playlistSongs: [number, number, number][] = [
      [p1.rows[0].playlist_id, songIds[0], 1], [p1.rows[0].playlist_id, songIds[3], 2], [p1.rows[0].playlist_id, songIds[4], 3],
      [p2.rows[0].playlist_id, songIds[6], 1], [p2.rows[0].playlist_id, songIds[5], 2], [p2.rows[0].playlist_id, songIds[2], 3],
    ];
    for (const [playlist_id, song_id, position_order] of playlistSongs) {
      await client.query(
        `INSERT INTO Playlist_Songs (playlist_id, song_id, position_order) VALUES ($1,$2,$3)`,
        [playlist_id, song_id, position_order]
      );
    }

    // ---- Song_Embeddings ----
    // 8-dim vector built directly from the audio-feature columns, normalized
    // to [0,1] scale, so cosine similarity reflects audio-feature closeness.
    // (A real deployment would swap this for an actual audio/lyrics embedding model.)
    for (const [title, duration_seconds, , , tempo_bpm, energy, danceability, valence, genre] of songs) {
      const idx = songs.findIndex((s) => s[0] === title);
      const song_id = songIds[idx];
      const genreHash = (hashString(genre) % 100) / 100;
      const vec = [
        tempo_bpm / 200,
        energy,
        danceability,
        valence,
        duration_seconds / 300,
        genreHash,
        Math.sin(tempo_bpm / 50),
        Math.cos(energy * Math.PI),
      ];
      await client.query(
        `INSERT INTO Song_Embeddings (song_id, embedding) VALUES ($1, $2)`,
        [song_id, `[${vec.join(",")}]`]
      );
    }

    await client.query("COMMIT");
    console.log("Seed complete:", {
      albums: albumIds.length,
      members: memberIds.length,
      songs: songIds.length,
      users: userIds.length,
    });
    console.log("Demo logins: bhavyaa/admin123 (admin), fan_alex/listener123 (listener)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

main();
