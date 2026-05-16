import { IUserDisplayInteractionListener } from "../Common/Interfaces/IUserDisplayInteractionListener";
import { PointF2D } from "../Common/DataObjects";
import { InteractionType } from "../Common/Enums/InteractionType";
import { SheetRenderingManager } from "./SheetRenderingManager";
export declare class VoiceEntryInteractionListener implements IUserDisplayInteractionListener {
    private renderingManager;
    constructor(renderingManager: SheetRenderingManager);
    userDisplayInteraction(relativePosition: PointF2D, positionInSheetUnits: PointF2D, type: InteractionType): void;
}
