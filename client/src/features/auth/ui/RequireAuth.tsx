import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../model/AuthContext";

// Gate around board routes: shows a spinner while the session is being restored,
// redirects guests to /login (remembering where they were headed), and renders
// the board once authenticated.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] text-[#666666]">
        Loading…
      </div>
    );
  }

  if (status === "anon") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
