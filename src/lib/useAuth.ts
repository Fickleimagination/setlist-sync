"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface SessionUser {
  userId: number;
  username: string;
  role: "listener" | "admin";
}

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: SessionUser | null }>("/api/auth/me");
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, loading, refresh, logout };
}
