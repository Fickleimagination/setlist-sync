# Setlist Sync

A One Direction discography recommendation system — DBMS Level 3 project.

**Team**
- PES1UG24CS116 — Bhavyaa Garg
- PES1UG24CS126 — Chaturya Prabhakar

## What this is

Setlist Sync lets a listener browse the One Direction catalog, rate songs,
log plays, build playlists, and get two kinds of recommendations:

1. **"Similar to this song"** — nearest neighbors in embedding space to one
   specific song.
2. **"For you"** — nearest neighbors to a taste vector built from everything
   the signed-in user has rated highly or listened to.

Both are powered by vector similarity search (pgvector cosine distance)
over 8-dimensional embeddings derived from each song's audio features.

## Database paradigms (Option 2 — SQL + Vector)

Both paradigms live inside the same PostgreSQL instance, via the
`pgvector` extension:

- **Relational (SQL)**: 10 tables modeling albums, members, songs, users,
  listening history, ratings, and playlists — see `db/001_schema.sql`.
- **Vector**: a `Song_Embeddings` table (`vector(8)` column) with an
  `ivfflat` approximate-nearest-neighbor index on cosine distance.

### Advanced features implemented

| # | Feature | Where |
|---|---|---|
| 1 | **View** | `Song_Popularity` — derived attribute (play count), never stored as a column |
| 2 | **Trigger** | `trg_validate_play_duration` — blocks a logged play longer than the song itself (a cross-table rule a `CHECK` can't express) |
| 3 | **Stored function** | `log_listen(user_id, song_id, duration)` — atomic "log a play" operation, called from `/api/history` |
| 4 | **Indexing** | B-tree indexes on FK columns + `ivfflat` vector index on `Song_Embeddings` |
| 5 | **Transactions** | `withTransaction()` in `src/lib/db.ts` — wraps multi-statement writes (e.g. creating a song + its embedding) atomically |
| 6 | **Vector similarity search** | `/api/recommendations/similar/:id` and `/api/recommendations/for-you`, both using the pgvector `<=>` cosine-distance operator |

That's 5 SQL-side advanced features plus vector search — above the
"4 advanced + 1 vector" minimum.

### What's embedded, and how

Each song's embedding is **not** a black-box call to a hosted model — it's
computed directly and transparently from columns already in the schema, so
every dimension is explainable:

```
[ tempo_bpm / 200, energy, danceability, valence,
  duration_seconds / 300, hash(genre) % 100 / 100,
  sin(tempo_bpm / 50), cos(energy * π) ]
```

See `src/lib/embeddings.ts`. Similarity metric: cosine distance
(`embedding <=> embedding`, pgvector operator). A real deployment would
swap this for a text/audio embedding model's output vector — the storage
and retrieval layer stay identical.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **PostgreSQL 16 + pgvector** via the raw `pg` driver (no ORM — pgvector
  needs raw SQL, and this stays close to the validated DDL)
- **Auth**: JWT session cookies (`jose`), bcrypt password hashing
  (`bcryptjs`), httpOnly cookies — not NextAuth
- **Roles**: `listener` (default on signup) and `admin` (promoted by an
  existing admin) — enforced in every route handler via
  `requireUser()`/`requireAdmin()` in `src/lib/session.ts`, not just at the
  page level (`src/proxy.ts` only redirects for UX; it is documented there
  as not the security boundary, per Next.js 16's own guidance)
- **Validation**: `zod` schemas on every API route body

## Project structure

```
db/001_schema.sql        DDL — tables, view, trigger, stored function, indexes
scripts/migrate.ts       Applies db/001_schema.sql
scripts/seed.ts          Seeds sample data + computes embeddings
src/lib/db.ts            Connection pool, query() and withTransaction() helpers
src/lib/auth.ts          JWT signing/verification, password hashing
src/lib/session.ts       requireUser()/requireAdmin() — the real auth boundary
src/lib/embeddings.ts    Embedding computation (shared by seed + API)
src/proxy.ts             Page-level redirect for /admin (UX only)
src/app/api/**           All REST endpoints (the only way the frontend touches the DB)
src/app/**               Pages (App Router) — all client components fetching the API
```

## Setup & running it

```bash
npm install

# 1. Configure environment (never hard-code credentials)
cp .env.example .env.local
# edit .env.local: DATABASE_URL, JWT_SECRET

# 2. Create the database and enable pgvector (once)
createdb setlist_sync
psql -d setlist_sync -c "CREATE EXTENSION IF NOT EXISTS vector;"
# (requires the postgresql-<version>-pgvector package installed)

# 3. Apply schema + seed sample data
npm run db:migrate
npm run db:seed

# 4. Run the app
npm run dev
```

Open http://localhost:3000.

**Demo logins** (seeded by `scripts/seed.ts`):
- Admin: `bhavyaa` / `admin123`
- Listener: `fan_alex` / `listener123`

To reset the database to the clean seeded state at any point:
```bash
dropdb setlist_sync && createdb setlist_sync
psql -d setlist_sync -c "CREATE EXTENSION IF NOT EXISTS vector;"
npm run db:reset
```

## API overview

| Route | Methods | Auth |
|---|---|---|
| `/api/auth/register`, `/login`, `/logout`, `/me` | POST/GET | public |
| `/api/albums`, `/api/albums/:id` | GET / POST / PUT / DELETE | GET public, writes admin-only |
| `/api/songs`, `/api/songs/:id` | GET / POST / PUT / DELETE | GET public, writes admin-only |
| `/api/members`, `/api/members/:id` | GET | public |
| `/api/playlists`, `/api/playlists/:id`, `/api/playlists/:id/songs[/...]` | GET/POST/DELETE | signed-in owner (or admin) |
| `/api/ratings` | POST | signed-in user |
| `/api/history` | GET/POST | signed-in user |
| `/api/recommendations/similar/:id` | GET | public |
| `/api/recommendations/for-you` | GET | signed-in user |
| `/api/users/:id/role` | PUT | admin only |

## Testing performed

All of the above was validated end-to-end against a live PostgreSQL 16 +
pgvector instance during development: schema migration, seed data,
the view/trigger/stored-function/vector-index, every API route (including
RBAC denial paths — a listener gets `403` from every admin-only route), and
every page's HTTP response. See commit history for the sequence.
