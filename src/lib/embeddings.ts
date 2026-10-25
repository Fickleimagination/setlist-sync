/**
 * Vector paradigm helper — computes an 8-dimensional embedding for a song
 * from its structured audio-feature columns (tempo, energy, danceability,
 * valence, duration, genre) plus two derived trig features.
 *
 * This is deliberately NOT a black-box call to a hosted embedding model:
 * for the project's documentation requirement ("what is embedded, which
 * approach, which similarity metric"), every dimension here is traceable
 * back to a column already in the relational schema. A real deployment
 * would swap this for a text/audio embedding model's output vector —
 * the storage (pgvector `vector` column) and the retrieval (cosine
 * distance via the `<=>` operator) stay the same either way.
 */

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface SongAudioFeatures {
  duration_seconds: number;
  tempo_bpm: number;
  energy: number;
  danceability: number;
  valence: number;
  genre: string;
}

/** Returns the 8-dim embedding as a plain number array. */
export function computeEmbedding(f: SongAudioFeatures): number[] {
  const genreHash = (hashString(f.genre ?? "") % 100) / 100;
  return [
    f.tempo_bpm / 200,
    f.energy,
    f.danceability,
    f.valence,
    f.duration_seconds / 300,
    genreHash,
    Math.sin(f.tempo_bpm / 50),
    Math.cos(f.energy * Math.PI),
  ];
}

/** Returns the embedding formatted as a pgvector literal, e.g. "[0.1,0.2,...]". */
export function embeddingLiteral(f: SongAudioFeatures): string {
  return `[${computeEmbedding(f).join(",")}]`;
}
