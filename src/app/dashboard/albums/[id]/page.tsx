"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Album {
  album_id: number;
  title: string;
  release_date: string;
  album_type: string;
}
interface Song {
  song_id: number;
  title: string;
  track_number: number;
  duration_seconds: number;
  genre: string;
  popularity_score: string;
}

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ album: Album; songs: Song[] }>(`/api/albums/${id}`)
      .then((d) => {
        setAlbum(d.album);
        setSongs(d.songs);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="mx-auto max-w-3xl px-6 py-10 text-red-500">{error}</p>;
  if (!album) return <p className="mx-auto max-w-3xl px-6 py-10 text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">{album.title}</h1>
      <p className="mb-6 text-zinc-500">
        {new Date(album.release_date).toLocaleDateString()} · {album.album_type}
      </p>
      <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {songs.map((s) => (
          <li key={s.song_id} className="flex items-center justify-between px-4 py-3">
            <Link href={`/dashboard/songs/${s.song_id}`} className="hover:text-emerald-500">
              <span className="text-zinc-400">{s.track_number}.</span> {s.title}
            </Link>
            <span className="text-sm text-zinc-500">
              {Math.floor(s.duration_seconds / 60)}:{String(s.duration_seconds % 60).padStart(2, "0")} ·{" "}
              {s.popularity_score} plays
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
