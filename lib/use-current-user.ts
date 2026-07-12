"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { User } from "@/types/api";

export function dashboardPath(user: User) {
  return user.role === "ADMIN" ? "/admin" : "/dashboard";
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  return { loading, user };
}
