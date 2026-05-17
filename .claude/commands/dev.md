---
description: Start the dev server and verify the UI in a browser
---

1. Confirm `.env.local` has `REACT_APP_CLERK_PUBLISHABLE_KEY` and `REACT_APP_API_BASE_URL` (or rely on the `/api` proxy via `src/setupProxy.js`).
2. Run `npm start` (port 3000).
3. Open the page you're changing and exercise the golden path + one edge case.
4. If you can't visually verify (no browser available), say so explicitly — don't claim success.
