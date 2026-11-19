"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

type Row = Record<string, string | number | null | string[]>;
type Tab = "albums" | "songs" | "members" | "users" | "playlists" | "ratings" | "history";
const TABS: Tab[] = ["albums", "songs", "members", "users", "playlists", "ratings", "history"];

const input =
  "rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const btn = "rounded px-3 py-1 text-sm";
const primary = `${btn} bg-emerald-500 font-medium text-zinc-950 hover:bg-emerald-400`;
const danger = `${btn} border border-red-500/40 text-red-500 hover:bg-red-500/10`;
const ghost = `${btn} border border-zinc-300 hover:border-emerald-400 dark:border-zinc-700`;

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("albums");

  useEffect(() => {
    if (!loading && user?.role !== "admin") router.push("/");
  }, [loading, user, router]);

  if (loading || user?.role !== "admin") {
    return <p className="mx-auto max-w-5xl px-6 py-10 text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold">Admin panel</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Create, read, update and delete every kind of record. Deleting cascades
        through the database (e.g. deleting an album removes its songs).
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`${btn} capitalize ${
              tab === t ? "bg-emerald-500 font-medium text-zinc-950" : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "albums" && <Albums />}
      {tab === "songs" && <Songs />}
      {tab === "members" && <Members />}
      {tab === "users" && <Users meId={user.userId} />}
      {tab === "playlists" && <Playlists />}
      {tab === "ratings" && <Ratings />}
      {tab === "history" && <History />}
    </div>
  );
}

/* ---------- shared bits ---------- */

function useList(url: string, key: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    apiFetch<Record<string, Row[]>>(url)
      .then((d) => {
        setRows(d[key]);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [url, key]);
  useEffect(reload, [reload]);
  return { rows, error, reload, setError };
}

async function remove(url: string, what: string, done: () => void, fail: (m: string) => void) {
  if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return;
  try {
    await apiFetch(url, { method: "DELETE" });
    done();
  } catch (e) {
    fail(e instanceof Error ? e.message : "Delete failed");
  }
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const td = "px-3 py-2 border-t border-zinc-100 dark:border-zinc-900";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Msg({ text }: { text: string }) {
  return text ? <p className="mb-3 text-sm text-red-500">{text}</p> : null;
}

/* ---------- albums ---------- */

function Albums() {
  const { rows, error, reload, setError } = useList("/api/albums", "albums");
  const empty = { title: "", release_date: "", album_type: "studio" };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editId) await apiFetch(`/api/albums/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      else await apiFetch("/api/albums", { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      setEditId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <Card title={editId ? `Edit album #${editId}` : "Add album"}>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
          <input className={input} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className={input} type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} required />
          <select className={input} value={form.album_type} onChange={(e) => setForm({ ...form, album_type: e.target.value })}>
            <option>studio</option>
            <option>live</option>
            <option>compilation</option>
          </select>
          <div className="col-span-full flex gap-2">
            <button className={primary}>{editId ? "Save changes" : "Create album"}</button>
            {editId && (
              <button type="button" className={ghost} onClick={() => { setEditId(null); setForm(empty); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>
      <Msg text={error} />
      <Table head={["ID", "Title", "Released", "Type", "Songs", ""]}>
        {rows.map((a) => (
          <tr key={a.album_id as number}>
            <td className={td}>{a.album_id}</td>
            <td className={td}>{a.title}</td>
            <td className={td}>{String(a.release_date).slice(0, 10)}</td>
            <td className={td}>{a.album_type}</td>
            <td className={td}>{a.song_count}</td>
            <td className={`${td} flex gap-2`}>
              <button
                className={ghost}
                onClick={() => {
                  setEditId(a.album_id as number);
                  setForm({
                    title: a.title as string,
                    // release_date is a UTC timestamp string; show the local calendar date
                    release_date: new Date(a.release_date as string).toLocaleDateString("en-CA"),
                    album_type: a.album_type as string,
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Edit
              </button>
              <button className={danger} onClick={() => remove(`/api/albums/${a.album_id}`, `album “${a.title}” and its songs`, reload, setError)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ---------- songs (+ credits) ---------- */

function Songs() {
  const { rows, error, reload, setError } = useList("/api/songs", "songs");
  const albums = useList("/api/albums", "albums").rows;
  const members = useList("/api/members", "members").rows;
  const empty = {
    title: "", album_id: "", duration_seconds: "", track_number: "",
    tempo_bpm: "", energy: "", danceability: "", valence: "", genre: "",
  };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [openCredits, setOpenCredits] = useState<number | null>(null);
  const [credits, setCredits] = useState<Row[]>([]);
  const [cm, setCm] = useState({ member_id: "", contribution_type: "" });

  const loadCredits = useCallback((id: number) => {
    apiFetch<{ credits: Row[] }>(`/api/songs/${id}`).then((d) => setCredits(d.credits)).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      album_id: Number(form.album_id),
      duration_seconds: Number(form.duration_seconds),
      track_number: Number(form.track_number),
      tempo_bpm: Number(form.tempo_bpm),
      energy: Number(form.energy),
      danceability: Number(form.danceability),
      valence: Number(form.valence),
      genre: form.genre,
    };
    try {
      if (editId) await apiFetch(`/api/songs/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/api/songs", { method: "POST", body: JSON.stringify(payload) });
      setForm(empty);
      setEditId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!openCredits) return;
    try {
      await apiFetch(`/api/songs/${openCredits}/credits`, {
        method: "POST",
        body: JSON.stringify({ member_id: Number(cm.member_id), contribution_type: cm.contribution_type }),
      });
      setCm({ member_id: "", contribution_type: "" });
      loadCredits(openCredits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const f = (k: keyof typeof empty, ph: string, extra = {}) => (
    <input className={input} placeholder={ph} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required {...extra} />
  );

  return (
    <>
      <Card title={editId ? `Edit song #${editId} (embedding is recomputed automatically)` : "Add song (embedding is computed automatically)"}>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
          <div className="col-span-full">{f("title", "Title")}</div>
          <select className={input} value={form.album_id} onChange={(e) => setForm({ ...form, album_id: e.target.value })} required>
            <option value="" disabled>Album…</option>
            {albums.map((a) => (
              <option key={a.album_id as number} value={a.album_id as number}>{a.title}</option>
            ))}
          </select>
          {f("track_number", "Track #", { type: "number" })}
          {f("duration_seconds", "Duration (sec)", { type: "number" })}
          {f("genre", "Genre")}
          {f("tempo_bpm", "Tempo (BPM)", { type: "number", step: "0.01" })}
          {f("energy", "Energy 0–1", { type: "number", step: "0.01", min: 0, max: 1 })}
          {f("danceability", "Danceability 0–1", { type: "number", step: "0.01", min: 0, max: 1 })}
          {f("valence", "Valence 0–1", { type: "number", step: "0.01", min: 0, max: 1 })}
          <div className="col-span-full flex gap-2">
            <button className={primary}>{editId ? "Save changes" : "Create song"}</button>
            {editId && (
              <button type="button" className={ghost} onClick={() => { setEditId(null); setForm(empty); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>
      <Msg text={error} />
      <Table head={["ID", "Title", "Album", "Genre", "Plays", ""]}>
        {rows.map((s) => {
          const id = s.song_id as number;
          return (
            <Fragment key={id}>
              <tr>
                <td className={td}>{id}</td>
                <td className={td}>{s.title}</td>
                <td className={td}>{s.album_title}</td>
                <td className={td}>{s.genre}</td>
                <td className={td}>{s.popularity_score}</td>
                <td className={`${td} flex flex-wrap gap-2`}>
                  <button
                    className={ghost}
                    onClick={() => {
                      setEditId(id);
                      setForm({
                        title: s.title as string,
                        album_id: String(s.album_id),
                        duration_seconds: String(s.duration_seconds),
                        track_number: String(s.track_number),
                        tempo_bpm: String(s.tempo_bpm),
                        energy: String(s.energy),
                        danceability: String(s.danceability),
                        valence: String(s.valence),
                        genre: s.genre as string,
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className={ghost}
                    onClick={() => {
                      if (openCredits === id) setOpenCredits(null);
                      else {
                        setOpenCredits(id);
                        loadCredits(id);
                      }
                    }}
                  >
                    Credits
                  </button>
                  <button className={danger} onClick={() => remove(`/api/songs/${id}`, `song “${s.title}”`, reload, setError)}>
                    Delete
                  </button>
                </td>
              </tr>
              {openCredits === id && (
                <tr>
                  <td colSpan={6} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {credits.map((c) => (
                        <span key={`${c.member_id}-${c.contribution_type}`} className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700">
                          {c.name} · {c.contribution_type}{" "}
                          <button
                            className="text-red-500"
                            onClick={() =>
                              remove(
                                `/api/songs/${id}/credits?member_id=${c.member_id}&contribution_type=${encodeURIComponent(String(c.contribution_type))}`,
                                "this credit",
                                () => loadCredits(id),
                                setError
                              )
                            }
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      {credits.length === 0 && <span className="text-xs text-zinc-500">No credits yet.</span>}
                    </div>
                    <form onSubmit={addCredit} className="flex flex-wrap gap-2">
                      <select className={input} value={cm.member_id} onChange={(e) => setCm({ ...cm, member_id: e.target.value })} required>
                        <option value="" disabled>Member…</option>
                        {members.map((m) => (
                          <option key={m.member_id as number} value={m.member_id as number}>{m.name}</option>
                        ))}
                      </select>
                      <input className={input} placeholder="e.g. vocalist, songwriter" value={cm.contribution_type} onChange={(e) => setCm({ ...cm, contribution_type: e.target.value })} required />
                      <button className={primary}>Add credit</button>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>
    </>
  );
}

/* ---------- members ---------- */

function Members() {
  const { rows, error, reload, setError } = useList("/api/members", "members");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, roles: roles.split(",").map((r) => r.trim()).filter(Boolean) };
    try {
      if (editId) await apiFetch(`/api/members/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/api/members", { method: "POST", body: JSON.stringify(payload) });
      setName("");
      setRoles("");
      setEditId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <Card title={editId ? `Edit member #${editId}` : "Add member"}>
        <form onSubmit={save} className="flex flex-wrap gap-3">
          <input className={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className={`${input} w-72`} placeholder="Roles, comma separated (vocalist, songwriter)" value={roles} onChange={(e) => setRoles(e.target.value)} />
          <button className={primary}>{editId ? "Save changes" : "Create member"}</button>
          {editId && (
            <button type="button" className={ghost} onClick={() => { setEditId(null); setName(""); setRoles(""); }}>
              Cancel
            </button>
          )}
        </form>
      </Card>
      <Msg text={error} />
      <Table head={["ID", "Name", "Roles", ""]}>
        {rows.map((m) => (
          <tr key={m.member_id as number}>
            <td className={td}>{m.member_id}</td>
            <td className={td}>{m.name}</td>
            <td className={td}>{(m.roles as string[]).join(", ")}</td>
            <td className={`${td} flex gap-2`}>
              <button
                className={ghost}
                onClick={() => {
                  setEditId(m.member_id as number);
                  setName(m.name as string);
                  setRoles((m.roles as string[]).join(", "));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Edit
              </button>
              <button className={danger} onClick={() => remove(`/api/members/${m.member_id}`, `member “${m.name}”`, reload, setError)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ---------- users ---------- */

function Users({ meId }: { meId: number }) {
  const { rows, error, reload, setError } = useList("/api/users", "users");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ username: "", email: "", role: "listener" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(`/api/users/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      setEditId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      {editId && (
        <Card title={`Edit user #${editId}`}>
          <form onSubmit={save} className="flex flex-wrap gap-3">
            <input className={input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} minLength={3} required />
            <input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option>listener</option>
              <option>admin</option>
            </select>
            <button className={primary}>Save changes</button>
            <button type="button" className={ghost} onClick={() => setEditId(null)}>Cancel</button>
          </form>
        </Card>
      )}
      <Msg text={error} />
      <Table head={["ID", "Username", "Email", "Role", "Playlists", "Ratings", "Plays", ""]}>
        {rows.map((u) => (
          <tr key={u.user_id as number}>
            <td className={td}>{u.user_id}</td>
            <td className={td}>{u.username}{u.user_id === meId && " (you)"}</td>
            <td className={td}>{u.email}</td>
            <td className={td}>{u.role}</td>
            <td className={td}>{u.playlist_count}</td>
            <td className={td}>{u.rating_count}</td>
            <td className={td}>{u.play_count}</td>
            <td className={`${td} flex gap-2`}>
              <button
                className={ghost}
                onClick={() => {
                  setEditId(u.user_id as number);
                  setForm({ username: u.username as string, email: u.email as string, role: u.role as string });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Edit
              </button>
              {u.user_id !== meId && (
                <button className={danger} onClick={() => remove(`/api/users/${u.user_id}`, `user “${u.username}” and all their playlists, ratings and history`, reload, setError)}>
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ---------- playlists / ratings / history ---------- */

function Playlists() {
  const { rows, error, reload, setError } = useList("/api/admin/playlists", "playlists");
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(`/api/playlists/${editId}`, { method: "PUT", body: JSON.stringify({ playlist_name: name }) });
      setEditId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      {editId && (
        <Card title={`Rename playlist #${editId}`}>
          <form onSubmit={save} className="flex gap-3">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
            <button className={primary}>Save</button>
            <button type="button" className={ghost} onClick={() => setEditId(null)}>Cancel</button>
          </form>
        </Card>
      )}
      <Msg text={error} />
      <Table head={["ID", "Name", "Owner", "Songs", ""]}>
        {rows.map((p) => (
          <tr key={p.playlist_id as number}>
            <td className={td}>{p.playlist_id}</td>
            <td className={td}>{p.playlist_name}</td>
            <td className={td}>{p.username}</td>
            <td className={td}>{p.song_count}</td>
            <td className={`${td} flex gap-2`}>
              <button className={ghost} onClick={() => { setEditId(p.playlist_id as number); setName(p.playlist_name as string); }}>
                Rename
              </button>
              <button className={danger} onClick={() => remove(`/api/playlists/${p.playlist_id}`, `playlist “${p.playlist_name}”`, reload, setError)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Ratings() {
  const { rows, error, reload, setError } = useList("/api/admin/ratings", "ratings");
  return (
    <>
      <Msg text={error} />
      <Table head={["User", "Song", "Rating", "When", ""]}>
        {rows.map((r) => (
          <tr key={`${r.user_id}-${r.song_id}`}>
            <td className={td}>{r.username}</td>
            <td className={td}>{r.title}</td>
            <td className={td}>{r.rating_value}★</td>
            <td className={td}>{new Date(r.rated_at as string).toLocaleString()}</td>
            <td className={td}>
              <button className={danger} onClick={() => remove(`/api/ratings?song_id=${r.song_id}&user_id=${r.user_id}`, "this rating", reload, setError)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function History() {
  const { rows, error, reload, setError } = useList("/api/admin/history", "history");
  return (
    <>
      <Msg text={error} />
      <Table head={["ID", "User", "Song", "Played", "Seconds", ""]}>
        {rows.map((h) => (
          <tr key={h.history_id as number}>
            <td className={td}>{h.history_id}</td>
            <td className={td}>{h.username}</td>
            <td className={td}>{h.title}</td>
            <td className={td}>{new Date(h.played_at as string).toLocaleString()}</td>
            <td className={td}>{h.play_duration_seconds}</td>
            <td className={td}>
              <button className={danger} onClick={() => remove(`/api/history/${h.history_id}`, "this play", reload, setError)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
