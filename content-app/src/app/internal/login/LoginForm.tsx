"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_EDITOR, EDITORS } from "../_lib/editors";

export default function LoginForm({ sharedPassword }: { sharedPassword: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState(sharedPassword ? DEFAULT_EDITOR : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/internal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Sign in failed.");
        setBusy(false);
        return;
      }
      /* Land where they were headed, defaulting to the index. `next` is
         constrained to an /internal path so a crafted link cannot bounce
         someone off-site after a successful sign in. */
      const next = params.get("next");
      const dest = next && next.startsWith("/internal") ? next : "/internal";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <form className="int-login-card" onSubmit={submit}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/Logo_White.png"
          width={122}
          height={22}
          alt="GrooveSheet"
          style={{ height: 22, width: "auto", display: "block" }}
        />
        <span className="int-divider" />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Internal</span>
      </div>

      <p className="int-login-copy">
        {sharedPassword
          ? "One team password. Say who you are, so the post you approve is recorded against the right name."
          : "Sign in to continue."}
      </p>

      <div className="int-login-fields">
        {sharedPassword ? (
          <label className="int-login-who">
            <span className="int-field-label">I am</span>
            <div className="int-select-wrap int-select-full">
              <select
                className="int-select"
                value={user}
                onChange={(e) => setUser(e.target.value)}
              >
                {EDITORS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <span className="int-select-chevron">▾</span>
            </div>
          </label>
        ) : (
          <input
            className="gs-input"
            name="user"
            autoComplete="username"
            placeholder="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            required
          />
        )}
        <input
          className="gs-input"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Password"
          autoFocus={sharedPassword}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? (
        <p className="int-login-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="gs-btn gs-btn--primary"
        style={{ width: "100%" }}
        disabled={busy}
      >
        {busy ? "Signing in" : "Sign in"}
      </button>

      <p className="int-login-foot">session cookie · 30-day expiry</p>
    </form>
  );
}
