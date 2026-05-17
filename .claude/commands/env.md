---
description: Frontend environment variables reference
---

Required env vars (set in `.env.local` for dev, Vercel project for prod):

| Var | Purpose |
|---|---|
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | Clerk auth — required for `<ClerkProvider>` in `src/index.js` |
| `REACT_APP_API_BASE_URL` | Backend API (optional — `/api` proxy + Vercel rewrite cover dev/prod) |
| `REACT_APP_NAME` | App display name |

Do **not** read `REACT_APP_API_URL` / `REACT_APP_API_BASE_URL` directly in new code. Use the helpers in `src/utils/api.js`, which hit `/api` and work in both dev (via `setupProxy.js`) and prod (via `vercel.json` rewrite).
