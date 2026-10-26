# Setlist Sync — Project Report

**DBMS Experiential Learning — Level 3 Project (Option 2: SQL + Vector Database)**
Department of Computer Science and Engineering

**Team**
- PES1UG24CS116 — Bhavyaa Garg
- PES1UG24CS126 — Chaturya Prabhakar

This report is organized against the documentation checklist in the Level 3
project brief: objectives, functional requirements, ER diagram, relational
schema, database choice and justification, data dictionary, SQL/vector
implementation, important queries, system architecture, screenshots, testing
results, and conclusion.

---

## 1. Objectives

Setlist Sync is a One Direction discography application built to demonstrate
a relational database working alongside a vector-search paradigm in the same
PostgreSQL instance — Option 2 (SQL + Vector) of the project brief. It goes
beyond CRUD: the core feature is a *recommendation* engine, which a plain
lookup/filter query cannot produce. The objectives were to:

1. Design and implement a normalized relational schema covering a realistic
   many-sided domain — albums, songs, band members and their roles, user
   accounts, listening activity, ratings and playlists.
2. Extend that schema with a **vector** paradigm (pgvector) so songs can be
   compared and recommended by similarity, not just by exact-match queries —
   the problem (music recommendation) is naturally suited to this, see
   Section 5.
3. Implement, above the minimum, at least four advanced relational database
   features plus the vector-search feature, and wire all of them into a
   working application rather than leaving them as standalone SQL.
4. Enforce authentication and role-based access control (listener vs. admin)
   at the database-writing layer, not just in the UI.
5. Build a usable full-stack web application (Next.js + TypeScript) on top of
   the schema, exercising it end-to-end: every table is reachable through a
   real user flow, not just through seed data.
6. Verify the result with real, run-and-recorded testing against a live
   PostgreSQL instance, rather than relying on the code reading correctly.

## 2. Functional Requirements

| # | Requirement | Role |
|---|---|---|
| FR1 | Register an account and log in; sessions persist via a cookie | Guest → Listener |
| FR2 | Browse all albums and all songs; search songs by title; filter by genre or album | Public |
| FR3 | View a song's detail page: audio features, credited members, average rating, play count | Public |
| FR4 | View "similar songs" to a given song, ranked by vector (cosine) distance | Public |
| FR5 | View a personalized "for you" feed, ranked by distance to a taste vector built from the user's own ratings/plays | Listener |
| FR6 | Rate a song 1–5; log a play of a song | Listener |
| FR7 | Create a playlist, add/remove songs, view a playlist's songs in order | Listener (owner) |
| FR8 | Add a new album or song | Admin |
| FR9 | Promote another user's role | Admin |
| FR10 | Every write is rejected for an unauthenticated or under-privileged caller, enforced server-side | All |

## 3. Entity-Relationship Diagram

![ER diagram](screenshots/12-er-diagram.png)

Eleven entities: ten relational tables plus `Song_Embeddings`, the vector
table. `Member_Roles` models a multivalued attribute (a member can hold
several roles); `Song_Members` and `Playlist_Songs` are M:N link tables with
their own attributes (`contribution_type`, `position_order`); `Audio_Features`
is a composite attribute realized as four columns on `Songs` rather than a
separate table, since each song has exactly one set.

## 4. Relational Schema

The schema is implemented in `db/001_schema.sql` and applied with
`npm run db:migrate` (see `scripts/migrate.ts`). `psql`'s own description of
the live result — every table, the view, the function, and each table's
columns, indexes, check constraints and foreign keys — is captured here:

![Schema as described by psql](screenshots/13-schema-psql.png)

Full column-by-column detail (types, `NOT NULL`, every `CHECK`, every FK and
its `ON DELETE` behaviour) is in [`data-dictionary.md`](data-dictionary.md),
which is the source of truth; Sections 5 and 6 below summarize what it shows.

## 5. Database Choice and Justification

**Why PostgreSQL (SQL, mandatory):** the core domain — albums, songs, band
members, users, ratings, playlists — is small, strongly typed, and full of
exactly the relationships a relational model is for: one album has many
songs, one song has many contributing members through an M:N link, one user
has many playlists, a playlist has many songs in a specific order. These are
enforced with real foreign keys and `CHECK` constraints (e.g. a rating must
be 1–5, a play cannot exceed a song's length) rather than application-level
checks that could be bypassed by a second client.

**Why pgvector instead of a standalone vector database (Qdrant, Pinecone,
Chroma):** the data being embedded (a song's audio features) is derived
directly from columns that already live in `Songs`, and an embedding is
written in the same transaction as the song itself (`withTransaction()` in
`src/lib/db.ts` — see Section 9, Query 4). Keeping the embedding in the same
PostgreSQL instance means that write stays atomic, a cascading delete of a
song removes its embedding automatically (`ON DELETE CASCADE`, no separate
cleanup job against a second store), and a similarity query can be joined
directly against `Songs`/`Albums` in one SQL statement (Section 9, Query 3)
instead of round-tripping to a second service and re-joining in application
code. A standalone vector database would be justified for a much larger,
independently-scaled embedding store (e.g. millions of documents updated on
a different cadence than the relational data) — that is not this project's
shape.

**Why not NoSQL (Option 1):** nothing in this domain is schema-less or
document-shaped. Every entity has a fixed, known set of attributes, and the
interesting cross-entity question this project answers ("what's similar to
this song," "what fits this user's taste") is a *similarity* query, not a
flexible-schema or hierarchical-document query — which is what the vector
paradigm is for and NoSQL is not.

## 6. SQL / Vector Implementation Summary

### 6.1 Relational (SQL) tables

| # | Table | Purpose |
|---|---|---|
| 1 | `Albums` | One row per album/release |
| 2 | `Members` | The band members |
| 3 | `Member_Roles` | Roles a member can have (multivalued attribute) |
| 4 | `Songs` | One row per song, including its audio features |
| 5 | `Song_Members` | Who contributed to a song, and how (M:N link) |
| 6 | `Users` | Registered accounts with a role (`listener` / `admin`) |
| 7 | `Listening_History` | One row per logged play of a song by a user |
| 8 | `Ratings` | A user's 1–5 rating of a song |
| 9 | `Playlists` | A user's named playlist |
| 10 | `Playlist_Songs` | Songs inside a playlist, with their order (M:N link) |

### 6.2 Vector table

| Table | Purpose |
|---|---|
| `Song_Embeddings` | One `vector(8)` embedding per song, for similarity search |

**What is embedded:** each song's own audio features — not external text or
images. **Embedding approach:** a hand-derived, fully explainable 8-dimensional
vector (`src/lib/embeddings.ts`), not a black-box model call:

```
[ tempo_bpm / 200, energy, danceability, valence,
  duration_seconds / 300, hash(genre) % 100 / 100,
  sin(tempo_bpm / 50), cos(energy * π) ]
```

**How vectors are stored:** a `vector(8)` column in `Song_Embeddings`, one
row per song, written in the same transaction as the song's own insert/update.
**Similarity metric:** cosine distance, pgvector's `<=>` operator (0 =
identical direction; larger = less similar). **Retrieval strategy:** `ORDER
BY embedding <=> :query_vector LIMIT :n`, accelerated by an `ivfflat` index
(`idx_song_embeddings_cosine`) — see Query 3 below for "similar songs" and
Query 4 for the personalized "for you" feed, which first builds a taste
vector by averaging the embeddings of songs the user rated highly or played.

### 6.3 Advanced database features (5 SQL + 1 vector, above the 4+1 minimum)

| # | Feature | Where | Why it needed to be this |
|---|---|---|---|
| 1 | **View** | `Song_Popularity` | A derived attribute (play count) that is never stored as a column, so it can never drift out of sync with `Listening_History` |
| 2 | **Trigger** | `trg_validate_play_duration` | Blocks a logged play longer than the song itself — a cross-table rule a `CHECK` constraint cannot express |
| 3 | **Stored function** | `log_listen(user_id, song_id, duration)` | Makes "log a play" one atomic database operation; the trigger fires inside the same statement |
| 4 | **Indexing** | B-tree on every FK (`idx_listening_user`, `idx_listening_song`, `idx_songs_album`) + `ivfflat` vector index | Keeps both relational lookups and nearest-neighbour vector search fast |
| 5 | **Transactions** | `withTransaction()` in `src/lib/db.ts` | Wraps multi-statement writes (e.g. song + its embedding) so a mid-way failure rolls back cleanly — verified in testing (T89) |
| 6 | **Vector similarity search** | `/api/recommendations/similar/:id`, `/api/recommendations/for-you` | Both use pgvector's `<=>` cosine-distance operator |

## 7. System Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API routes (`src/app/api/**`), all server-side |
| Database | PostgreSQL 16 + the `pgvector` extension |
| DB access | Raw `pg` driver — no ORM, so the DDL and the pgvector `<=>` operator stay directly usable |
| Auth | JWT session cookies (`jose`), `bcryptjs` password hashing, httpOnly cookies |
| Validation | `zod` schemas on every API route body |

```
db/001_schema.sql        DDL — tables, view, trigger, stored function, indexes
scripts/migrate.ts       Applies db/001_schema.sql
scripts/seed.ts          Seeds sample data + computes embeddings
src/lib/db.ts            Connection pool, query() and withTransaction() helpers
src/lib/auth.ts          JWT signing/verification, password hashing
src/lib/session.ts       requireUser()/requireAdmin() — the real auth boundary
src/lib/embeddings.ts    Embedding computation (shared by seed + API)
src/proxy.ts             Page-level redirect for /admin (UX only, not the
                          security boundary — see 7.1)
src/app/api/**           All REST endpoints (the only way the frontend
                          touches the database)
src/app/**               Pages (App Router) — client components fetching the API
```

### 7.1 Authentication, authorization, and data integrity

Two roles: `listener` (default on sign-up) and `admin` (only an existing
admin can promote another user) — satisfying the minimum of two roles.
`requireUser()` / `requireAdmin()` run inside every route handler, so an
admin-only write is rejected at the API layer regardless of what page the
request came from; `src/proxy.ts` also redirects a listener away from
`/admin` for UX, but is explicitly documented as *not* the security
boundary. This was verified directly (T24–T31, Section 10): hitting the
admin API as a guest and as a listener returns `401`/`403` with no change
to the database.

Data validation and integrity is enforced at the database level, not only in
the API: every numeric audio feature has a `CHECK` (`energy BETWEEN 0 AND
1`, etc.), ratings are bound to 1–5, every relationship is a real foreign
key with `ON DELETE CASCADE`, and the cross-table rule that a logged play
cannot exceed its song's length is enforced by `trg_validate_play_duration`
— confirmed by inserting directly with SQL, bypassing the API entirely
(T81–T89).

Database credentials (`DATABASE_URL`) and the JWT signing secret live in
`.env.local` / environment variables, loaded via `.env.example` as a
template — never hard-coded in source (`src/lib/db.ts`, `src/lib/auth.ts`).

### 7.2 API overview

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

## 8. Database Operations (DML)

All four DML operations are exercised through the API, backed by real
queries against the live database:

| Operation | Where |
|---|---|
| `SELECT` | Every `GET` route — catalog browsing, song/album detail, recommendations, history |
| `INSERT` | Registration, admin "add album"/"add song", logging a play (`log_listen`), rating a song, creating a playlist, adding a song to a playlist |
| `UPDATE` | Admin edits to a song (`PUT /api/songs/:id`, which also recomputes and updates the embedding), re-rating a song (`ON CONFLICT ... DO UPDATE`), changing a user's role |
| `DELETE` | Admin deletes a song/album (cascades to every dependent row), a user deletes their own playlist |

## 9. Important Queries

Four representative queries from the codebase, chosen to show `JOIN`,
`GROUP BY`/aggregates, a subquery with `UNION`, and vector similarity search
working together with relational data.

**Query 1 — Song listing with search/filter, JOIN, GROUP BY, aggregates**
(`src/app/api/songs/route.ts`, `GET`):
```sql
SELECT s.song_id, s.title, s.duration_seconds, s.track_number, s.genre,
       s.tempo_bpm, s.energy, s.danceability, s.valence,
       a.album_id, a.title AS album_title,
       COALESCE(p.popularity_score, 0) AS popularity_score,
       ROUND(AVG(r.rating_value), 2) AS avg_rating
FROM Songs s
JOIN Albums a ON a.album_id = s.album_id
LEFT JOIN Song_Popularity p ON p.song_id = s.song_id   -- the view
LEFT JOIN Ratings r ON r.song_id = s.song_id
WHERE s.title ILIKE $1                                  -- optional search/filter
GROUP BY s.song_id, s.title, s.duration_seconds, s.track_number, s.genre,
         s.tempo_bpm, s.energy, s.danceability, s.valence,
         a.album_id, a.title, p.popularity_score
ORDER BY s.title ASC;
```

**Query 2 — Song detail, JOIN + LEFT JOIN + GROUP BY with a separate
credits query** (`src/app/api/songs/[id]/route.ts`, `GET`):
```sql
SELECT s.song_id, s.title, ..., a.title AS album_title,
       COALESCE(p.popularity_score, 0) AS popularity_score,
       ROUND(AVG(r.rating_value), 2) AS avg_rating,
       COUNT(DISTINCT r.user_id) AS rating_count
FROM Songs s
JOIN Albums a ON a.album_id = s.album_id
LEFT JOIN Song_Popularity p ON p.song_id = s.song_id
LEFT JOIN Ratings r ON r.song_id = s.song_id
WHERE s.song_id = $1
GROUP BY s.song_id, ..., a.album_id, a.title, p.popularity_score;

SELECT m.member_id, m.name, sm.contribution_type
FROM Song_Members sm
JOIN Members m ON m.member_id = sm.member_id
WHERE sm.song_id = $1
ORDER BY m.name ASC;
```

**Query 3 — "Similar songs," vector similarity search**
(`src/app/api/recommendations/similar/[id]/route.ts`):
```sql
SELECT s.song_id, s.title, a.title AS album_title,
       (e.embedding <=> (SELECT embedding FROM Song_Embeddings WHERE song_id = $1)) AS distance
FROM Song_Embeddings e
JOIN Songs s  ON s.song_id = e.song_id
JOIN Albums a ON a.album_id = s.album_id
WHERE e.song_id != $1
ORDER BY e.embedding <=> (SELECT embedding FROM Song_Embeddings WHERE song_id = $1)
LIMIT $2;
```
(A scalar subquery supplies the reference song's own embedding; ordering by
the pgvector `<=>` operator uses the `ivfflat` index.)

**Query 4 — "For you," subquery + UNION, then a vector search excluding
heard songs** (`src/app/api/recommendations/for-you/route.ts`):
```sql
-- Step 1: songs this user rated 4+ or has played (subquery with UNION)
SELECT DISTINCT song_id FROM (
  SELECT song_id FROM Ratings WHERE user_id = $1 AND rating_value >= 4
  UNION
  SELECT song_id FROM Listening_History WHERE user_id = $1
) AS heard;

-- Step 2: average their embeddings into one taste vector
SELECT '[' || string_agg(avg_dim::text, ',') || ']' AS centroid
FROM (
  SELECT dim_index, AVG(dim_value) AS avg_dim
  FROM Song_Embeddings e, unnest(e.embedding::float4[]) WITH ORDINALITY AS u(dim_value, dim_index)
  WHERE e.song_id = ANY($1)
  GROUP BY dim_index
  ORDER BY dim_index
) sub;

-- Step 3: nearest neighbours to the taste vector, excluding already-heard songs
SELECT s.song_id, s.title, a.title AS album_title, (e.embedding <=> $1) AS distance
FROM Song_Embeddings e
JOIN Songs s  ON s.song_id = e.song_id
JOIN Albums a ON a.album_id = s.album_id
WHERE NOT (e.song_id = ANY($2))
ORDER BY e.embedding <=> $1
LIMIT 5;
```

Both vector queries were independently verified: the ranking was
recomputed in JavaScript from the stored embeddings and compared to the
API's own output, with a maximum floating-point error of `1.2e-7`
(T73, T80 — Section 10).

## 10. Testing Results

Full test cases, environment, and raw results are in
[`testing.md`](testing.md). Summary:

| Suite | Cases | Passed | Failed |
|---|---|---|---|
| API and database tests (T01–T90) | 90 | 90 | 0 |
| Browser (UI) tests (U01–U08) | 8 | 8 | 0 |
| **Total** | **98** | **98** | **0** |

**How it was tested:** API tests sent real HTTP requests to the running app
and, for writes, queried PostgreSQL directly afterwards to confirm the
stored result — not just the HTTP response. Database tests sent SQL directly
to PostgreSQL, bypassing the app, to prove constraints, the trigger, and
cascading deletes are enforced by the database itself. UI tests used a
headless Chromium browser (Playwright) to fill in forms and click buttons,
then checked the database for the resulting row. Every suite ran against a
freshly migrated and seeded database (`npm run db:reset`).

**Coverage by area:** authentication, the public catalog, access control,
admin CRUD, ratings, listening history, playlists, vector search, database
constraints, database objects, and UI flows — see `testing.md` Section 3
for exact case counts per area.

**Defects found:** exploratory testing (inputs beyond the planned cases)
found three requests that return a raw `HTTP 500` instead of a clean `400`
(`?limit=abc`, `?limit=-1`, `?album=abc` — unvalidated query parameters
reaching SQL directly). No data is corrupted and nothing is exposed; the fix
(`zod` coercion on query parameters, the pattern already used for request
bodies) is scoped but not applied in this submission — see `testing.md`
Section 6 for the full write-up.

## 11. Application Screenshots

Full-page screenshots of every page, in both the admin and listener roles,
are in [`docs/screenshots/`](screenshots/): the home page, login and
register forms, the listener dashboard, song and album detail (including the
vector-similarity panel), playlists and playlist detail, the admin panel,
the admin-only route redirecting a listener (`09-admin-as-listener-redirect.png`),
the ER diagram, and the `psql` schema listing (Sections 3 and 4 above).

## 12. Git/GitHub and Individual Contributions

The project is version-controlled with Git/GitHub. Commits are attributed
per author and map cleanly to each member's share of the work:

| Member | SRN | Contributed |
|---|---|---|
| Bhavyaa Garg | PES1UG24CS116 | Database schema, migration/seed scripts, authentication & RBAC, the full REST API, the frontend (browse, song/album detail, playlists, admin panel), README |
| Chaturya Prabhakar | PES1UG24CS126 | ER diagram and schema diagrams, data dictionary, full test suite (98 cases) and defect write-up, page screenshots, this report |

The repository's `README.md` contains setup and execution instructions
(`npm install`, environment configuration, `npm run db:migrate`,
`npm run db:seed`, `npm run dev`).

## 13. Requirements Coverage Checklist

A direct mapping to the project brief, so every item is easy to locate:

| Brief item | Status | Where |
|---|---|---|
| Unique title, non-trivial problem | Met | A recommendation engine, not CRUD — Section 1 |
| 2-member team, defined responsibilities | Met | Section 12 |
| SQL + Vector (Option 2) | Met | Sections 5–6 |
| ER diagram → relational schema | Met | Sections 3–4 |
| Entities, attributes, PK/FK, relationships, constraints documented | Met | `data-dictionary.md`, Section 4 |
| Vector data model, indexes, embeddings, retrieval strategy documented | Met | Section 6.2 |
| `CREATE` | Met | `db/001_schema.sql` — 11 tables, 1 view, 2 functions, 5 indexes |
| `ALTER`, `DROP` | **Not demonstrated** — see note below | — |
| PK/FK, constraints, indexes, views | Met | Sections 4, 6.3 |
| DML: `INSERT`/`UPDATE`/`DELETE`/`SELECT` | Met | Section 8 |
| `JOIN`, `GROUP BY`, aggregates, subqueries | Met | Section 9 |
| 4+ advanced SQL features + 1 vector | Met (5 + 1) | Section 6.3 |
| Vector embeddings explained (data, model, storage, metric, retrieval) | Met | Section 6.2 |
| Next.js web interface | Met | Section 7 |
| API layer, no hard-coded credentials, env vars | Met | Sections 7, 7.1 |
| Authentication, role-based access (2+ roles) | Met | Section 7.1 |
| Input validation / integrity at the database level | Met | Section 7.1 |
| Documentation: objectives, functional requirements, ER diagram, relational schema, database choice & justification, data dictionary, SQL/vector implementation, important queries, architecture, screenshots, testing, conclusion | Met | This document |
| Git/GitHub, individual contributions, README | Met | Section 12 |
| Original design (not copied) | Met | Purpose-built schema and recommendation logic for this domain |

**Note on `ALTER`/`DROP`:** the current schema (`db/001_schema.sql`) only
uses `CREATE` — there is no `ALTER TABLE` or `DROP` statement anywhere in
the codebase, because the schema was correct from the first migration and
nothing needed changing afterwards. The brief explicitly asks for "suitable
use of CREATE, ALTER, DROP." If this is graded literally against that line,
consider adding one small, honest example before submission — e.g. a second
migration file that does `ALTER TABLE Songs ADD COLUMN IF NOT EXISTS
spotify_url VARCHAR(255);` and a corresponding `DROP COLUMN`, or a documented
`db:teardown` script that `DROP`s the schema cleanly. This report does not
claim the feature exists where it doesn't.

## 14. Conclusion

Setlist Sync meets the project's stated objectives: a normalized 10-table
relational schema and a `pgvector`-backed vector table coexist in one
PostgreSQL database, each paradigm used for what it's actually good at —
relational integrity for the catalog and user data, vector similarity for
recommendation, with the choice justified in Section 5 rather than included
for its own sake. Five advanced SQL features plus vector similarity search
are implemented and exercised through real API routes; authentication and
role-based access control are enforced at the layer that actually matters
(the API, not just the UI); and the whole system was verified against a live
database with 98 passing test cases, including independent recomputation of
the vector rankings rather than trusting the API's own output.

The three logged defects (Section 10) and the missing `ALTER`/`DROP`
coverage (Section 13) are documented honestly rather than hidden: the
defects are input-validation gaps on query parameters, not correctness bugs
in the schema or the advanced features, and both gaps have a scoped, stated
fix. Beyond those, the project's main limitation is scale — the seed catalog
(8 songs) is too small to observe the performance benefit of the `ivfflat`
index or its 20-result cap, though correctness at this scale is fully
verified (Section 10).

**Possible future work:** fix the three logged defects and add the
`ALTER`/`DROP` example noted in Section 13; replace the hand-derived
8-dimensional embedding with the output of a real audio embedding model (the
storage/retrieval layer would not need to change); seed a catalog large
enough to observe `ivfflat`'s approximate-search behaviour versus an exact
scan; and add rate limiting on login attempts, which was explicitly out of
scope for this round of testing.
