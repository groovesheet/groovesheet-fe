"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishSocial } from "../_lib/contentActions";

export default function PostNow({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="int-post-now">
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
            <span className="int-spinner int-spinner-sm" aria-hidden="true" />
            Posting, up to a minute…
          </>
        ) : (
          label
        )}
      </button>
      {error ? <span className="int-post-now-error">{error}</span> : null}
    </span>
  );
}
