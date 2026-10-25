"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Playlist {
  playlist_id: number;
  playlist_name: string;
  created_at: string;
}
interface PlaylistSong {
  song_id: number;
  title: string;
  album_title: string;
  position_order: number;
}

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiFetch<{ playlist: Playlist; songs: PlaylistSong[] }>(`/api/playlists/${id}`)
      .then((d) => {
        setPlaylist(d.playlist);
        setSongs(d.songs);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function removeSong(songId: number) {
    try {
      await apiFetch(`/api/playlists/${id}/songs/${songId}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove song");
    }
  }

  async function deletePlaylist() {
    try {
      await apiFetch(`/api/playlists/${id}`, { method: "DELETE" });
      router.push("/dashboard/playlists");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete playlist");
    }
  }

  if (error) return <p className="mx-auto max-w-3xl px-6 py-10 text-red-500">{error}</p>;
  if (!playlist) return <p className="mx-auto max-w-3xl px-6 py-10 text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{playlist.playlist_name}</h1>
        <button
          onClick={deletePlaylist}
          className="rounded border border-red-500/40 px-3 py-1 text-sm text-red-500 hover:bg-red-500/10"
        >
          Delete playlist
        </button>
      </div>
      <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {songs.map((s) => (
          <li key={s.song_id} className="flex items-center justify-between px-4 py-3">
            <Link href={`/dashboard/songs/${s.song_id}`} className="hover:text-emerald-500">
              <span className="text-zinc-400">{s.position_order}.</span> {s.title}{" "}
              <span className="text-sm text-zinc-500">— {s.album_title}</span>
            </Link>
            <button onClick={() => removeSong(s.song_id)} className="text-sm text-zinc-500 hover:text-red-500">
              Remove
            </button>
          </li>
        ))}
        {songs.length === 0 && <li className="px-4 py-6 text-center text-zinc-500">No songs yet.</li>}
      </ol>
    </div>
  );
}
