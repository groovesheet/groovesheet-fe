import { SkyBottomLineCalculator } from "./SkyBottomLineCalculator";
import { VexFlowMeasure } from "./VexFlow/VexFlowMeasure";
export declare class SkyBottomLineCalculatorSVG extends SkyBottomLineCalculator {
    private recursiveUpdate;
    calculateLinesForMeasure(measure: VexFlowMeasure, measureNode: SVGGElement): number[][];
    /**
     * This method calculates the Sky- and BottomLines for a StaffLine using SVG
     */
    calculateLines(): void;
}
