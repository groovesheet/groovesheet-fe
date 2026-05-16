import { Instrument } from "./Instrument";
import { MidiInstrument } from "./VoiceData/Instructions/ClefInstruction";
export declare class SubInstrument {
    constructor(parentInstrument: Instrument);
    idString: string;
    midiInstrumentID: MidiInstrument;
    volume: number;
    pan: number;
    fixedKey: number;
    name: string;
    instrumentSound: string;
    private parentInstrument;
    get ParentInstrument(): Instrument;
    static isPianoInstrument(instrument: MidiInstrument): boolean;
    setMidiInstrumentSound(instrumentType: string): void;
    setMidiInstrument(instrumentType: string): void;
    private parseMidiInstrument;
}
