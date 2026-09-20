/** @type {import('next').NextConfig} */
const nextConfig = {
  /* The app is served under www.groovesheet.net through rewrites from the main
     Vercel project (see vercel.rewrites.json), so every URL it builds must be
     site-relative and every route must already live under /blog, /blog-media,
     /internal or /api. Nothing here rewrites paths: the mapping is one to one
     on purpose, so a link that works on the app's own domain works on the
     main one too. */
  poweredByHeader: false,

  /* node-postgres resolves its drivers at runtime, so bundling it breaks the
     connection. Only the portal, the cron and the blog's database reads touch
     it, and only when DATABASE_URL is set. */
  serverExternalPackages: ["pg"],

  /* This app has its own lockfile inside a repo whose root is the CRA app, so
     Next picks the wrong workspace root and warns about it. Say which one. */
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
