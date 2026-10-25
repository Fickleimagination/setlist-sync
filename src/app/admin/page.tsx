"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface Album {
  album_id: number;
  title: string;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);

  const [albumForm, setAlbumForm] = useState({ title: "", release_date: "", album_type: "studio" });
  const [albumStatus, setAlbumStatus] = useState("");

  const [songForm, setSongForm] = useState({
    title: "",
    album_id: "",
    duration_seconds: "",
    track_number: "",
    tempo_bpm: "",
    energy: "",
    danceability: "",
    valence: "",
    genre: "",
  });
  const [songStatus, setSongStatus] = useState("");

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"listener" | "admin">("admin");
  const [roleStatus, setRoleStatus] = useState("");

  useEffect(() => {
    if (!loading && user?.role !== "admin") router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    apiFetch<{ albums: Album[] }>("/api/albums").then((d) => setAlbums(d.albums)).catch(() => {});
  }, []);

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    setAlbumStatus("");
    try {
      await apiFetch("/api/albums", { method: "POST", body: JSON.stringify(albumForm) });
      setAlbumStatus("Album created.");
      setAlbumForm({ title: "", release_date: "", album_type: "studio" });
      apiFetch<{ albums: Album[] }>("/api/albums").then((d) => setAlbums(d.albums));
    } catch (err) {
      setAlbumStatus(err instanceof Error ? err.message : "Failed");
    }
  }

  async function createSong(e: React.FormEvent) {
    e.preventDefault();
    setSongStatus("");
    try {
      await apiFetch("/api/songs", {
        method: "POST",
        body: JSON.stringify({
          title: songForm.title,
          album_id: Number(songForm.album_id),
          duration_seconds: Number(songForm.duration_seconds),
          track_number: Number(songForm.track_number),
          tempo_bpm: Number(songForm.tempo_bpm),
          energy: Number(songForm.energy),
          danceability: Number(songForm.danceability),
          valence: Number(songForm.valence),
          genre: songForm.genre,
        }),
      });
      setSongStatus("Song created (embedding computed automatically).");
      setSongForm({
        title: "", album_id: "", duration_seconds: "", track_number: "",
        tempo_bpm: "", energy: "", danceability: "", valence: "", genre: "",
      });
    } catch (err) {
      setSongStatus(err instanceof Error ? err.message : "Failed");
    }
  }

  async function updateRole(e: React.FormEvent) {
    e.preventDefault();
    setRoleStatus("");
    try {
      const data = await apiFetch<{ user: { username: string; role: string } }>(
        `/api/users/${userId}/role`,
        { method: "PUT", body: JSON.stringify({ role }) }
      );
      setRoleStatus(`${data.user.username} is now ${data.user.role}.`);
    } catch (err) {
      setRoleStatus(err instanceof Error ? err.message : "Failed");
    }
  }

  if (loading || user?.role !== "admin") {
    return <p className="mx-auto max-w-3xl px-6 py-10 text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold">Admin panel</h1>

      <section className="mb-10 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 font-semibold">Add album</h2>
        <form onSubmit={createAlbum} className="grid gap-3 sm:grid-cols-3">
          <input
            placeholder="Title"
            value={albumForm.title}
            onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <input
            type="date"
            value={albumForm.release_date}
            onChange={(e) => setAlbumForm({ ...albumForm, release_date: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <select
            value={albumForm.album_type}
            onChange={(e) => setAlbumForm({ ...albumForm, album_type: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          >
            <option value="studio">studio</option>
            <option value="live">live</option>
            <option value="compilation">compilation</option>
          </select>
          <button className="col-span-full rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
            Create album
          </button>
        </form>
        {albumStatus && <p className="mt-2 text-sm text-emerald-500">{albumStatus}</p>}
      </section>

      <section className="mb-10 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 font-semibold">Add song</h2>
        <form onSubmit={createSong} className="grid gap-3 sm:grid-cols-3">
          <input
            placeholder="Title"
            value={songForm.title}
            onChange={(e) => setSongForm({ ...songForm, title: e.target.value })}
            className="col-span-full rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <select
            value={songForm.album_id}
            onChange={(e) => setSongForm({ ...songForm, album_id: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          >
            <option value="" disabled>
              Album…
            </option>
            {albums.map((a) => (
              <option key={a.album_id} value={a.album_id}>
                {a.title}
              </option>
            ))}
          </select>
          <input
            placeholder="Track #"
            type="number"
            value={songForm.track_number}
            onChange={(e) => setSongForm({ ...songForm, track_number: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <input
            placeholder="Duration (sec)"
            type="number"
            value={songForm.duration_seconds}
            onChange={(e) => setSongForm({ ...songForm, duration_seconds: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <input
            placeholder="Genre"
            value={songForm.genre}
            onChange={(e) => setSongForm({ ...songForm, genre: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <input
            placeholder="Tempo (BPM)"
            type="number"
            value={songForm.tempo_bpm}
            onChange={(e) => setSongForm({ ...songForm, tempo_bpm: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <input
            placeholder="Energy (0-1)"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={songForm.energy}
            onChange={(e) => setSongForm({ ...songForm, energy: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <input
            placeholder="Danceability (0-1)"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={songForm.danceability}
            onChange={(e) => setSongForm({ ...songForm, danceability: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <input
            placeholder="Valence (0-1)"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={songForm.valence}
            onChange={(e) => setSongForm({ ...songForm, valence: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <button className="col-span-full rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
            Create song
          </button>
        </form>
        {songStatus && <p className="mt-2 text-sm text-emerald-500">{songStatus}</p>}
      </section>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 font-semibold">Change user role</h2>
        <form onSubmit={updateRole} className="flex gap-3">
          <input
            placeholder="User ID"
            type="number"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-28 rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "listener" | "admin")}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          >
            <option value="listener">listener</option>
            <option value="admin">admin</option>
          </select>
          <button className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
            Update
          </button>
        </form>
        {roleStatus && <p className="mt-2 text-sm text-emerald-500">{roleStatus}</p>}
      </section>
    </div>
  );
}
