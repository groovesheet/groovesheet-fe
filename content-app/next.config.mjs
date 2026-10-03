/** @type {import('next').NextConfig} */
const nextConfig = {
  /* The app is served under www.groovesheet.net through rewrites from the main
     Vercel project (see vercel.rewrites.json), so every URL it builds must be
     site-relative and every route must already live under /blog, /blog-media,
     /internal or /api. Nothing here rewrites paths: the mapping is one to one
     on purpose, so a link that works on the app's own domain works on the
     main one too. */
  poweredByHeader: false,

  /* On www.groovesheet.net only /blog, /blog-media, /internal and
     /api/internal are rewritten here, so the default /_next/static/* chunks
     were answered by the CRA app's catch-all: index.html with a 200. Every
     page arrived as bare HTML with no CSS and no JS, and /internal/login could
     not sign anyone in. A distinct prefix gives the main project one more path
     to forward, and unlike rewriting /_next itself it will not collide with
     the main app's own chunks once that app is Next.js too. Next serves
     /content-assets/_next/* by itself; see vercel.rewrites.json. */
  assetPrefix: "/content-assets",

  experimental: {
    /* Server actions reject a request whose Origin differs from the host. A
       portal action posted from www.groovesheet.net reaches this project
       with its own vercel.app host, so without this every save, approve and
       send fails with "Invalid Server Actions request". */
    serverActions: {
      allowedOrigins: ["www.groovesheet.net", "groovesheet.net"],
    },
  },

  /* node-postgres resolves its drivers at runtime, so bundling it breaks the
     connection. Only the portal, the cron and the blog's database reads touch
     it, and only when DATABASE_URL is set. */
  serverExternalPackages: ["pg"],

  /* This app has its own lockfile inside a repo whose root is the CRA app, so
     Next picks the wrong workspace root and warns about it. Say which one. */
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
