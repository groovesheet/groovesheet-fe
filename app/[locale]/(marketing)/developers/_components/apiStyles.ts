import type { CSSProperties } from 'react';

// Access gating. `true` => private-beta copy ("Request access"),
// `false` => self-serve copy ("Get your API key"). Mirrors the design's
// `gated` prop; flip when self-serve keys ship.
export const GATED = true;

// ---------- shared style fragments ----------
export const monoLabel: CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: '12px',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--color-muted-foreground)',
  margin: '0 0 12px',
};

export const sectionTitle: CSSProperties = {
  fontSize: '34px',
  letterSpacing: '-.6px',
  fontWeight: 400,
  margin: '0 0 36px',
  maxWidth: '620px',
};

export const card: CSSProperties = {
  background: 'var(--color-panel2)',
  borderRadius: '16px',
  padding: '26px',
};

export const codeChip: CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: '12px',
  color: 'var(--color-muted-foreground)',
  background: '#1b191c',
  borderRadius: '7px',
  padding: '9px 12px',
};

export const primaryBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '14px 26px',
  borderRadius: '120px',
  background: 'var(--color-primary)',
  color: '#fff',
  fontWeight: 500,
  fontSize: '15px',
  boxShadow: '0 4px 12px rgba(1,47,167,.3)',
};

export const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '14px 24px',
  borderRadius: '120px',
  background: 'transparent',
  color: 'var(--color-foreground)',
  border: '1px solid var(--color-border-lighter)',
  fontWeight: 500,
  fontSize: '15px',
};

// ---- code snippets shown in the quickstart tabs ----
export type SnippetLang = 'curl' | 'node' | 'python';

export const SNIPPETS: Record<SnippetLang, { label: string; file: string; code: string }> = {
  curl: {
    label: 'cURL',
    file: 'request.sh',
    code: `curl -X POST https://api.groovesheet.net/v1/jobs \\
  -H "Authorization: Bearer $GROOVESHEET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "audio_url": "https://cdn.example.com/track.mp3",
    "workflow": "drums",
    "exports": ["midi", "musicxml"]
  }'`,
  },
  node: {
    label: 'Node.js',
    file: 'create-job.js',
    code: `import GrooveSheet from "@groovesheet/sdk";

const gs = new GrooveSheet(process.env.GROOVESHEET_API_KEY);

const job = await gs.jobs.create({
  audio_url: "https://cdn.example.com/track.mp3",
  workflow: "drums",
  exports: ["midi", "musicxml"],
});

console.log(job.id, job.status); // job_8f3c1a queued`,
  },
  python: {
    label: 'Python',
    file: 'create_job.py',
    code: `from groovesheet import GrooveSheet

gs = GrooveSheet(api_key=os.environ["GROOVESHEET_API_KEY"])

job = gs.jobs.create(
    audio_url="https://cdn.example.com/track.mp3",
    workflow="drums",
    exports=["midi", "musicxml"],
)

print(job.id, job.status)  # job_8f3c1a queued`,
  },
};

export const RESPONSE_CODE = `{
  "job_id": "job_8f3c1a",
  "status": "queued",
  "workflow": "drums",
  "estimate_sec": 12
}`;

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sp = (c: string, t: string) => `<span style="color:${c}">${t}</span>`;

// Lightweight syntax highlighting for the request snippet. Input is our own
// constant source, escaped first, so the HTML it returns is safe to inject.
export function hlCode(code: string): string {
  const re =
    /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b(curl|import|from|const|let|await|new|print|def|return|true|false|null|None)\b/g;
  return esc(code).replace(re, (m: string, com?: string, str?: string, num?: string, key?: string) => {
    if (com) return sp('#7d7c7e', com);
    if (str) return sp('#6ce5a3', str);
    if (num) return sp('#ffb86c', num);
    if (key) return sp('#c084fc', key);
    return m;
  });
}

// Highlighting for the JSON response block
export function hlJson(code: string): string {
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(\d+(?:\.\d+)?)\b|\b(true|false|null)\b/g;
  return esc(code).replace(re, (m: string, str?: string, colon?: string, num?: string, kw?: string) => {
    if (str) return sp(colon ? '#c084fc' : '#6ce5a3', str) + (colon || '');
    if (num) return sp('#ffb86c', num);
    if (kw) return sp('#c084fc', kw);
    return m;
  });
}
