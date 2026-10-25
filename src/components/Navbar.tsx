"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 text-zinc-50">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Setlist&nbsp;Sync
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/dashboard" className="hover:text-emerald-400">
            Browse
          </Link>
          {!loading && user && (
            <Link href="/dashboard/playlists" className="hover:text-emerald-400">
              Playlists
            </Link>
          )}
          {!loading && user?.role === "admin" && (
            <Link href="/admin" className="hover:text-emerald-400">
              Admin
            </Link>
          )}
          {!loading && user && (
            <>
              <span className="text-zinc-400">
                {user.username} <span className="text-emerald-400">({user.role})</span>
              </span>
              <button
                onClick={async () => {
                  await logout();
                  router.push("/");
                  router.refresh();
                }}
                className="rounded border border-zinc-700 px-3 py-1 hover:border-emerald-400 hover:text-emerald-400"
              >
                Log out
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <Link
                href="/login"
                className="rounded border border-zinc-700 px-3 py-1 hover:border-emerald-400 hover:text-emerald-400"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded bg-emerald-500 px-3 py-1 font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
