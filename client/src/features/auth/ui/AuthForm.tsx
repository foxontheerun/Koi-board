import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../model/AuthContext";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const { login, signup, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const isLogin = mode === "login";

  if (status === "authed") return <Navigate to={from} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await signup(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5"
      >
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16B8D4]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <ellipse cx="8" cy="9" rx="5.5" ry="3.4" fill="#FF6A3D" />
              <path d="M12.5 9 L17 6 L17 12 Z" fill="#FF6A3D" />
              <circle cx="6" cy="8.2" r="0.9" fill="#fff" />
            </svg>
          </div>
          <span className="font-logo text-lg text-[#14202B]">Koi</span>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-[#14202B]">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-6 text-sm text-[#666666]">
          {isLogin
            ? "Sign in to your boards."
            : "Sign up to start collaborating."}
        </p>

        <label className="mb-1 block text-sm text-[#666666]" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[#1A1A1A] focus:border-[#0E7C99]"
        />

        <label className="mb-1 block text-sm text-[#666666]" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[#1A1A1A] focus:border-[#0E7C99]"
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[#0E7C99] py-2 font-medium text-white transition-colors hover:bg-[#0A5E73] disabled:opacity-60"
        >
          {busy ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </button>

        <p className="mt-4 text-center text-sm text-[#666666]">
          {isLogin ? (
            <>
              No account?{" "}
              <Link to="/signup" className="text-[#0E7C99] underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link to="/login" className="text-[#0E7C99] underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
