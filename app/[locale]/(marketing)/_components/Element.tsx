import VariantHoverWrapper from '@/components/VariantHoverWrapper';
import './Element.css';

export interface ElementProps {
  titleTop?: string;
  titleBottom?: string;
  lede?: string;
}

/**
 * Closing showcase band, rendered on the landing page and both tool pages.
 * The heading was hardcoded English naming drum scores, which is wrong on the
 * stem-splitter and MIDI pages and untranslated everywhere, so callers now
 * supply it.
 */
export default function Element({
  titleTop = 'High-Accuracy Drum',
  titleBottom = 'Scores, On Demand.',
  lede = 'Upload a track, review the preview, download print-ready parts.',
}: ElementProps) {
  return (
    <div className="element-section">
      <div className="element-container">
        <div className="element-header">
          <div className="element-title-col">
            <div className="element-title-inner">
              <div className="element-title">
                {titleTop}
                <br />
                {titleBottom}
              </div>
            </div>
          </div>

          <p className="element-lede">{lede}</p>
        </div>

        <div className="element-media">
          <div className="element-frame">
            <div className="element-frame-inner">
              {/* Inline style, not CSS url(), so the bundler leaves the public/ path alone. */}
              <div className="element-image" style={{ backgroundImage: 'url(/images/VIdeo.png)' }} />
            </div>

            <div className="element-play">
              <VariantHoverWrapper
                className="element-play-icon"
                componentVector="/images/vector-2.svg"
                hover={false}
                variant="nine"
              />
              <div className="element-play-ring" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
