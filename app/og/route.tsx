/**
 * /og?title=...&subtitle=...: a 1200x630 Open Graph card for pages that have
 * no image of their own (tools, pricing, help, changelog). Track and creator
 * pages keep their cover art; the home page keeps the designed preview.
 *
 * Referenced from lib/seo/metadata.ts generatedOgImage(). The route is
 * disallowed in robots.ts so the images themselves are never indexed as pages.
 *
 * Fonts: satori cannot use system fonts, and its bundled default has no CJK
 * glyphs, so the zh-CN / zh-TW titles would render as boxes. The Google Fonts
 * CSS endpoint returns TTF URLs to an old user agent; both fonts are fetched
 * once per instance and kept in module scope. When a fetch fails the card
 * still renders with the default font rather than failing the request.
 */
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 630;
const TITLE_MAX = 90;
const SUBTITLE_MAX = 160;

const FONT_CSS = {
  latin: 'https://fonts.googleapis.com/css2?family=Hubot+Sans:wght@700&display=swap',
  cjk: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&display=swap',
};

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

async function loadFont(cssUrl: string): Promise<ArrayBuffer | null> {
  const cached = fontCache.get(cssUrl);
  if (cached) return cached;
  const promise = (async () => {
    try {
      // This UA makes Google Fonts answer with TTF sources, which satori reads; a
      // modern UA gets woff2, which it does not.
      const css = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0)' } }).then((r) =>
        r.ok ? r.text() : ''
      );
      const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/);
      if (!match) return null;
      const res = await fetch(match[1]);
      return res.ok ? res.arrayBuffer() : null;
    } catch {
      return null;
    }
  })();
  fontCache.set(cssUrl, promise);
  return promise;
}

const hasCjk = (text: string) => /[　-鿿豈-﫿]/.test(text);

function clamp(value: string | null, max: number): string {
  const trimmed = (value || '').replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const title = clamp(searchParams.get('title'), TITLE_MAX) || 'Audio to Sheet Music, Stems & MIDI';
  const subtitle = clamp(searchParams.get('subtitle'), SUBTITLE_MAX);

  const fonts: { name: string; data: ArrayBuffer; weight: 700; style: 'normal' }[] = [];
  const latin = await loadFont(FONT_CSS.latin);
  if (latin) fonts.push({ name: 'Hubot Sans', data: latin, weight: 700, style: 'normal' });
  if (hasCjk(`${title}${subtitle}`)) {
    const cjk = await loadFont(FONT_CSS.cjk);
    if (cjk) fonts.push({ name: 'Noto Sans SC', data: cjk, weight: 700, style: 'normal' });
  }

  const titleSize = title.length > 50 ? 56 : 68;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0b0b0f 0%, #17131f 55%, #241a33 100%)',
          color: '#ffffff',
          fontFamily: fonts.map((f) => f.name).concat('sans-serif').join(', '),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 30, letterSpacing: -0.5 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f5f5f5',
              color: '#0b0b0f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
            }}
          >
            {'♪'}
          </div>
          <div>GrooveSheet</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: titleSize, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1040 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 30, lineHeight: 1.35, color: 'rgba(255,255,255,0.72)', maxWidth: 1000 }}>{subtitle}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: 'rgba(255,255,255,0.6)' }}>
          <div>Audio in. Sheet music, stems and MIDI out.</div>
          <div>groovesheet.net</div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        // Titles are stable per route; let the CDN keep the render for a day.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}
