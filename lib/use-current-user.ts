"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { User } from "@/types/api";

export function dashboardPath(user: User) {
  return user.role === "ADMIN" ? "/admin" : "/dashboard";
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.auth.me();
      setUser(result.user);
      return result.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api.auth
      .me()
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { loading, refresh, user };
}
