"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface SongDetail {
  song_id: number;
  title: string;
  duration_seconds: number;
  track_number: number;
  genre: string;
  tempo_bpm: string;
  energy: string;
  danceability: string;
  valence: string;
  album_id: number;
  album_title: string;
  popularity_score: string;
  avg_rating: string | null;
  rating_count: string;
}
interface Credit {
  member_id: number;
  name: string;
  contribution_type: string;
}
interface Rec {
  song_id: number;
  title: string;
  album_title: string;
  distance: number;
}
interface Playlist {
  playlist_id: number;
  playlist_name: string;
}

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [song, setSong] = useState<SongDetail | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [myRating, setMyRating] = useState<number>(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiFetch<{ song: SongDetail; credits: Credit[] }>(`/api/songs/${id}`)
      .then((d) => {
        setSong(d.song);
        setCredits(d.credits);
      })
      .catch((e) => setError(e.message));
    apiFetch<{ recommendations: Rec[] }>(`/api/recommendations/similar/${id}?limit=5`)
      .then((d) => setRecs(d.recommendations))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ playlists: Playlist[] }>("/api/playlists")
      .then((d) => setPlaylists(d.playlists))
      .catch(() => {});
  }, [user]);

  async function logPlay() {
    if (!song) return;
    setStatus("");
    try {
      await apiFetch("/api/history", {
        method: "POST",
        body: JSON.stringify({ song_id: song.song_id, play_duration_seconds: song.duration_seconds }),
      });
      setStatus("Logged a full play.");
      load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to log play");
    }
  }

  async function submitRating(value: number) {
    if (!song) return;
    setMyRating(value);
    setStatus("");
    try {
      await apiFetch("/api/ratings", {
        method: "POST",
        body: JSON.stringify({ song_id: song.song_id, rating_value: value }),
      });
      setStatus(`Rated ${value}/5.`);
      load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to rate");
    }
  }

  async function addToPlaylist(playlistId: number) {
    if (!song) return;
    setStatus("");
    try {
      await apiFetch(`/api/playlists/${playlistId}/songs`, {
        method: "POST",
        body: JSON.stringify({ song_id: song.song_id }),
      });
      setStatus("Added to playlist.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to add to playlist");
    }
  }

  if (error) return <p className="mx-auto max-w-3xl px-6 py-10 text-red-500">{error}</p>;
  if (!song) return <p className="mx-auto max-w-3xl px-6 py-10 text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/dashboard/albums/${song.album_id}`} className="text-sm text-zinc-500 hover:text-emerald-500">
        ← {song.album_title}
      </Link>
      <h1 className="mt-1 text-2xl font-bold">{song.title}</h1>
      <p className="mb-4 text-zinc-500">
        Track {song.track_number} · {song.genre} ·{" "}
        {Math.floor(song.duration_seconds / 60)}:{String(song.duration_seconds % 60).padStart(2, "0")}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Tempo", `${song.tempo_bpm} BPM`],
          ["Energy", song.energy],
          ["Danceability", song.danceability],
          ["Valence", song.valence],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-zinc-200 p-2 text-center dark:border-zinc-800">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="font-medium">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-4 text-sm text-zinc-500">
        <span>{song.popularity_score} plays</span>
        <span>
          {song.avg_rating ? `${song.avg_rating}★ (${song.rating_count} ratings)` : "No ratings yet"}
        </span>
      </div>

      {credits.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-500">Credits</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {credits.map((c) => (
              <li key={`${c.member_id}-${c.contribution_type}`} className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">
                {c.name} <span className="text-zinc-500">· {c.contribution_type}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {user ? (
        <section className="mb-6 flex flex-wrap items-center gap-4">
          <button
            onClick={logPlay}
            className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            ▶ Log a play
          </button>
          <div className="flex items-center gap-1 text-sm">
            Rate:
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => submitRating(v)}
                className={v <= myRating ? "text-emerald-500" : "text-zinc-400 hover:text-emerald-400"}
              >
                ★
              </button>
            ))}
          </div>
          {playlists.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => e.target.value && addToPlaylist(Number(e.target.value))}
              className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
            >
              <option value="" disabled>
                Add to playlist…
              </option>
              {playlists.map((p) => (
                <option key={p.playlist_id} value={p.playlist_id}>
                  {p.playlist_name}
                </option>
              ))}
            </select>
          )}
        </section>
      ) : (
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/login" className="text-emerald-500 hover:underline">
            Log in
          </Link>{" "}
          to rate, log plays, or add this to a playlist.
        </p>
      )}
      {status && <p className="mb-6 text-sm text-emerald-500">{status}</p>}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">
          Similar songs <span className="text-xs">(vector cosine similarity)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {recs.map((r) => (
            <button
              key={r.song_id}
              onClick={() => router.push(`/dashboard/songs/${r.song_id}`)}
              className="rounded-lg border border-zinc-200 p-3 text-left hover:border-emerald-400 dark:border-zinc-800"
            >
              <div className="truncate text-sm font-medium">{r.title}</div>
              <div className="truncate text-xs text-zinc-500">{r.album_title}</div>
              <div className="mt-1 text-xs text-emerald-500">distance {r.distance.toFixed(3)}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
