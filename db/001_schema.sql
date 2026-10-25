-- =====================================================================
-- Setlist Sync — DBMS Level 3 Project
-- DDL: PostgreSQL syntax (Option 2: SQL + Vector, both via Postgres/pgvector)
--
-- PES1UG24CS116 : Bhavyaa Garg
-- PES1UG24CS126 : Chaturya Prabhakar
-- =====================================================================

-- Enables the vector database paradigm: embeddings stored and queried
-- (cosine distance) inside the same Postgres instance as the SQL tables.
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- SECTION 1: Core relational schema (validated against the ER diagram)
-- =====================================================================

CREATE TABLE Albums (
    album_id      SERIAL PRIMARY KEY,
    title         VARCHAR(150) NOT NULL,
    release_date  DATE NOT NULL,
    album_type    VARCHAR(30) CHECK (album_type IN ('studio', 'live', 'compilation')),
    UNIQUE (title, release_date)
);

CREATE TABLE Members (
    member_id     SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL
);

-- 'role' is multivalued (a member can be both vocalist and songwriter),
-- so it cannot be a column on Members — it becomes its own table.
CREATE TABLE Member_Roles (
    member_id  INT REFERENCES Members(member_id) ON DELETE CASCADE,
    role       VARCHAR(50) NOT NULL,
    PRIMARY KEY (member_id, role)
);

-- Audio_Features is a COMPOSITE ATTRIBUTE of Song in the ER diagram
-- (an oval, not a separate entity), so per Step 1 of the mapping algorithm
-- its simple components decompose directly into THIS SAME relation —
-- they do NOT get a separate 1:1 table.
CREATE TABLE Songs (
    song_id           SERIAL PRIMARY KEY,
    title             VARCHAR(150) NOT NULL,
    duration_seconds  INT CHECK (duration_seconds > 0),
    track_number      INT CHECK (track_number > 0),
    album_id          INT NOT NULL REFERENCES Albums(album_id) ON DELETE CASCADE,
    tempo_bpm         NUMERIC(5,2),
    energy            NUMERIC(3,2) CHECK (energy BETWEEN 0 AND 1),
    danceability      NUMERIC(3,2) CHECK (danceability BETWEEN 0 AND 1),
    valence           NUMERIC(3,2) CHECK (valence BETWEEN 0 AND 1),
    genre             VARCHAR(50)
);

CREATE TABLE Song_Members (
    song_id           INT REFERENCES Songs(song_id) ON DELETE CASCADE,
    member_id         INT REFERENCES Members(member_id) ON DELETE CASCADE,
    contribution_type VARCHAR(50) NOT NULL,
    PRIMARY KEY (song_id, member_id, contribution_type)
);

CREATE TABLE Users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(50) UNIQUE NOT NULL,
    email          VARCHAR(120) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(20) NOT NULL DEFAULT 'listener'
                   CHECK (role IN ('listener', 'admin')),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Listening_History (
    history_id             SERIAL PRIMARY KEY,
    user_id                INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    song_id                INT NOT NULL REFERENCES Songs(song_id) ON DELETE CASCADE,
    played_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    play_duration_seconds  INT CHECK (play_duration_seconds >= 0)
);

CREATE TABLE Ratings (
    user_id       INT REFERENCES Users(user_id) ON DELETE CASCADE,
    song_id       INT REFERENCES Songs(song_id) ON DELETE CASCADE,
    rating_value  INT NOT NULL CHECK (rating_value BETWEEN 1 AND 5),
    rated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id)
);

CREATE TABLE Playlists (
    playlist_id    SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    playlist_name  VARCHAR(100) NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Playlist_Songs (
    playlist_id     INT REFERENCES Playlists(playlist_id) ON DELETE CASCADE,
    song_id         INT REFERENCES Songs(song_id) ON DELETE CASCADE,
    position_order  INT NOT NULL,
    PRIMARY KEY (playlist_id, song_id)
);

-- =====================================================================
-- SECTION 2: Vector paradigm — song embeddings for recommendations
-- =====================================================================
-- One embedding per song, derived from its audio-feature columns (and,
-- optionally, lyrics text). 8 dimensions here map 1:1 to engineered
-- features for transparency in the demo; swap for a real text/audio
-- embedding model's output dimension (e.g. 384/768) if lyrics are added.
CREATE TABLE Song_Embeddings (
    song_id    INT PRIMARY KEY REFERENCES Songs(song_id) ON DELETE CASCADE,
    embedding  vector(8) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approximate nearest-neighbor index for fast cosine-similarity search.
-- `lists` controls how many k-means clusters the index partitions vectors
-- into; pgvector's own guidance is roughly rows/1000 (minimum 1). With a
-- catalog this small (the full One Direction discography is a few dozen
-- songs), a larger `lists` value actually makes the ANN search WORSE —
-- each cluster holds too few points for the approximation to behave
-- sensibly, and ORDER BY ... LIMIT queries can silently return far fewer
-- (or zero) of the true nearest neighbors. lists = 1 keeps the index
-- exact at this scale while still demonstrating the ivfflat structure;
-- raise it (rows/1000) as the catalog grows.
CREATE INDEX idx_song_embeddings_cosine
    ON Song_Embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 1);

-- =====================================================================
-- SECTION 3: Indexes
-- =====================================================================
CREATE INDEX idx_listening_user ON Listening_History(user_id);
CREATE INDEX idx_listening_song ON Listening_History(song_id);
CREATE INDEX idx_songs_album    ON Songs(album_id);

-- =====================================================================
-- SECTION 4: View — derived attribute (popularity_score)
-- =====================================================================
-- 'popularity_score' is a derived attribute — computed from Listening_History,
-- never stored directly, so it's implemented as a view instead of a column.
CREATE VIEW Song_Popularity AS
SELECT song_id, COUNT(*) AS popularity_score
FROM Listening_History
GROUP BY song_id;

-- =====================================================================
-- SECTION 5: Trigger — a rule a CHECK constraint cannot express
-- =====================================================================
-- A CHECK constraint can't reference another table, so enforcing
-- "a logged play can't be longer than the song itself" needs a trigger.
CREATE OR REPLACE FUNCTION fn_validate_play_duration()
RETURNS TRIGGER AS $$
DECLARE
    song_len INT;
BEGIN
    SELECT duration_seconds INTO song_len FROM Songs WHERE song_id = NEW.song_id;
    IF song_len IS NOT NULL AND NEW.play_duration_seconds > song_len THEN
        RAISE EXCEPTION
            'play_duration_seconds (%) cannot exceed the song''s duration_seconds (%)',
            NEW.play_duration_seconds, song_len;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_play_duration
BEFORE INSERT OR UPDATE ON Listening_History
FOR EACH ROW
EXECUTE FUNCTION fn_validate_play_duration();

-- =====================================================================
-- SECTION 6: Stored procedure/function — atomic "log a play" operation
-- =====================================================================
-- Wraps the insert in a function so the API layer calls one statement;
-- also demonstrates a stored function distinct from the trigger above.
CREATE OR REPLACE FUNCTION log_listen(
    p_user_id INT,
    p_song_id INT,
    p_duration INT
) RETURNS INT AS $$
DECLARE
    new_id INT;
BEGIN
    INSERT INTO Listening_History (user_id, song_id, play_duration_seconds)
    VALUES (p_user_id, p_song_id, p_duration)
    RETURNING history_id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;
