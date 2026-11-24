"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/ui/BrandMark";
import { useAuth, type AuthUser } from "@/hooks/useAuth";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) {
      setError("Please enter your name (at least 2 characters).");
      return;
    }
    if (!trimmedEmail) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        user?: AuthUser;
        error?: string;
      } | null;

      if (!res.ok || !data?.user) {
        setError(data?.error || "Could not create account.");
        return;
      }

      setUser(data.user);
      router.replace("/");
    } catch {
      setError("Network error while creating account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="min-h-screen bg-[var(--ground)] text-[var(--muted)] flex items-center justify-center text-[14px]">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ground)] text-[var(--text)] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="text-[18px] font-semibold text-[var(--text)]">
              Vokal.ai
            </span>
          </div>
          <p className="text-[13px] text-[var(--muted)]">
            Save your mock interview sessions and track STAR progress over time
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="space-y-1">
            <h1 className="text-[20px] font-medium text-[var(--text)]">
              Create your account
            </h1>
            <p className="text-[13px] text-[var(--muted)]">
              Your webcam processing stays private on your device
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] px-3 py-2 text-[13px]"
            >
              {error}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">
              Full name
            </span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nurul Aina"
              className="input-field w-full h-10 px-3 text-[14px]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field w-full h-10 px-3 text-[14px]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">
              Password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="input-field w-full h-10 px-3 text-[14px]"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full h-10 text-[14px] font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-[13px] text-[var(--muted)] pt-1">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--accent-ink)] hover:text-[var(--accent)]"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
