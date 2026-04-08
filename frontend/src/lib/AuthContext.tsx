"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) return null;

      const parsedUser = JSON.parse(storedUser) as User;
      if (parsedUser?.id && parsedUser?.email) {
        return parsedUser;
      }
    } catch {}

    localStorage.removeItem("user");
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const storedToken = localStorage.getItem("token");
    return storedToken || null;
  });

  const [isLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, [user]);

  const login = (token: string, user: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.removeItem("free_usage_count");
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
