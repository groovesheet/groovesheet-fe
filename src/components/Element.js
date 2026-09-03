import React from "react";
import { VariantHoverWrapper } from "./VariantHoverWrapper";
import "./Element.css";

/**
 * Closing showcase band, rendered on the landing page and both tool pages.
 * The heading was hardcoded English naming drum scores, which is wrong on the
 * stem-splitter and MIDI pages and untranslated everywhere, so callers now
 * supply it.
 */
export const Element = ({
  titleTop = "High-Accuracy Drum",
  titleBottom = "Scores, On Demand.",
  lede = "Upload a track, review the preview, download print-ready parts.",
}) => {
  return (
    <div className="element-section">
      <div className="element-container">
      <div className="element-header flex items-center justify-between relative self-stretch w-full flex-[0_0_auto]">
        <div className="element-title-col max-w-[420px] w-[420px] flex flex-col items-start relative">
          <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
            <div className="element-title relative flex items-center justify-center self-stretch mt-[-1.00px] [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-[var(--color-text)] text-[40px] tracking-[-0.80px] leading-[52px]">
              {titleTop}
              <br />
              {titleBottom}
            </div>
          </div>
        </div>

        <p className="element-lede relative flex items-center justify-center w-[430px] [font-family:'DM_Sans-Regular',Helvetica] font-normal text-[var(--color-text)] text-xl tracking-[0] leading-6">
          {lede}
        </p>
      </div>

      <div className="element-media h-[617.04px] justify-center self-stretch w-full flex flex-col items-start relative">
        <div className="flex items-center justify-center relative flex-1 self-stretch w-full grow rounded-[17.63px] overflow-hidden">
          <div className="justify-center flex-1 self-stretch grow flex flex-col items-start relative">
            {/* Use an existing public image for background via inline style to avoid css-loader url resolution */}
            <div
              className="relative flex-1 self-stretch w-full grow bg-cover bg-[50%_50%]"
              style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/images/VIdeo.png)` }}
            />
          </div>

          <div className="flex w-[88px] h-[14.29%] items-center justify-center absolute top-[42.86%] left-[calc(50.00%_-_44px)] bg-[#ffffff80] rounded-[188.42px] overflow-hidden">
            <VariantHoverWrapper
              className="!h-[33.06px] !w-[27.55px]"
              componentVector="/images/vector-2.svg"
              hover={false}
              variant="nine"
            />
            <div className="absolute top-0 left-0 w-[88px] h-[88px] rounded-[188.42px] border-[2.2px] border-solid border-[#ffffff80]" />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Element;
