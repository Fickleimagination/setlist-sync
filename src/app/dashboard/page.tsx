"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface Song {
  song_id: number;
  title: string;
  album_id: number;
  album_title: string;
  genre: string;
  duration_seconds: number;
  popularity_score: string;
  avg_rating: string | null;
}

interface Rec {
  song_id: number;
  title: string;
  album_title: string;
  distance: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [forYou, setForYou] = useState<Rec[] | null>(null);
  const [forYouMessage, setForYouMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (genre) params.set("genre", genre);
    apiFetch<{ songs: Song[] }>(`/api/songs?${params.toString()}`)
      .then((d) => setSongs(d.songs))
      .catch((e) => setError(e.message));
  }, [search, genre]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ recommendations: Rec[]; message?: string }>("/api/recommendations/for-you")
      .then((d) => {
        setForYou(d.recommendations);
        setForYouMessage(d.message ?? "");
      })
      .catch(() => {});
  }, [user]);

  const genres = Array.from(new Set(songs.map((s) => s.genre))).sort();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {user && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Recommended for you</h2>
          {forYouMessage && <p className="text-sm text-zinc-500">{forYouMessage}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {forYou?.map((r) => (
              <Link
                key={r.song_id}
                href={`/dashboard/songs/${r.song_id}`}
                className="rounded-lg border border-emerald-500/40 p-3 hover:border-emerald-400"
              >
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="truncate text-xs text-zinc-500">{r.album_title}</div>
                <div className="mt-1 text-xs text-emerald-500">
                  distance {r.distance.toFixed(3)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">All songs</h2>
        <div className="mb-4 flex gap-3">
          <input
            placeholder="Search by title…"
            className="flex-1 rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Album</th>
                <th className="px-3 py-2">Genre</th>
                <th className="px-3 py-2">Length</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Plays</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((s) => (
                <tr
                  key={s.song_id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
                >
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/songs/${s.song_id}`} className="font-medium hover:text-emerald-500">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    <Link href={`/dashboard/albums/${s.album_id}`} className="hover:text-emerald-500">
                      {s.album_title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{s.genre}</td>
                  <td className="px-3 py-2 text-zinc-500">
                    {Math.floor(s.duration_seconds / 60)}:{String(s.duration_seconds % 60).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{s.avg_rating ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{s.popularity_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
