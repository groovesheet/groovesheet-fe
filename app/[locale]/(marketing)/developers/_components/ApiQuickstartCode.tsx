'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { SNIPPETS, hlCode, type SnippetLang } from './apiStyles';

const tab = (on: boolean): CSSProperties => ({
  padding: '7px 14px',
  borderRadius: '7px',
  border: 0,
  cursor: 'pointer',
  fontFamily: 'var(--font-family-sans)',
  fontWeight: 500,
  fontSize: '13px',
  transition: 'all .2s ease',
  background: on ? 'var(--color-panel1)' : 'transparent',
  color: on ? 'var(--color-text)' : 'var(--color-muted-foreground)',
});

/** The quickstart request block: language tabs, copy button, highlighted snippet. */
export default function ApiQuickstartCode() {
  const [lang, setLang] = useState<SnippetLang>('curl');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const setLangTab = (l: SnippetLang) => {
    setLang(l);
    setCopied(false);
  };

  const copyCode = () => {
    const txt = SNIPPETS[lang].code;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  const active = SNIPPETS[lang];

  return (
    <div
      style={{
        background: '#1b191c',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,.37)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px 9px 14px',
          background: 'rgba(255,255,255,.02)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '5px',
            background: 'var(--color-panel2)',
            padding: '4px',
            borderRadius: '9px',
          }}
        >
          <button type="button" onClick={() => setLangTab('curl')} style={tab(lang === 'curl')}>
            cURL
          </button>
          <button type="button" onClick={() => setLangTab('node')} style={tab(lang === 'node')}>
            Node.js
          </button>
          <button type="button" onClick={() => setLangTab('python')} style={tab(lang === 'python')}>
            Python
          </button>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="api-copy-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: 0,
            color: 'var(--color-muted-foreground)',
            fontFamily: 'var(--font-family-sans)',
            fontSize: '12.5px',
            fontWeight: 500,
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div
        style={{
          padding: '6px 16px 4px',
          fontFamily: 'var(--font-family-mono)',
          fontSize: '11px',
          color: 'var(--color-muted-foreground)',
        }}
      >
        {active.file}
      </div>
      <pre
        style={{
          margin: 0,
          padding: '8px 18px 18px',
          fontFamily: 'var(--font-family-mono)',
          fontSize: '12.5px',
          lineHeight: 1.65,
          color: 'var(--color-foreground)',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
        dangerouslySetInnerHTML={{ __html: hlCode(active.code) }}
      />
    </div>
  );
}
