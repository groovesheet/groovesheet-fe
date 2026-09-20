"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishSocial } from "../_lib/contentActions";

export default function PostNow({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className="gs-btn gs-btn--secondary-light int-btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await publishSocial(id);
            if (!r.ok) setError(r.errors.join(" "));
            router.refresh();
          })
        }
      >
        {pending ? (
          <>
            <span className="int-spinner" aria-hidden="true" style={{ width: 14, height: 14, marginRight: 8 }} />
            Posting, up to a minute…
          </>
        ) : (
          label
        )}
      </button>
      {error ? <span style={{ fontSize: 12, color: "var(--semantic-down)", maxWidth: 260, textAlign: "right" }}>{error}</span> : null}
    </span>
  );
}
