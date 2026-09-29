"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/* Google's "Add to Preferred Sources" button for the blog footer. Once a
   reader adds groovesheet.net, Google favours it in Top Stories and AI Mode
   for them. https://developers.google.com/search/docs/appearance/preferred-sources

   publisher.js inflates `[google-add-preferred-source-btn]` divs only when its
   init() runs, and fixes the theme at that moment. So the div is re-created
   (keyed on theme and path) whenever the site theme flips or the route
   changes, and init() is queued again through PREFERRED_SOURCE, which runs
   at once when the library is loaded and is replayed by it before then. */

const LIB = "https://news.google.com/swg/js/v1/publisher.js";

type PreferredSourceApi = { init: () => void };
type PreferredSourceQueue = { push: (fn: (api: PreferredSourceApi) => void) => void };

function currentTheme(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function PreferredSourceButton() {
  const pathname = usePathname() ?? "";
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const obs = new MutationObserver(() => setTheme(currentTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!theme) return;
    if (!document.querySelector(`script[src="${LIB}"]`)) {
      const s = document.createElement("script");
      s.async = true;
      s.src = LIB;
      document.head.appendChild(s);
    }
    const w = window as unknown as { PREFERRED_SOURCE?: PreferredSourceQueue | unknown[] };
    const queue = (w.PREFERRED_SOURCE ??= []) as PreferredSourceQueue;
    queue.push((api) => api.init());
  }, [theme, pathname]);

  return (
    <div className="footer-preferred-source">
      {theme && <div key={`${theme}:${pathname}`} google-add-preferred-source-btn="" data-theme={theme} />}
    </div>
  );
}
