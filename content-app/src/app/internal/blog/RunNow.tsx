"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Starts the same run the cron does. It takes a minute or two: a feed scan,
   a ranking call, a researched draft and the captions. With automatic
   publishing on, the run also puts the post live and sends the captions, so
   this button is not a dry run. */
export default function RunNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function run() {
    setBusy(true);
    setNote("Reading the feeds and drafting. This takes a minute or two.");
    try {
      const res = await fetch("/api/internal/content/run", { method: "POST" });
      const json = (await res.json()) as {
        outcome?: string;
        detail?: string;
        draftId?: number;
        url?: string;
      };
      /* Either way the draft page is where the detail is: what was written,
         what the checks said, and for a published post, where it went. */
      if ((json.outcome === "drafted" || json.outcome === "published") && json.draftId) {
        router.push(`/internal/blog/${json.draftId}`);
        return;
      }
      setNote(json.detail ?? `Run ended: ${json.outcome ?? res.status}`);
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "The run failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="int-run-now">
      {note ? <span className="int-run-note" role="status">{note}</span> : null}
      <button
        type="button"
        className="gs-btn gs-btn--primary int-btn-sm"
        onClick={run}
        disabled={busy}
      >
        {busy ? "Running…" : "Run Now"}
      </button>
    </div>
  );
}
