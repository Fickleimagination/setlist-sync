# Testing — Setlist Sync

## 1. Summary

| Suite | Cases | Passed | Failed |
|---|---|---|---|
| API and database tests (T01–T90) | 90 | 90 | 0 |
| Browser (UI) tests (U01–U08) | 8 | 8 | 0 |
| **Total** | **98** | **98** | **0** |

All 98 planned cases passed. In addition, exploratory testing found
**3 defects** (unvalidated query parameters that cause HTTP 500 instead of 400) —
see [Section 6](#6-defects-found). These were not part of the planned cases and
are **not fixed** in this documentation change.

## 2. How the testing was done

- **API tests:** a script sent real HTTP requests to the running Next.js app
  (`http://localhost:3000`) and, where a request should change the database,
  queried PostgreSQL directly afterwards to confirm the stored result (not just
  the HTTP response). Each case has its expected result written down before it
  was run; the "Actual" column is what the app really returned.
- **Database tests:** SQL statements sent directly to PostgreSQL, bypassing the
  application, to prove that constraints, the trigger and cascades are enforced
  by the database itself.
- **Independent check of the vector search:** for T73 and T80 the expected
  ranking was recomputed in JavaScript from the stored embeddings (cosine
  distance formula) and compared with what the API returned.
- **UI tests:** a headless Chromium browser (Playwright) filled in forms and
  clicked buttons; the database was then queried to confirm the effect.
- Every suite was run against a **freshly created and seeded database**
  (`npm run db:reset`), so results do not depend on leftover data.

### Environment

| Item | Value |
|---|---|
| Date of run | 26 October 2026 |
| App | Setlist Sync, Next.js 16.4.3 (`npm run dev`), Node.js 22 |
| Database | PostgreSQL 16.15 |
| pgvector | 0.6.0 (the Ubuntu package on the test machine; the team's Mac has 0.8.7. The features this project uses — the `vector(8)` type, the `<=>` operator and the `ivfflat` index — exist in both, but the tests were run only on 0.6.0) |
| Test data | The standard seed: 5 albums, 5 members, 8 songs, 4 users, 10 plays, 6 ratings, 2 playlists |

### Demo accounts used

| Username | Password | Role | user_id |
|---|---|---|---|
| `bhavyaa` | `admin123` | admin | 1 |
| `fan_alex` | `listener123` | listener | 3 |
| `fan_priya` | `listener123` | listener | 4 |

Extra accounts created by the tests (`test_user1`, `sneaky`) were removed by
resetting the database after the run.

## 3. Results by area

| Area | Cases | Passed |
|---|---|---|
| Authentication | 14 | 14 |
| Catalog (public) | 9 | 9 |
| Access control | 8 | 8 |
| Admin CRUD | 14 | 14 |
| Ratings | 6 | 6 |
| Listening history | 8 | 8 |
| Playlists | 12 | 12 |
| Vector search | 9 | 9 |
| Database constraints | 9 | 9 |
| Database objects | 1 | 1 |
| Browser (UI) | 8 | 8 |

## 4. API and database test cases

### 4.1 Authentication

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T01 | Register a new user with valid data | 200; role = listener; session cookie set | 200; role = listener; cookie set | Pass |
| T02 | Register with an already-used username | 409 "Username or email already in use" | 409 "Username or email already in use" | Pass |
| T03 | Register with a password shorter than 8 characters | 400 validation error | 400 | Pass |
| T04 | Register with an invalid email | 400 validation error | 400 | Pass |
| T05 | Register tries to self-assign admin (extra field `role: "admin"`) | Account is created as listener, not admin | 200; role in DB = listener | Pass |
| T06 | Log in with correct credentials (fan_alex) | 200; role = listener; session cookie set | 200; role = listener | Pass |
| T07 | Log in with a wrong password | 401 "Invalid username or password" | 401 "Invalid username or password" | Pass |
| T08 | Log in with an unknown username (same error as T07, no user enumeration) | 401 with the identical message | 401 "Invalid username or password" | Pass |
| T09 | Log in with an empty body | 400 | 400 | Pass |
| T10 | GET /api/auth/me without a session | 200 with user = null | 200; user = null | Pass |
| T11 | GET /api/auth/me after login | user.username = fan_alex, role listener | 200; fan_alex, listener | Pass |
| T12 | Session cookie is HttpOnly and SameSite=Lax | Set-Cookie contains HttpOnly and SameSite=lax | Set-Cookie includes `HttpOnly` and `SameSite=lax` (Max-Age 604800 s = 7 days) | Pass |
| T13 | Passwords are stored as bcrypt hashes, not plain text | password_hash starts with $2 and is not the plain password | hash prefix $2b$, length 60 | Pass |
| T14 | Log out clears the session | After logout, /api/auth/me returns user = null | logout 200; me.user = null | Pass |

### 4.2 Catalog (public)

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T15 | List all songs without logging in | 200; 8 songs | 200; 8 songs | Pass |
| T16 | Search songs: ?search=night (case-insensitive substring) | 2 songs: "Midnight Memories" and "Night Changes" | Midnight Memories, Night Changes | Pass |
| T17 | Filter songs by genre: ?genre=pop (exact match) | Only songs whose genre is exactly "pop" (4 songs) | 4 songs; DB count = 4 | Pass |
| T18 | Filter songs by album | Only songs of that album | Midnight Memories, Story of My Life | Pass |
| T19 | SQL-injection attempt in search: ?search=' OR 1=1 -- | 200 and 0 songs (input is parameterised, not executed) | 200; 0 songs | Pass |
| T20 | Song detail for song 1 | 200; title "What Makes You Beautiful"; 5 vocalist credits; popularity 3; 5.00 avg rating | 200; "What Makes You Beautiful"; 5 credits; popularity 3; avg 5.00; 1 rating(s) | Pass |
| T21 | Song detail for a non-existent id (9999) | 404 "Song not found" | 404 "Song not found" | Pass |
| T22 | Song detail with a non-numeric id (abc) | 400 "Invalid song id" | 400 "Invalid song id" | Pass |
| T23 | List albums and members | 5 albums and 5 members | 5 albums, 5 members | Pass |

### 4.3 Access control

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T24 | Guest tries to create a song | 401 "Not authenticated" | 401 "Not authenticated" | Pass |
| T25 | Listener tries to create a song | 403 "Admin access required" | 403 "Admin access required" | Pass |
| T26 | Listener tries to create an album | 403 | 403 | Pass |
| T27 | Listener tries to delete a song | 403 and the song still exists | 403; song 1 rows = 1 | Pass |
| T28 | Listener tries to change a user role (promote self) | 403 and role unchanged | 403; role in DB = listener | Pass |
| T29 | Guest opens the /admin page | Redirected (3xx) to /login | 307 -> /login | Pass |
| T30 | Listener opens the /admin page | Redirected (3xx) to /login | 307 -> /login | Pass |
| T31 | Admin opens the /admin page | 200 | 200 | Pass |

### 4.4 Admin CRUD

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T32 | Admin creates an album | 201 with the new album | 201; album_id 6 | Pass |
| T33 | Admin creates the same album again (same title + date) | 409 duplicate | 409 "An album with this title and release date already exists" | Pass |
| T34 | Admin creates an album with an invalid album_type | 400 | 400 | Pass |
| T35 | Admin creates a song (song row + embedding in one transaction) | 201; a Song_Embeddings row exists for the new song | 201; embedding stored: yes (8 dims) | Pass |
| T36 | Admin creates a song with energy = 1.5 (out of 0-1 range) | 400 and no row inserted | 400; songs 9 -> 9 | Pass |
| T37 | Admin creates a song with a non-existent album_id | 400 "album_id does not reference an existing album" | 400 "album_id does not reference an existing album" | Pass |
| T38 | Admin edits the song's audio features | 200; embedding is recomputed (dimension 2 = new energy 0.9) and updated_at changes | 200; energy dim 0.5 -> 0.90; updated_at changed | Pass |
| T39 | Admin edits only the title (no audio feature) | 200; embedding NOT recomputed (updated_at unchanged) | 200; updated_at unchanged | Pass |
| T40 | Admin edits a song with an empty body | 400 "No fields to update" | 400 "No fields to update" | Pass |
| T41 | Admin deletes the song | 200; its embedding row is deleted by cascade | 200; embedding rows left = 0 | Pass |
| T42 | Admin deletes a non-existent song | 404 | 404 | Pass |
| T43 | Admin promotes fan_priya to admin, then demotes back | 200 both times; role in DB changes accordingly | 200 -> admin; 200 -> listener | Pass |
| T44 | Admin sets an invalid role value | 400 | 400 | Pass |
| T45 | Deleting an album cascades to its songs and their embeddings | Album, its songs and their embeddings all removed | delete 200; songs left 0; embeddings left 0 | Pass |

### 4.5 Ratings

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T46 | Guest rates a song | 401 | 401 | Pass |
| T47 | Listener rates a song they have not rated (song 5, value 3) | 200; one row (user 3, song 5, 3) | 200; rows = 1; value = 3 | Pass |
| T48 | Same listener re-rates the same song (value 5) | 200; still ONE row, value updated to 5 (upsert) | 200; rows = 1; value = 5 | Pass |
| T49 | Rating value 6 (out of 1-5) | 400 | 400 | Pass |
| T50 | Rating value 0 | 400 | 400 | Pass |
| T51 | Rate a non-existent song | 400 "song_id does not reference an existing song" | 400 "song_id does not reference an existing song" | Pass |

### 4.6 Listening history

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T52 | Guest logs a play | 401 | 401 | Pass |
| T53 | Listener logs a valid play (song 2, 100 s of 164 s) via log_listen() | 201 with a historyId; popularity of song 2 goes 0 -> 1 in the Song_Popularity view | 201; historyId 11; view rows before 0, popularity after 1 | Pass |
| T54 | Play duration longer than the song (song 2 is 164 s; log 999 s) — trigger | 400 with the trigger message; NO row inserted | 400 "play_duration_seconds (999) cannot exceed the song's duration_seconds (164)"; rows 11 -> 11 | Pass |
| T55 | Play duration exactly equal to the song length (164 s) | 201 (boundary value allowed) | 201 | Pass |
| T56 | Negative play duration (-5) | 400 | 400 | Pass |
| T57 | Log a play for a non-existent song | 400 "song_id does not reference an existing song" | 400 "song_id does not reference an existing song" | Pass |
| T58 | GET own history | 200; newest first; only this user's plays | 200; 5 rows; newest-first = true | Pass |
| T59 | View Song_Popularity equals COUNT(*) of Listening_History for every song | No differences | 5 songs compared, 0 differences | Pass |

### 4.7 Playlists

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T60 | Guest lists playlists | 401 | 401 | Pass |
| T61 | Listener creates a playlist | 201 | 201; playlist_id 3 | Pass |
| T62 | Create a playlist with an empty name | 400 | 400 | Pass |
| T63 | Add two songs; positions are assigned 1 then 2 | 201 twice; position_order 1 and 2 | 201 pos 1; 201 pos 2 | Pass |
| T64 | Add the same song twice | 409 "Song already in this playlist" | 409 "Song already in this playlist" | Pass |
| T65 | Add a non-existent song | 400 | 400 | Pass |
| T66 | Another listener (fan_priya) reads fan_alex's playlist | 403 "Not your playlist" | 403 "Not your playlist" | Pass |
| T67 | Another listener tries to add a song to fan_alex's playlist | 403 | 403 | Pass |
| T68 | Another listener tries to delete fan_alex's playlist | 403 and the playlist still exists | 403; rows = 1 | Pass |
| T69 | Admin reads fan_alex's playlist | 200 with 2 songs in order | 200; What Makes You Beautiful > Story of My Life | Pass |
| T70 | Read a non-existent playlist | 404 | 404 | Pass |
| T71 | Owner deletes the playlist | 200; playlist and its Playlist_Songs rows are gone (cascade); a follow-up GET returns 404 | 200; playlist_songs left 0; GET -> 404 | Pass |

### 4.8 Vector search

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T72 | Similar songs to song 1 (default limit) | 5 results; sorted by ascending cosine distance; song 1 itself excluded | 200; 5 results: Live While We're Young (0.002), Steal My Girl (0.022), Perfect (0.072), Story of My Life (0.112), Midnight Memories (0.150) | Pass |
| T73 | Independent check: recompute cosine distances in JavaScript from the stored embeddings and compare to the API ranking | Same songs in the same order, distances equal within 1e-6 | order match = true; max distance error = 1.2e-7 | Pass |
| T74 | Similar songs with ?limit=2 | Exactly 2 results | 2 results | Pass |
| T75 | Similar songs with ?limit=500 (request accepted) | 200 and all 7 other songs (the code caps the limit at 20, but the catalogue has only 8 songs, so the cap itself cannot be observed) | 7 results | Pass |
| T76 | Similar songs for a non-existent song | 404 | 404 | Pass |
| T77 | Cosine distance of a song to itself | 0 (identical vectors) | 0 | Pass |
| T78 | "For you" without login | 401 | 401 | Pass |
| T79 | "For you" for a brand-new user with no ratings or plays | 200; empty list and the message "Listen to or rate some songs first..." | 200; 0 results; message: "Listen to or rate some songs first to get personalized recommendations." | Pass |
| T80 | "For you" for fan_priya: matches an independent computation and never recommends heard songs | Same top-5 ranking as a JavaScript recomputation of the taste vector; no heard/rated-4+ song in the list | heard = {7,1,4}; API: Steal My Girl, Live While We're Young, Story of My Life, Perfect, Night Changes; ranking match = true; heard songs leaked = false | Pass |

### 4.9 Database constraints

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T81 | Insert a rating of 9 directly with SQL | Rejected by CHECK constraint (SQLSTATE 23514) | 23514 ratings_rating_value_check | Pass |
| T82 | Insert a song with energy 2 directly with SQL | Rejected by CHECK constraint (23514) | 23514 songs_energy_check | Pass |
| T83 | Insert a song for a non-existent album directly with SQL | Rejected by foreign key (23503) | 23503 | Pass |
| T84 | Insert a user with a duplicate username directly with SQL | Rejected by UNIQUE (23505) | 23505 | Pass |
| T85 | Insert a user with role "owner" directly with SQL | Rejected by CHECK constraint (23514) | 23514 | Pass |
| T86 | Insert a play longer than the song directly with SQL (trigger fires even without the API) | Rejected by trigger (SQLSTATE P0001 "cannot exceed") | P0001 play_duration_seconds (9999) cannot exceed the song's duration_seconds (197) | Pass |
| T87 | Insert an embedding with the wrong number of dimensions (3 instead of 8) | Rejected: expected 8 dimensions | expected 8 dimensions, not 3 | Pass |
| T88 | Delete a user cascades to their ratings, plays and playlists | All dependent rows removed | dependent rows left = 0 | Pass |
| T89 | Transaction rollback at the database level: a failed second statement undoes the first | Song insert + failing embedding insert rolls back the song too | songs 8 -> 8 | Pass |

### 4.10 Database objects

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T90 | Vector index and B-tree indexes exist | idx_song_embeddings_cosine (ivfflat), idx_listening_user, idx_listening_song, idx_songs_album | idx_listening_song, idx_listening_user, idx_song_embeddings_cosine, idx_songs_album \| ivfflat | Pass |

## 5. Browser (UI) test cases

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| U01 | Login form with a wrong password | Error text shown, stays on /login | url /login; error visible = true | Pass |
| U02 | Login form with correct credentials | Redirected away from /login; navbar shows fan_alex (listener) | url /dashboard; navbar shows fan_alex = true | Pass |
| U03 | Click "Log a play" on a song page | A new Listening_History row is created for the user | plays 0 -> 1 | Pass |
| U04 | Click the 4th star on a song page | A rating of 4 is saved for the user | rating in DB = 4 | Pass |
| U05 | Choose a playlist in "Add to playlist…" | The song is added to that playlist | options: Add to playlist… \| Road Trip Anthems; rows for song 4 in user's playlists = 1 | Pass |
| U06 | Create a playlist from the Playlists page | Playlist row created and listed on the page | rows = 1; listed on page = true | Pass |
| U07 | Click "Log out" | Session ends; /api/auth/me returns user = null | user = null | Pass |
| U08 | Open /admin after logging out | Redirected to /login | url /login | Pass |

Screenshots of the pages exercised above are in [`docs/screenshots/`](screenshots/):
`02-login.png`, `04-dashboard-listener.png`, `05-song-detail.png`,
`07-playlists.png`, `08-playlist-detail.png`, `09-admin-as-listener-redirect.png`
(a listener sent away from `/admin`) and `11-admin-panel.png`.

## 6. Defects found

Exploratory testing (inputs the planned cases did not cover) found three
requests that make the server crash with **HTTP 500** where a clean
**HTTP 400** should be returned. No data is corrupted and nothing is exposed;
the request simply fails with a generic error.

| # | Request | Expected | Actual | Cause |
|---|---|---|---|---|
| D1 | `GET /api/recommendations/similar/1?limit=abc` | 400 invalid limit | **500** | `Number("abc")` is `NaN`, which is passed to SQL `LIMIT` (`invalid input syntax for type bigint: "NaN"`) |
| D2 | `GET /api/recommendations/similar/1?limit=-1` | 400 invalid limit | **500** | Negative value passed to SQL `LIMIT` (`LIMIT must not be negative`) |
| D3 | `GET /api/songs?album=abc` | 400 invalid album id | **500** | `Number("abc")` is `NaN`, passed as an integer parameter (`invalid input syntax for type integer: "NaN"`) |

**Suggested fix** (not applied): validate the query parameters the same way the
request bodies are validated, e.g. with `zod`
(`z.coerce.number().int().min(1).max(20)` for `limit`,
`z.coerce.number().int()` for `album`) and return 400 when parsing fails.
The routes that take an id in the URL (`/api/songs/abc`, `/api/albums/abc`)
already do this correctly (T22 and the album equivalent return 400).

## 7. Limits of this testing

- **Small catalogue.** The seed has only 8 songs. Results of the similarity
  search are verified for correctness (T73, T80), but the speed benefit of the
  `ivfflat` index and the cap of 20 results (T75) cannot be observed at this
  size.
- **T89** proves rollback behaviour of PostgreSQL transactions with a failing
  second statement. It does not call the application's own `withTransaction()`
  helper directly; the admin "create song" path that uses it is covered by T35
  (success) and T36–T37 (failure, no partial row).
- **UI coverage.** The browser tests cover login/logout, logging a play,
  rating, adding to a playlist and creating a playlist. The admin panel forms
  were checked through the API (T32–T45) and by screenshot, not by clicking
  each form in the browser.
- **Not tested:** performance under load, concurrent users, rate limiting of
  login attempts, and browsers other than Chromium.
