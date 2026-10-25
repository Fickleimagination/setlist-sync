// Thin client-side fetch helper. All frontend pages talk to the database
// ONLY through these API routes (never a direct DB import in a "use client"
// file) — this is the "Next.js talks to DB through a backend/API layer"
// requirement.
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : data?.error
        ? JSON.stringify(data.error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}
