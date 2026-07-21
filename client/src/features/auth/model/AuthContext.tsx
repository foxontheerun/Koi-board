import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apolloClient } from "../../../app/apolloClient";
import {
  LOGIN_MUTATION,
  SIGNUP_MUTATION,
  REFRESH_MUTATION,
} from "../api/auth.gql";
import { setSession, clearSession, getRefreshToken } from "../lib/authStore";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

type Status = "loading" | "authed" | "anon";

interface AuthContextValue {
  user: AuthUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const applyPayload = useCallback((p: AuthPayload) => {
    setSession(p.accessToken, p.refreshToken);
    setUser(p.user);
    setStatus("authed");
  }, []);

  // On load, try to restore the session from the stored refresh token.
  useEffect(() => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      setStatus("anon");
      return;
    }
    let cancelled = false;
    apolloClient
      .mutate<{ refresh: AuthPayload }>({
        mutation: REFRESH_MUTATION,
        variables: { refreshToken },
      })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.refresh) applyPayload(res.data.refresh);
        else {
          clearSession();
          setStatus("anon");
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setStatus("anon");
      });
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apolloClient.mutate<{ login: AuthPayload }>({
        mutation: LOGIN_MUTATION,
        variables: { email, password },
      });
      if (!res.data?.login) throw new Error("Login failed");
      applyPayload(res.data.login);
    },
    [applyPayload],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const res = await apolloClient.mutate<{ signup: AuthPayload }>({
        mutation: SIGNUP_MUTATION,
        variables: { email, password },
      });
      if (!res.data?.signup) throw new Error("Signup failed");
      applyPayload(res.data.signup);
    },
    [applyPayload],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setStatus("anon");
    void apolloClient.clearStore();
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
