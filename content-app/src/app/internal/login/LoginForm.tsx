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
      <div className="int-login-brand">
        {/* Both wordmarks, switched by theme in internal.css: the white one
            disappears on the light card. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/Logo_White.png"
          width={130}
          height={22}
          alt="GrooveSheet"
          className="int-logo int-logo--on-dark"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/Logo_Dark.png"
          width={130}
          height={22}
          alt=""
          aria-hidden="true"
          className="int-logo int-logo--on-light"
        />
        <span className="int-divider" />
        <span className="int-login-tag">Internal</span>
      </div>

      <h1 className="int-login-title">Staff Sign In</h1>

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
        className="gs-btn gs-btn--primary int-btn-block"
        disabled={busy}
      >
        {busy ? "Signing In" : "Sign In"}
      </button>

      <p className="int-login-foot">Session cookie, 30-day expiry.</p>
    </form>
  );
}
