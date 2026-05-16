import { MidiInstrument } from "../MusicalScore/VoiceData/Instructions/ClefInstruction";
import { IAudioPlayer } from "../Common/Interfaces/IAudioPlayer";
import * as SoundfontPlayer from "soundfont-player";
export declare class BasicAudioPlayer implements IAudioPlayer<SoundfontPlayer.Player> {
    ac: AudioContext;
    private channelVolumes;
    private piano;
    protected memoryLoadedSoundFonts: Map<MidiInstrument, SoundfontPlayer.Player>;
    protected channelToSoundFont: Map<number, number>;
    SoundfontInstrumentOptions: {
        from: string;
        fromPercussion: string;
        nameToUrl: any;
    };
    /** Multiplicator for gain (volume output). 1 represents the maximum volume in OSMD (100%),
     *  but it looks like soundfont-player is louder with volumes > 1.
     *  E.g. set osmd.PlaybackManager.audioPlayer.GainMultiplier to 3 if you think the player is too quiet. */
    GainMultiplier: number;
    constructor();
    open(uniqueInstruments: number[], numberOfinstruments?: number): Promise<void>;
    close(): void;
    tuningChanged(tuningInHz: number): void;
    playSound(instrumentChannel: number, key: number, volume: number, lengthInMs: number): void;
    /** Stop sound(s) in this channel. Currently stops all of the instrument's sounds because of implementation details. */
    stopSound(instrumentChannel: number, key: number): void;
    setSound(instrumentChannel: number, soundId: MidiInstrument): Promise<number>;
    loadSoundFont(soundId: MidiInstrument): Promise<SoundfontPlayer.Player>;
    /** Returns the url for the instrument name's soundfont to be loaded. */
    nameToSoundfontUrl(name: string, font: string, format: string, from: string): string;
    setVolume(instrumentChannel: number, volume: number): void;
    setSoundFontFilePath(soundId: MidiInstrument, path: string): void;
    playbackHasStopped(): void;
    getMemoryLoadedSoundFonts(): SoundfontPlayer.Player[];
}
