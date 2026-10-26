# Data Dictionary — Setlist Sync

Source of truth: `db/001_schema.sql` (PostgreSQL 16 + pgvector).
Every table, column, constraint, index and database object is listed below.

**Conventions**
- **PK** = primary key, **FK** = foreign key, **NN** = `NOT NULL`, **UQ** = unique.
- "Nullable" means the column may be `NULL` (no `NOT NULL` constraint in the DDL).
- SQL keywords and identifiers are case-insensitive in PostgreSQL; the DDL
  writes table names capitalised (`Songs`) but PostgreSQL stores them in
  lower case (`songs`).

---

## Summary of tables

| # | Table | Paradigm | Purpose |
|---|---|---|---|
| 1 | `Albums` | SQL | One row per album/release |
| 2 | `Members` | SQL | The band members |
| 3 | `Member_Roles` | SQL | Roles a member can have (multivalued attribute of Members) |
| 4 | `Songs` | SQL | One row per song, including its audio features |
| 5 | `Song_Members` | SQL | Who contributed to a song, and how (M:N link) |
| 6 | `Users` | SQL | Registered accounts with a role (`listener` / `admin`) |
| 7 | `Listening_History` | SQL | One row per logged play of a song by a user |
| 8 | `Ratings` | SQL | A user's 1–5 rating of a song |
| 9 | `Playlists` | SQL | A user's named playlist |
| 10 | `Playlist_Songs` | SQL | Songs inside a playlist, with their order (M:N link) |
| 11 | `Song_Embeddings` | Vector | One 8-dimensional embedding per song, for similarity search |

Tables 1–10 are the relational (SQL) model. Table 11 is the vector model.
Both live in the same PostgreSQL database.

---

## 1. `Albums`

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `album_id` | `SERIAL` | PK | Unique identifier of the album (auto-incrementing integer) |
| `title` | `VARCHAR(150)` | NN | Album title, e.g. "Midnight Memories" |
| `release_date` | `DATE` | NN | Date the album was released |
| `album_type` | `VARCHAR(30)` | `CHECK` in (`studio`, `live`, `compilation`); nullable | Kind of release |

Table constraint: `UNIQUE (title, release_date)` — the same title cannot be
inserted twice with the same release date.

## 2. `Members`

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `member_id` | `SERIAL` | PK | Unique identifier of the band member |
| `name` | `VARCHAR(100)` | NN | Full name, e.g. "Harry Styles" |

## 3. `Member_Roles`

A member can hold several roles (for example vocalist *and* songwriter). A
multivalued attribute cannot be a column on `Members`, so it is its own table.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `member_id` | `INT` | PK (part), FK → `Members(member_id)` `ON DELETE CASCADE` | The member who holds the role |
| `role` | `VARCHAR(50)` | PK (part), NN | The role, e.g. `vocalist`, `songwriter`, `guitarist` |

Primary key: `(member_id, role)`.

## 4. `Songs`

`Audio_Features` is a composite attribute of Song in the ER diagram, so its
components (`tempo_bpm`, `energy`, `danceability`, `valence`) are columns of
this table rather than a separate table.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `song_id` | `SERIAL` | PK | Unique identifier of the song |
| `title` | `VARCHAR(150)` | NN | Song title |
| `duration_seconds` | `INT` | `CHECK (duration_seconds > 0)`; nullable | Length of the song in seconds |
| `track_number` | `INT` | `CHECK (track_number > 0)`; nullable | Position of the song on its album |
| `album_id` | `INT` | NN, FK → `Albums(album_id)` `ON DELETE CASCADE` | The album the song belongs to |
| `tempo_bpm` | `NUMERIC(5,2)` | nullable | Tempo in beats per minute (e.g. `124.00`) |
| `energy` | `NUMERIC(3,2)` | `CHECK (energy BETWEEN 0 AND 1)`; nullable | How intense/active the song feels, 0 (calm) to 1 (energetic) |
| `danceability` | `NUMERIC(3,2)` | `CHECK (danceability BETWEEN 0 AND 1)`; nullable | How suitable the song is for dancing, 0 to 1 |
| `valence` | `NUMERIC(3,2)` | `CHECK (valence BETWEEN 0 AND 1)`; nullable | Musical positivity, 0 (sad/dark) to 1 (happy) |
| `genre` | `VARCHAR(50)` | nullable | Genre label, e.g. `pop`, `pop rock`, `folk pop` |

Deleting an album deletes all of its songs (`ON DELETE CASCADE`).

## 5. `Song_Members`

Links songs to the members who contributed, and records the kind of contribution.

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `song_id` | `INT` | PK (part), FK → `Songs(song_id)` `ON DELETE CASCADE` | The song |
| `member_id` | `INT` | PK (part), FK → `Members(member_id)` `ON DELETE CASCADE` | The contributing member |
| `contribution_type` | `VARCHAR(50)` | PK (part), NN | Kind of contribution, e.g. `vocalist`, `songwriter` |

Primary key: `(song_id, member_id, contribution_type)` — one member may
contribute to one song in several ways.

## 6. `Users`

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `user_id` | `SERIAL` | PK | Unique identifier of the account |
| `username` | `VARCHAR(50)` | UQ, NN | Login name |
| `email` | `VARCHAR(120)` | UQ, NN | Email address (must be unique) |
| `password_hash` | `VARCHAR(255)` | NN | bcrypt hash of the password. The plain password is never stored |
| `role` | `VARCHAR(20)` | NN, default `'listener'`, `CHECK` in (`listener`, `admin`) | Access level. New sign-ups are always `listener`; only an admin can promote someone to `admin` |
| `created_at` | `TIMESTAMP` | default `CURRENT_TIMESTAMP`; nullable | When the account was created |

## 7. `Listening_History`

One row each time a user plays a song. Written through the `log_listen()`
function (see below).

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `history_id` | `SERIAL` | PK | Unique identifier of the play event |
| `user_id` | `INT` | NN, FK → `Users(user_id)` `ON DELETE CASCADE` | Who played the song |
| `song_id` | `INT` | NN, FK → `Songs(song_id)` `ON DELETE CASCADE` | Which song was played |
| `played_at` | `TIMESTAMP` | default `CURRENT_TIMESTAMP`; nullable | When the play happened |
| `play_duration_seconds` | `INT` | `CHECK (play_duration_seconds >= 0)`; nullable | How many seconds were listened to. The trigger `trg_validate_play_duration` rejects a value larger than the song's `duration_seconds` |

## 8. `Ratings`

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `user_id` | `INT` | PK (part), FK → `Users(user_id)` `ON DELETE CASCADE` | The user who rated |
| `song_id` | `INT` | PK (part), FK → `Songs(song_id)` `ON DELETE CASCADE` | The song rated |
| `rating_value` | `INT` | NN, `CHECK (rating_value BETWEEN 1 AND 5)` | The star rating, 1 to 5 |
| `rated_at` | `TIMESTAMP` | default `CURRENT_TIMESTAMP`; nullable | When the rating was given or last changed |

Primary key: `(user_id, song_id)` — a user has at most one rating per song.
Re-rating updates the existing row (`ON CONFLICT ... DO UPDATE` in the API).

## 9. `Playlists`

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `playlist_id` | `SERIAL` | PK | Unique identifier of the playlist |
| `user_id` | `INT` | NN, FK → `Users(user_id)` `ON DELETE CASCADE` | The owner |
| `playlist_name` | `VARCHAR(100)` | NN | Name chosen by the user |
| `created_at` | `TIMESTAMP` | default `CURRENT_TIMESTAMP`; nullable | When the playlist was created |

## 10. `Playlist_Songs`

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `playlist_id` | `INT` | PK (part), FK → `Playlists(playlist_id)` `ON DELETE CASCADE` | The playlist |
| `song_id` | `INT` | PK (part), FK → `Songs(song_id)` `ON DELETE CASCADE` | The song in the playlist |
| `position_order` | `INT` | NN | The song's position within the playlist (1, 2, 3, …) |

Primary key: `(playlist_id, song_id)` — a song can appear in a given playlist
only once.

## 11. `Song_Embeddings` (vector paradigm)

| Column | Type | Constraints | Meaning |
|---|---|---|---|
| `song_id` | `INT` | PK, FK → `Songs(song_id)` `ON DELETE CASCADE` | The song this embedding describes (one embedding per song) |
| `embedding` | `vector(8)` | NN | 8-dimensional vector computed from the song's audio features (see below) |
| `updated_at` | `TIMESTAMP` | default `CURRENT_TIMESTAMP`; nullable | When the embedding was last (re)computed |

**What the 8 dimensions are** (from `src/lib/embeddings.ts`), in order:

| Dim | Value | Derived from |
|---|---|---|
| 1 | `tempo_bpm / 200` | `Songs.tempo_bpm` |
| 2 | `energy` | `Songs.energy` |
| 3 | `danceability` | `Songs.danceability` |
| 4 | `valence` | `Songs.valence` |
| 5 | `duration_seconds / 300` | `Songs.duration_seconds` |
| 6 | `(hash(genre) mod 100) / 100` | `Songs.genre` |
| 7 | `sin(tempo_bpm / 50)` | `Songs.tempo_bpm` |
| 8 | `cos(energy × π)` | `Songs.energy` |

**Similarity metric:** cosine distance, the pgvector `<=>` operator.
0 means identical direction; larger means less similar.

---

## Non-table database objects

### View: `Song_Popularity`
Derived attribute — never stored as a column.

| Column | Type | Meaning |
|---|---|---|
| `song_id` | `INT` | The song |
| `popularity_score` | `BIGINT` | Number of rows in `Listening_History` for the song (its play count). Songs with no plays do not appear in the view |

### Trigger: `trg_validate_play_duration`
`BEFORE INSERT OR UPDATE` on `Listening_History`, per row. Calls
`fn_validate_play_duration()`, which looks up the song's `duration_seconds` and
raises an exception if `play_duration_seconds` is larger. A `CHECK` constraint
cannot do this because the rule compares a column against another table.

### Function: `log_listen(p_user_id INT, p_song_id INT, p_duration INT) RETURNS INT`
Inserts one row into `Listening_History` and returns the new `history_id`. The
API calls this single function to log a play, and the trigger above fires
inside the same insert.

### Indexes

| Index | Table (column) | Type | Purpose |
|---|---|---|---|
| (primary key and unique indexes) | every table | B-tree | Created automatically for each `PRIMARY KEY` and `UNIQUE` constraint |
| `idx_listening_user` | `Listening_History(user_id)` | B-tree | Fast lookup of a user's history |
| `idx_listening_song` | `Listening_History(song_id)` | B-tree | Fast play counts per song (feeds the view) |
| `idx_songs_album` | `Songs(album_id)` | B-tree | Fast lookup of an album's songs |
| `idx_song_embeddings_cosine` | `Song_Embeddings(embedding)` | `ivfflat`, `vector_cosine_ops`, `lists = 1` | Approximate nearest-neighbour search by cosine distance. `lists = 1` keeps results exact for a small catalogue |

### Extension
`vector` (pgvector) — provides the `vector` type, the `<=>` operator and the
`ivfflat` index method.

---

## Relationships (foreign keys)

| Child table.column | Parent table.column | Cardinality | On delete |
|---|---|---|---|
| `Songs.album_id` | `Albums.album_id` | many songs : one album | CASCADE |
| `Member_Roles.member_id` | `Members.member_id` | many roles : one member | CASCADE |
| `Song_Members.song_id` | `Songs.song_id` | M:N via link table | CASCADE |
| `Song_Members.member_id` | `Members.member_id` | M:N via link table | CASCADE |
| `Listening_History.user_id` | `Users.user_id` | many plays : one user | CASCADE |
| `Listening_History.song_id` | `Songs.song_id` | many plays : one song | CASCADE |
| `Ratings.user_id` | `Users.user_id` | many ratings : one user | CASCADE |
| `Ratings.song_id` | `Songs.song_id` | many ratings : one song | CASCADE |
| `Playlists.user_id` | `Users.user_id` | many playlists : one user | CASCADE |
| `Playlist_Songs.playlist_id` | `Playlists.playlist_id` | M:N via link table | CASCADE |
| `Playlist_Songs.song_id` | `Songs.song_id` | M:N via link table | CASCADE |
| `Song_Embeddings.song_id` | `Songs.song_id` | one embedding : one song | CASCADE |
