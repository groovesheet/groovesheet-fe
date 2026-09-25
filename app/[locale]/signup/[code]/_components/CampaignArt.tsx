/**
 * The campaign page's presentational pieces: no state, no auth. Split out of
 * CampaignPage.tsx so the stateful island stays readable.
 */
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { ArrowRight, MusicNotesSimple, UploadSimple } from '@phosphor-icons/react';
import type { CompatT } from '@/lib/i18n-compat';

/**
 * The campaign mark, blown up and bled off the corner as background texture.
 *
 * Campaign logos are supplied as flat black-on-white PNGs with no alpha, so
 * `invert` + `screen` is what knocks the white ground out on this dark page,
 * the same pair the foreground lockup used before this replaced it.
 */
export function Watermark({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- remote campaign logo of unknown size, styled by CSS blend modes
  return <img className="cmp-watermark" src={src} alt="" aria-hidden="true" />;
}

export function AuthTile({
  label,
  bg,
  Icon,
  onClick,
  dark = false,
}: {
  label: string;
  bg: string;
  Icon: PhosphorIcon;
  onClick: () => void;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      className={`cmp-auth-tile ${dark ? 'is-dark' : ''}`}
      style={{ backgroundImage: `url(${bg})` }}
      onClick={onClick}
    >
      <span className="cmp-auth-tile-label">{label}</span>
      <Icon size={40} weight="fill" />
    </button>
  );
}

export function Feature({ Icon, title, body }: { Icon: PhosphorIcon; title: string; body: string }) {
  return (
    <div className="cmp-feature">
      <Icon size={34} />
      <div className="cmp-feature-title">{title}</div>
      <p>{body}</p>
    </div>
  );
}

export function NextStep({ Icon, title, body }: { Icon: PhosphorIcon; title: string; body: string }) {
  return (
    <div className="cmp-next-step">
      <Icon size={24} />
      <div className="cmp-next-step-title">{title}</div>
      <div className="cmp-next-step-body">{body}</div>
    </div>
  );
}

const WAVE_BARS = [18, 34, 56, 82, 44, 26, 64, 100, 70, 40, 22, 58, 88, 62, 36, 24, 52, 78, 96, 66, 42, 28, 60, 84, 50, 30, 20, 14];

// [width %, tone]; a row entry without a tone is a gap between notes.
const MIDI_ROWS: Array<Array<[number, number?]>> = [
  [[8], [16, 1], [6], [12, 1], [24], [18, 1]],
  [[22], [10, 2], [8], [26, 2], [6], [14, 2]],
  [[4], [28, 1], [14], [9, 1], [10], [22, 1]],
  [[14], [12, 2], [20], [16, 2], [8], [24, 2]],
  [[30], [20, 1], [10], [34, 1]],
];

/**
 * The MP3 to MIDI to sheet-music loop. Purely decorative and entirely
 * CSS-driven (one 11s timeline, no JS), so it costs nothing on the phones this
 * page is mostly opened on and disappears under prefers-reduced-motion.
 */
export function PipelineAnimation({ t }: { t: CompatT }) {
  return (
    <div className="cmp-anim" aria-hidden="true">
      <div className="cmp-anim-stage">
        <div className="cmp-anim-zone">
          <UploadSimple size={30} />
          <span>{t('campaign.anim.drop')}</span>
        </div>
        <div className="cmp-anim-zone-hot" />

        <div className="cmp-anim-file">
          <span className="cmp-anim-file-art">
            <MusicNotesSimple size={18} weight="fill" />
          </span>
          <span className="cmp-anim-file-meta">
            <span className="cmp-anim-file-name">band-practice.mp3</span>
            <span className="cmp-anim-file-size">3:58 · 7.4 MB</span>
          </span>
        </div>

        <svg className="cmp-anim-cursor" width="19" height="26" viewBox="0 0 19 26" fill="none">
          <path
            d="M1 1L1 20.5L6.2 15.6L9.8 24L13.2 22.4L9.7 14.2L17 13.6L1 1Z"
            fill="#ffffff"
            stroke="#171717"
            strokeWidth="1.4"
          />
        </svg>

        <div className="cmp-anim-wave">
          <div className="cmp-anim-bars">
            {WAVE_BARS.map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="cmp-anim-progress">
            <span />
          </div>
        </div>

        <div className="cmp-anim-midi">
          {MIDI_ROWS.map((row, r) => (
            <div className="cmp-anim-midi-row" key={r}>
              {row.map(([w, tone], i) => (
                <span key={i} className={tone ? `is-note tone-${tone}` : ''} style={{ width: `${w}%` }} />
              ))}
            </div>
          ))}
        </div>

        <div className="cmp-anim-sheet">
          <div className="cmp-anim-sheet-meta">DRUM SET · 4/4 · ♩ = 92</div>
          <DrumStave />
        </div>
      </div>

      <div className="cmp-anim-pills">
        <span className="cmp-anim-pill p1">MP3</span>
        <ArrowRight size={12} />
        <span className="cmp-anim-pill p2">MIDI</span>
        <ArrowRight size={12} />
        <span className="cmp-anim-pill p3">{t('campaign.anim.sheet')}</span>
      </div>
    </div>
  );
}

/** One bar of hi-hat/kick/snare notation, drawn to scale from the design. */
function DrumStave() {
  const hats = [20, 38, 56, 74, 92, 110, 128, 146, 172, 190, 208, 226, 244, 262, 280, 298];
  const beams: Array<[number, number]> = [
    [20, 74],
    [92, 146],
    [172, 226],
    [244, 298],
  ];
  const snares = [74, 146, 226, 298];
  const kicks = [20, 92, 172, 244];
  return (
    <svg viewBox="0 -8 320 80" xmlns="http://www.w3.org/2000/svg">
      {[26, 36, 46, 56, 66].map((y) => (
        <line key={y} x1="8" y1={y} x2="312" y2={y} stroke="#111" strokeWidth="1" />
      ))}
      <line x1="8" y1="26" x2="8" y2="66" stroke="#111" strokeWidth="1.4" />
      <line x1="160" y1="26" x2="160" y2="66" stroke="#111" strokeWidth="1.4" />
      <line x1="312" y1="26" x2="312" y2="66" stroke="#111" strokeWidth="3" />
      {beams.map(([x1, x2], i) => (
        <line key={i} x1={x1} y1="-2" x2={x2} y2="-2" stroke="#111" strokeWidth="3.2" />
      ))}
      {hats.map((x) => (
        <g key={x}>
          <path
            d={`M${x - 4} 8 L${x + 4} 16 M${x + 4} 8 L${x - 4} 16`}
            stroke="#111"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line x1={x} y1="12" x2={x} y2="-2" stroke="#111" strokeWidth="1.4" />
        </g>
      ))}
      {snares.map((x) => (
        <ellipse key={`s${x}`} cx={x} cy="41" rx="5.2" ry="3.8" fill="#111" transform={`rotate(-18 ${x} 41)`} />
      ))}
      {kicks.map((x) => (
        <ellipse key={`k${x}`} cx={x} cy="61" rx="5.2" ry="3.8" fill="#111" transform={`rotate(-18 ${x} 61)`} />
      ))}
    </svg>
  );
}
