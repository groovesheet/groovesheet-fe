import { MidiInstrument } from "./VoiceData/Instructions/ClefInstruction";
/** Collections of instrument names, mapped to MidiInstruments. */
export declare class InstrumentNames {
    static MidiInstrument: {
        [key: string]: MidiInstrument;
    };
    /** A map of MusicXML `instrument-sound` values to MidiInstrument.
     * These should take priority when the MusicXML has both instrument-name and instrument-sound.
     * Sound definitions partially from: https://www.w3.org/2021/06/musicxml40/listings/sounds.xml/
     */
    static MidiInstrumentSounds: {
        [key: string]: MidiInstrument;
    };
}
