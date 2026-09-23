import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { THEME_BOOT_SCRIPT } from "@/lib/themeBoot";
import "./theme.css";
import "./primitives.css";

/* The blog is served at www.groovesheet.net/blog through a Vercel rewrite from
   the main project, so it must carry the SAME analytics IDs as the CRA app or
   a visitor who reads a post and then clicks through to the uploader is
   counted as two sessions from two properties.

   These are the IDs in groovesheet-fe/public/index.html. GA4 G-LJ5P8PF3YH and
   Google Ads AW-18426875153 share one gtag.js load, exactly as they do there.
   GTM-PHXB57NW is the container we own; GTM-P9XDD5Z7 is the one under an
   account nobody here can open, and it is deliberately not loaded. */
const GA4_MEASUREMENT_ID = "G-LJ5P8PF3YH";
const GOOGLE_ADS_TAG_ID = "AW-18426875153";

export const viewport: Viewport = {
  /* The product is dark by default and offers light. Say both, so a browser
     does not force-invert the pages into an unofficial dark mode. */
  colorScheme: "dark light",
  themeColor: "#171717",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.groovesheet.net"),
  alternates: { canonical: "./" },
  title: {
    default: "GrooveSheet | Turn Any Song Into Sheet Music",
    template: "%s | GrooveSheet",
  },
  description:
    "Upload audio and get accurate, editable, printable notation in minutes. PDF, MusicXML and MIDI, plus stem separation and audio to MIDI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Before first paint, so a visitor who chose light on the rest of
            groovesheet.net does not get a dark flash here. next/script would
            defer it past paint, which is the whole thing this avoids. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* The rule this suppresses is about pages/_document, which the App
            Router does not have: a stylesheet in this layout's <head> applies
            to every route under it. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Hubot+Sans:ital,wght@0,200..900;1,200..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_MEASUREMENT_ID}');
gtag('config', '${GOOGLE_ADS_TAG_ID}');`}
        </Script>
      </body>
    </html>
  );
}
