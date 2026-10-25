"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Album {
  album_id: number;
  title: string;
  release_date: string;
  album_type: string;
  song_count: string;
}

export default function Home() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ albums: Album[] }>("/api/albums")
      .then((d) => setAlbums(d.albums))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <section className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight">Setlist Sync</h1>
        <p className="mx-auto max-w-xl text-zinc-500 dark:text-zinc-400">
          A One Direction discography recommendation engine — browse the catalog,
          rate songs, and get similarity-based recommendations powered by vector
          search over audio-feature embeddings (PostgreSQL + pgvector).
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded bg-emerald-500 px-5 py-2 font-medium text-zinc-950 hover:bg-emerald-400"
          >
            Browse the catalog
          </Link>
        </div>
      </section>

      <h2 className="mb-4 text-xl font-semibold">Albums</h2>
      {error && <p className="text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {albums?.map((a) => (
          <Link
            key={a.album_id}
            href={`/dashboard/albums/${a.album_id}`}
            className="rounded-lg border border-zinc-200 p-4 transition hover:border-emerald-400 dark:border-zinc-800"
          >
            <div className="font-semibold">{a.title}</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {new Date(a.release_date).getFullYear()} · {a.album_type}
            </div>
            <div className="mt-1 text-xs text-zinc-400">{a.song_count} songs</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
