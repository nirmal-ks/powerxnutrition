"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockIcon } from "../ui/Icons";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      setError((await res.json().catch(() => ({}))).error || "Login failed");
    } catch {
      setError("No internet connection. Check the connection and try again.");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          placeholder="owner"
        />
        <span className="mt-1 block text-[0.7rem] text-smoke">Owner: leave as “owner” (or blank) and use the admin password.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoFocus autoComplete="current-password" required />
      </label>
      {error && <p className="text-sm text-ember" role="alert">{error}</p>}
      <button disabled={loading} className="btn btn-red w-full py-3.5!">
        <LockIcon size={16} /> {loading ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
