"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Playlist {
  playlist_id: number;
  playlist_name: string;
  created_at: string;
  song_count: string;
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function load() {
    apiFetch<{ playlists: Playlist[] }>("/api/playlists")
      .then((d) => setPlaylists(d.playlists))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function createPlaylist(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/api/playlists", { method: "POST", body: JSON.stringify({ playlist_name: name }) });
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create playlist");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Your playlists</h1>

      <form onSubmit={createPlaylist} className="mb-8 flex gap-3">
        <input
          placeholder="New playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          required
        />
        <button className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
          Create
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {playlists.map((p) => (
          <Link
            key={p.playlist_id}
            href={`/dashboard/playlists/${p.playlist_id}`}
            className="rounded-lg border border-zinc-200 p-4 hover:border-emerald-400 dark:border-zinc-800"
          >
            <div className="font-semibold">{p.playlist_name}</div>
            <div className="text-sm text-zinc-500">{p.song_count} songs</div>
          </Link>
        ))}
        {playlists.length === 0 && <p className="text-zinc-500">No playlists yet.</p>}
      </div>
    </div>
  );
}
