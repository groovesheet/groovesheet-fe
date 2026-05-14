-- Seed 11 blog posts for GrooveSheet.
-- Idempotent: uses ON CONFLICT (slug) to upsert.

insert into public.blog_posts
  (slug, title, excerpt, body_md, author, read_time_min, featured, size, published_at)
values
-- ============================================================
('future-of-drum-transcription-ai-music-education',
 'The Future of Drum Transcription: How AI Is Changing Music Education',
 'Why automatic drum transcription is moving from a niche research curiosity to a practical tool reshaping how drummers learn, practice, and teach.',
 $body$
For most of recorded history, transcribing a drum part meant slowing down a record, rewinding tape, or scrubbing a waveform — pencil in hand, eraser nearby. Even with modern DAWs, an experienced drummer might spend 30–60 minutes notating a single song accurately. AI is collapsing that timeline to seconds.

## From research lab to rehearsal room

Automatic Drum Transcription (ADT) has been an active research field for over a decade, but until recently the outputs were brittle — works on isolated drum tracks, falls apart on a real mix. The breakthrough was twofold: (1) source-separation models like **Demucs** can now cleanly isolate the drum stem from a stereo master, and (2) drum-aware models trained on labeled datasets (ADTOF, ENST-Drums, MDB-Drums) learned to detect kick, snare, hi-hat, toms, and cymbals with usable accuracy on real music.

GrooveSheet stitches these together into one pipeline: upload an MP3 → Demucs strips out the drum stem → ADTOF transcribes it to MIDI → midi2score renders engraved sheet music. No headphones-and-pencil session required.

## Why this matters for education

Teachers are the early winners. The bottleneck in drum education has always been **content production**, not teaching ability. A great instructor can demonstrate a groove in 30 seconds but takes an hour to write it out cleanly for a student. With AI transcription:

- Lesson prep for a new song drops from an hour to under a minute.
- Students can request transcriptions of their own favorite tracks instead of being limited to whatever's in the method book.
- Comparisons between cover versions, drummers, or eras become trivial — generate three transcriptions, diff them, talk about feel.

## What AI still can't do

It's worth being honest. AI transcription today is **excellent for kit drum patterns**, **good for clear ghost-note dynamics**, and **noticeably worse** for: hand percussion, brush work, non-Western kits, and anything buried under heavy bass + vocal masking. The output is a draft a human polishes — not a final score.

That's the right framing for educators too. Ask students to *correct* an AI transcription instead of writing one from scratch. The cognitive load is on the listening and the music theory, not on the mechanics of notation.

## Where it's heading

Three things will define the next 24 months:

1. **Feel preservation.** Right now transcriptions quantize aggressively. Future models will capture micro-timing — the back-of-the-beat snare on a Questlove track — without making the score unreadable.
2. **Multi-instrument grounding.** Joint models that transcribe drums, bass, and piano simultaneously will produce more musically coherent scores than running each in isolation.
3. **Adaptive notation.** AI that picks the right notation conventions for the genre — jazz lead sheet vs. metal full transcription vs. afro-cuban patterns — automatically.

For the working drummer or teacher: the right question isn't "will AI replace transcription skill?" It's "what would I do with my time back?"
$body$,
 'GrooveSheet Team', 5, true, 'large', '2025-11-12T10:00:00Z'),

-- ============================================================
('audio-to-sheet-music-in-seconds-ml-pipeline',
 'From Audio to Sheet Music in Seconds: Inside GrooveSheet''s ML Pipeline',
 'A guided tour of the four stages that turn a stereo audio file into engraved, exportable sheet music — and the engineering tradeoffs at each step.',
 $body$
A user uploads an MP3. Forty seconds later they download a MusicXML file ready to open in Sibelius, MuseScore, or Dorico. What happens in between?

## Stage 1 — Separation (Demucs)

The first problem is that real recordings are mixed. A drum-transcription model fed a full stereo master gets confused by bass, vocals, and guitars sitting in the same frequency bands. We use **Demucs (Hybrid Transformer)** to separate the input into four stems: drums, bass, vocals, and other.

Demucs runs on a GPU worker in our `audio-workers` Kubernetes namespace. A typical 4-minute track takes ~15–25 seconds depending on the GPU we land on. The drum stem moves forward; the rest get cached for downstream workers (bass transcription, piano transcription).

## Stage 2 — Transcription (instrument-specific models)

Each instrument has its own specialist:

- **Drums** → ADTOF, a CNN-based onset/instrument classifier trained on the ADTOF dataset.
- **Piano** → Transkun-v2, a transformer that predicts note-on/off + velocity from spectrograms.
- **Bass (jazz)** → BassUNet, a pitch-contour model tuned for upright bass timbres.
- **Bass (general)** → FCPE, fast fundamental-frequency estimation for electric bass.

Each worker subscribes to a Pub/Sub topic, processes the stem, and publishes a completion event with the MIDI artifact stored in GCS. The orchestrator chains them according to the workflow definition.

## Stage 3 — Quantization & cleanup

Raw model outputs are messy. A snare hit detected at 487.3 ms doesn't map cleanly to a sixteenth-note grid at 120 BPM. We run a quantizer that:

1. Estimates tempo if not provided (or accepts a user-supplied BPM).
2. Snaps onsets to the nearest grid value with a tolerance window.
3. Filters out spurious double-hits within a configurable refractory period.
4. Maps detected instruments to standard General MIDI drum pitches.

Aggressive quantization makes the score readable but kills feel; loose quantization preserves feel but produces unreadable notation. We default to a middle setting and expose ghost-note sensitivity + groove-preservation knobs in the UI.

## Stage 4 — Engraving (midi2score)

MIDI is not sheet music. To produce MusicXML we use a custom **midi2score** worker that handles voice splitting (kick on stem-down, snare/hi-hat on stem-up), tuplet detection, rest insertion, and measure layout. The output is valid MusicXML 4.0 which most notation software opens cleanly.

## Why microservices?

The whole pipeline could in theory live in one Python process. We split it because:

- **Independent scaling.** Demucs is GPU-bound; midi2score is CPU-bound. They don't need the same hardware or replica count.
- **Independent deployment.** Swapping ADTOF for a better drum model doesn't risk breaking the piano path.
- **Backpressure isolation.** A queue of slow piano jobs doesn't block fast drum-only jobs.

The orchestrator publishes jobs to Pub/Sub; workers subscribe and ack on completion. The frontend polls for status via a single endpoint.

## The honest numbers

- 3:30 song, drums only: ~25 seconds end-to-end.
- 3:30 song, drums + bass + piano: ~60 seconds.
- Cost per credit: 1 credit = 1 second of audio. A free-tier user gets 1800 credits / month (~30 minutes).

The whole point is that you don't think about any of this. You upload, you download, you play.
$body$,
 'GrooveSheet Team', 7, true, 'large', '2025-10-28T10:00:00Z'),

-- ============================================================
('musicxml-pdf-or-midi-choosing-export-format',
 'MusicXML, PDF, or MIDI? Choosing the Best Export Format for Your Workflow',
 'A simple guide to understanding each export type and when to use them, whether you''re heading into a rehearsal, DAW session, or notation software.',
 $body$
GrooveSheet outputs three things from a single job: a **MIDI** file, a **MusicXML** score, and a **PDF**. They look interchangeable. They aren't.

## MIDI — the playable format

MIDI is a list of events: at time T, this pitch turned on with this velocity for this duration. It's tiny, universal, and **playable** but **not** a score.

**Use MIDI when you want to:**
- Drop the part into a DAW (Logic, Ableton, Reaper, Cubase) and play it with samples.
- Feed it into a sequencer, drum machine, or sampler.
- Train your own ML model on the symbolic data.
- Trigger an electronic kit's MIDI input.

**Don't use MIDI when you want to:**
- Read it as sheet music. MIDI doesn't know about staves, clefs, voices, or note-stem direction.

## MusicXML — the score format

MusicXML is the universal interchange format for **engraved music**. It preserves voice layout, articulations, time/key signatures, and a hundred other notational details MIDI ignores. Sibelius, Dorico, MuseScore, Finale, and Notion all read it.

**Use MusicXML when you want to:**
- Open the transcription in your notation editor and polish it.
- Share with a collaborator who'll edit on a different program.
- Print sheet music that respects beaming, voice splitting, and rests properly.

**Don't use MusicXML when you want to:**
- Play the file directly in a DAW. (Some DAWs import it, but you'll lose nothing by exporting MIDI from your notation editor instead.)

## PDF — the read-only format

PDF is the final-form output. It's what you print, what you put on a stand, what you email to a student.

**Use PDF when you want to:**
- Read on tablet (forScore, Newzik, MobileSheets).
- Print a chart for a gig tonight.
- Lock the engraving so the recipient can't accidentally rearrange measures.

**Don't use PDF when you want to:**
- Edit. PDFs are not designed to be re-flowed.

## A typical workflow

For a working drummer prepping a setlist:

1. Upload track → download **PDF** for the gig.
2. Need to add cues or rehearsal marks? Open the **MusicXML** in MuseScore, edit, re-export PDF.
3. Building a backing track or click? Pull the **MIDI** into your DAW.

Three formats, one upload. Pick the right tool for the moment.
$body$,
 'GrooveSheet Team', 5, false, 'medium', '2025-10-07T10:00:00Z'),

-- ============================================================
('understanding-ghost-notes-detection',
 'Understanding Ghost Notes: How GrooveSheet Detects the Subtlest Rhythms',
 'A look into how ghost-note sensitivity works, why ghost notes matter musically, and how you can fine-tune detection inside GrooveSheet.',
 $body$
The difference between a beginner playing a backbeat and Bernard Purdie playing the same backbeat is mostly **ghost notes** — the barely-audible snare hits between the loud ones that turn a metronomic groove into something that breathes.

## What counts as a ghost note?

Technically: a snare hit played at very low velocity (typically 15–40 on a MIDI 0–127 scale) compared to the loud "accent" snare on beats 2 and 4.

Musically: it's the texture. Listen to "Cold Sweat" (Clyde Stubblefield), anything off "Aja" (Steve Gadd), or modern players like Anika Nilles — the loud snare hits are 20% of the part; the ghost notes are 80% of the feel.

## Why detection is hard

Three problems compound:

1. **Low signal-to-noise.** Ghost notes can be quieter than the bleed from the hi-hat mic.
2. **Time-resolution.** They land on sixteenth-note and even thirty-second-note subdivisions where the quantizer wants to round them away.
3. **Confusion with rim/brush sounds.** A model can mistake a soft ghost for a rim click or a stick-on-snare brush.

## How GrooveSheet handles it

Our drum worker (ADTOF) outputs an onset list with per-onset confidence scores. After detection we run a **velocity normalization pass**: we look at the distribution of confidence values across the track and map them to a velocity range. The accented snare on 2 and 4 sets the upper bound; the noise floor sets the lower bound.

You can then control which low-velocity events make it into the final score via a **ghost-note sensitivity** slider:

- **Low sensitivity.** Only confident, mid-velocity-and-above events. Clean score, easy to read, loses subtle feel.
- **Default.** Includes ghosts down to ~velocity 25. Good balance for most pop/rock/funk.
- **High sensitivity.** Down to velocity 10. Captures everything including faint bleed — readable only if you're already a competent transcriber.

## When to crank it up

- Funk, neo-soul, R&B, hip-hop drum samples — the ghost notes *are* the part.
- Studying a specific drummer's vocabulary (transcribing for educational purposes).

## When to dial it back

- Charts for live performance. A drummer reading at tempo doesn't need every micro-event.
- Drum-machine-style tracks where ghosts would be machine noise, not intent.

## How to read the output

In MusicXML and PDF output, ghost notes appear with parentheses around the notehead — the standard convention. In MIDI, they appear as low-velocity hits, which any DAW will play back with the correct dynamics.

The slider isn't a "be more accurate" knob. It's a "match my use case" knob.
$body$,
 'GrooveSheet Team', 6, false, 'medium', '2025-10-03T10:00:00Z'),

-- ============================================================
('drum-teachers-cut-prep-time-80-percent',
 'How Drum Teachers Use GrooveSheet to Cut Prep Time by 80%',
 'Real instructor workflows showing how automated transcription speeds up lesson planning, student analysis, and content creation.',
 $body$
Drum teachers don't get paid to transcribe. They get paid to teach. But every hour spent notating a song the student wants to learn is an hour not spent in front of a kit. We talked to teachers using GrooveSheet across three formats — private lessons, school programs, and YouTube content — about what changed.

## The private lesson workflow

**Before.** Student requests "Black Hole Sun" for next week. Teacher spends 45 minutes Friday night transcribing the verse and chorus by ear, writes it cleanly in MuseScore, prints it for Saturday's lesson.

**After.** Teacher uploads the track in the morning before the lesson, downloads the transcription, spends 5 minutes correcting one tom fill the model misread. Total time: 8 minutes instead of 45.

What changes:
- **More songs per term.** Students used to bring 3–4 songs per quarter. They now bring 10+ because the teacher doesn't dread the prep.
- **Closer to the recording.** Manual transcription tends to "smooth out" fills the teacher can't quite hear. AI catches the weird sixteenth-rest in the second chorus.
- **Teaching the corrections.** Looking at the AI output together becomes a listening exercise: "the model heard a snare here — listen, do you agree?"

## The school program workflow

A high-school drum program teacher: "I run 4 ensembles. Every concert cycle I'd spend 20+ hours arranging and notating charts. Now I drop the reference recording in, get a starting chart, and arrange from there. The starting chart is 70% correct, which means I'm editing instead of writing from a blank page."

Tip: schools running a single GrooveSheet account can use folder organization to separate ensembles. Charts live in shared Google Drive folders alongside the original audio so students can practice with the recording.

## The content-creator workflow

Drum YouTubers who do play-along videos used to need a transcriber on retainer. Some now skip that step entirely:

1. Pick the song for the week.
2. Upload to GrooveSheet → MusicXML.
3. Tweak in notation software.
4. Export PDF for the video overlay.

A 60-minute task becomes a 15-minute task. Multiplied across a weekly upload schedule, that's freeing up most of a workday.

## What teachers say they *don't* use it for

Honestly: anything where the feel is the lesson. A swung-eighth jazz comping pattern doesn't transcribe cleanly because the model quantizes to the nearest sixteenth — it *can't* show the swing. For those lessons, teachers still play it themselves.

## The pattern across all three

The 80% figure isn't from a model accuracy improvement. It's from **removing the blank page**. Editing an existing transcription is fundamentally a different cognitive task than producing one from scratch. Teachers report less mental fatigue, faster prep, and — counterintuitively — better-quality final charts because they have more energy left for the parts that need human judgment.
$body$,
 'GrooveSheet Team', 5, false, 'medium', '2025-09-27T10:00:00Z'),

-- ============================================================
('learning-song-by-ear-vs-notation',
 'I Tried Learning a Song Only by Ear vs Only by Notation',
 'A drummer''s mini-experiment: learning the same track twice, once by ear and once with sheet music, and what each approach secretly teaches you.',
 $body$
I picked a track I'd never heard before — a mid-tempo funk tune with a tricky shuffle feel — and gave myself two days. Day one: learn it purely by ear. Day two: learn it from a transcription only. Same total time budget (90 minutes each). Here's what happened.

## Day 1 — ear only

Hour 1 was slow. I sat with the track on loop, tapping the kick pattern on my thigh, trying to figure out where the ghost notes sat. I caught the main backbeat fast. The chorus fill took 25 minutes to get even approximately right.

What I noticed: my mental model of the song became weirdly **emotional**. I remembered the fill not as "snare, tom, tom, kick" but as "the part where the energy drops." I could feel where the band breathed.

But I also got things wrong. I missed an entire ghost-note pattern in the bridge because the bass was loud and I wasn't separating frequencies in my head. I assumed a kick on beat 1 of measure 12 that didn't actually exist.

## Day 2 — notation only

I ran the track through GrooveSheet, downloaded the PDF, and **did not listen to the audio** while practicing. Pure sight-reading.

This was faster. 30 minutes in I had the structure down. 60 minutes in I was playing it cleanly. The ghost-note pattern I'd missed on day 1? It was right there on the page, in parentheses, where it always was.

What I lost: I had no idea what the song *felt* like. I was playing the right notes at the right times with no relationship to the band. When I finally put the recording on and played along, the first take was technically correct and emotionally dead.

## The synthesis

Doing both is obvious in hindsight: read the chart **and** listen. But the experiment showed me something specific about what each mode actually trains:

- **Ear only** trains your ability to *predict* — to know what's coming because you've internalized the song.
- **Notation only** trains your ability to *execute* — to hit the right thing at the right time without having to think.

Most working drummers I know lean too far into one. Reading-heavy players sound stiff. Ear-only players miss subtle things and can't communicate with a section. The interesting growth happens when you alternate deliberately — one rehearsal pass with the chart down, one pass eyes-closed.

GrooveSheet transcription doesn't replace the ear. It frees you up to spend ear-time on the parts that need ears — feel, dynamics, response — and execution-time on the parts that need eyes.
$body$,
 'GrooveSheet Team', 4, false, 'medium', '2025-10-03T10:30:00Z'),

-- ============================================================
('how-drummers-actually-use-transcriptions',
 'How Drummers Actually Use Transcriptions in Real Life',
 'From last-minute gig prep to flexing on TikTok, a look at the real, messy, human ways drummers use sheet music outside of music school.',
 $body$
The image of a drum transcription most non-drummers have is "music-school exercise." The reality is messier and way more interesting.

## The 4pm sub call

You get a text at 4pm. Band needs a sub for the 9pm gig. They send a Dropbox link with 14 songs. There is no chart. There is no rehearsal. There is the recording and you.

Standard prep: run the setlist through transcription, skim the PDFs on the drive over, ear-out the tricky parts at soundcheck. The transcription isn't *the* preparation — it's the cheat sheet that lets you load the whole set into working memory in 90 minutes instead of 9 hours.

## The "wait, how does that fill go" moment

You're learning a song for fun. You've got 90% of it. There's one fill at the bridge that's eluding you — your hands keep landing on a triplet but the recording is clearly some kind of sixteenth-note thing.

You pull the transcription up. *Oh. It's a sixteenth-note triplet with a flam.* Ten seconds of looking saves twenty minutes of repeated wrong attempts.

## The teacher's prep stack

Private instructors have folders organized by genre, decade, or skill level. New student comes in: pull from the right folder. Old-school teachers had filing cabinets; new-school teachers have a Google Drive structured by tag.

## The TikTok flex

Drum content on social media has a specific format: 15 seconds, fast cuts, the camera over your shoulder showing the chart on a stand. The chart is performative — the viewer can't actually read it at that speed — but it telegraphs **legitimacy**. "This is a real transcription, not me improvising and calling it the song."

Some creators print intentionally over-detailed charts (full ghost notes, dynamic markings, every cymbal accent) precisely because the visual density looks impressive on camera.

## The DAW pre-production session

You're producing a track and the demo drummer's part is close but not quite right. You import the MIDI transcription of a reference song you like, drag bars around, swap fills, get to something that captures the *vibe* of the reference without copying it. The MIDI is a sketching tool, not a final product.

## The audition tape

Players auditioning for tours / cruise ships / theatrical gigs increasingly send video of themselves reading down unfamiliar charts on first pass. Transcription tools generate the test material — pick a song the candidate has never heard, transcribe it, time-stamped video of them sight-reading it.

## The takeaway

Transcriptions in the real world are rarely studied. They're consumed, used, marked up, and thrown out. The value is in the speed and the convenience — having the part **right now** at varying levels of polish. Music-school transcription was about the rigor of the process. Working-drummer transcription is about getting through the night.
$body$,
 'GrooveSheet Team', 6, false, 'medium', '2025-11-06T10:00:00Z'),

-- ============================================================
('drum-practice-feels-stuck-make-it-fun-again',
 'Why Your Drum Practice Feels Stuck (And How to Make It Fun Again)',
 'Turning stale practice routines into something you actually look forward to — with playlists, micro-goals, and recording yourself without cringing.',
 $body$
You sit down at the kit. You play paradiddles for ten minutes. You play through "Wipe Out" because muscle memory. You check your phone. You play paradiddles again. You quit after 25 minutes and feel guilty.

This is the practice rut. Every drummer hits it. The way out is structural, not motivational.

## Diagnose the rut

Three causes show up most:

1. **No measurable outcome.** You're "practicing" but you couldn't say what would make today's session a success.
2. **No new input.** You're playing things you already know how to play.
3. **No external reference.** You can't tell if you're getting better.

Fix the structure, not the willpower.

## Replace the practice routine with a practice queue

Stop having "a practice routine." Start having a **queue of songs you're learning**. Three at a time, max. Each one has a status:

- **Learning.** Working through the chart. Goal: get it to half tempo cleanly.
- **Tightening.** Playing along at full tempo. Goal: nail the fills.
- **Performing.** Recording yourself playing it as if it were a gig.

When a song graduates from "performing" you swap in a new one at the bottom. The queue is always moving.

## Use transcriptions as scaffolding, not crutches

Drop the song into GrooveSheet, get the chart. Use it for the first three sessions to nail the structure. Then **practice without the chart**. The chart was the bridge; the goal is internalizing the song.

If you find yourself reading the chart at session 10, something's wrong. Either the song is too hard for your current level (swap it down the queue) or you're using the chart as a comfort blanket.

## The 20-minute focused session beats the 90-minute scattered one

If you have 20 minutes:
- 2 min — warm-up, single strokes
- 5 min — one specific problem area from one song (the fill you keep missing)
- 10 min — play through the song full tempo, with a click
- 3 min — record one take

If you have 90 minutes, do that four times with different songs. Don't drift.

## Record yourself. Watch it back. Don't cringe.

The cringe is the lesson. You're not cringing because you're bad. You're cringing because the gap between your self-image and the reality is information. Most players never see that gap because they never record.

Phone propped against the bass drum. One take per session. Watch it back once before bed. Don't keep the videos.

## The fun comes from progress, not from variety

Most "practice is boring" complaints are actually "I can't see I'm improving" complaints. The fix isn't more variety. The fix is making improvement legible — a recording, a checked-off chart, a song that moves from "learning" to "performing." Build the system. Fun follows.
$body$,
 'GrooveSheet Team', 6, false, 'medium', '2025-11-15T10:00:00Z'),

-- ============================================================
('muscle-memory-deep-dive-drumming',
 'Can You Really Learn to Play by Feel? A Deep Dive into Muscle Memory',
 'Breaking down the science (and myth) of muscle memory on the drums, and how long it actually takes for grooves to feel automatic.',
 $body$
"Muscle memory" is a misnomer — your muscles don't remember anything. The patterns live in your motor cortex, basal ganglia, and cerebellum. Understanding what's actually happening when a groove starts to "feel automatic" changes how you practice it.

## The three stages of motor learning

Psychologists Fitts and Posner mapped motor skill acquisition into three stages, and they map cleanly onto drumming:

1. **Cognitive.** You're thinking explicitly about each limb. "Right hand on hi-hat, left hand snare on 2 and 4." Heavily mental load. You can't talk while playing.
2. **Associative.** You stop narrating every limb. You still notice errors. You can hold a conversation but it degrades the part.
3. **Autonomous.** The pattern runs without conscious access. You can converse, read another chart, or improvise on top of it.

The myth is that autonomous = effortless. It isn't. You still need attention available; you just don't spend it on the base pattern anymore.

## How long it actually takes

For a single new groove at moderate tempo:

- **Cognitive → associative**: 1–3 sessions of focused practice.
- **Associative → autonomous**: 10–40 sessions over several weeks.
- **Truly burned in**: 6 months of intermittent use.

The wide range is because **density of practice matters more than total hours**. Five sessions of 20 minutes spread across a week beat one session of 100 minutes. Sleep consolidates motor memory; you need the gaps.

## What you can't shortcut

Three things sabotage automaticity:

1. **Practicing too fast too soon.** If you can't play the part cleanly at 60% tempo, playing it at 100% locks in errors. The errors become the autonomous pattern.
2. **Practicing inconsistently.** Three sessions this week, zero next week, two the week after. The brain treats it like a new skill each time.
3. **Practicing with mental load.** Watching TV while you drill. The associative stage requires attention. Distraction freezes you there.

## Why charts help, then hurt

In the cognitive stage, a chart is a lifeline — you offload the "what comes next?" burden onto the page. In the autonomous stage, a chart is a distraction — you're reading what you already know, splitting attention you should be spending on dynamics and feel.

The transition point is where most drummers stall. They keep the chart on the stand because it's comfortable. Force yourself to put it away when you can play through the song twice cleanly. Discomfort is the signal you're moving forward.

## The "feel" question

Can you learn to play by feel? Yes — feel is what autonomy *is*. But feel doesn't appear at session one. It emerges when the cognitive load drops low enough that the song-level patterns (where does the band breathe? where does it push? where does it pull?) become perceptible. Until then you're playing the right notes without playing the song.

The boring answer wins. Slow practice, consistent practice, recorded practice, patience.
$body$,
 'GrooveSheet Team', 6, false, 'medium', '2025-10-03T11:00:00Z'),

-- ============================================================
('steal-like-a-drummer',
 'Steal Like a Drummer: How to Borrow Grooves Without Copying',
 'How to "sample" your favorite drummers'' ideas ethically — tweaking feel, orchestration, and tempo so it becomes your own voice behind the kit.',
 $body$
Every great drummer is a thief. Bonham stole from Jim Gordon. Vinnie Colaiuta stole from Tony Williams. Questlove stole from J Dilla (who was sampling drummers in the first place). The question isn't whether to steal — it's how to steal *well*.

## Copying vs. borrowing

Copying is reproducing a groove note-for-note. It's a useful exercise but a dead end for your own playing.

Borrowing is taking one **dimension** of a groove and porting it into a different context:

- The **orchestration** (which limbs land where) without the feel.
- The **feel** (push, pull, swing) without the orchestration.
- The **fill vocabulary** (a specific stick pattern) dropped into a different song.
- The **dynamic shape** (where the part breathes) translated to your own grooves.

## The transcription-as-source-material workflow

Pull a track you love through transcription. Open the MIDI in your DAW. Then break it apart:

1. **Mute everything but the kick pattern.** Loop it. What's distinctive? Is it the *placement* (back of the beat?) or the *frequency* (lots of doubled kicks)?
2. **Mute everything but the hi-hat.** Same questions. Open hats vs. closed hats. Eighths vs. sixteenths. Where does the foot pedal hit relative to the kick?
3. **Mute everything but the snare and ghosts.** This is usually where the personality lives. The placement and density of ghost notes is a signature.

Now you have three isolated patterns instead of one mash-up.

## Reassembly

Take one of the three and combine it with your own version of the other two. The kick pattern from Steve Gadd's "50 Ways to Leave Your Lover" + hats and snare that are entirely yours = a fresh groove that *sounds* sophisticated because the kick part is doing sophisticated work.

The reverse also works: keep your default kick-snare pattern, transplant Questlove's ghost-note density on top. Same backbone, completely different texture.

## Genre laundering

Take a groove from genre A, slow it down, change the time signature feel (8ths to triplets), and put it in genre B. A drum-and-bass pattern reinterpreted as a half-time shuffle is no longer drum-and-bass — it's something new.

## The ethical line

Stealing one drummer's exact part on a recording: bad form (and legally murky if you're profiting).

Stealing the idea behind a part and refactoring it across hundreds of grooves: how the tradition works. Everyone is doing this. The only difference is whether you're conscious of it.

## How to know it's working

A groove you borrowed becomes "yours" when you can't remember anymore which drummer you stole it from. That's the sign it's been metabolized — recombined with enough other influences to become indistinguishable from your own voice.

Transcription is the tool that makes this analysis possible. You can hear a great drummer for years and not notice the kick pattern is doing the heavy lifting. The chart shows you immediately.
$body$,
 'GrooveSheet Team', 6, false, 'medium', '2025-10-03T11:30:00Z'),

-- ============================================================
('bedroom-kit-to-first-gig-upgrade-path',
 'From Bedroom Kit to First Gig: A Drummer''s Realistic Upgrade Path',
 'What to actually upgrade (and what to ignore) on your journey from practicing at home to playing shows without blowing your entire savings.',
 $body$
Drum gear advice on the internet is a hellscape. Forum threads from 2008 telling you to spend $4,000 on a Yamaha Recording Custom before your first gig. YouTube reviews of $600 snares aimed at hobbyists who haven't played a session yet. Here's an opinionated, practical path.

## Stage 1 — bedroom kit ($0 invested in gear)

You have a kit. It works. Don't upgrade anything yet.

What to actually spend money on:
- **Lessons** (5–10 hours of instruction beats $500 in gear at this stage).
- **Hearing protection** (Vater V-Tek, Etymotic ER-20 — $20–$60). Non-negotiable.
- **A practice pad** ($30) for apartment practice and warm-ups.
- **A metronome app** (free). Don't buy a hardware one.

Total: under $150.

## Stage 2 — first gig prep ($200–$500)

You've been offered a gig. Maybe a friend's band, maybe a coffee shop, maybe a wedding gig. Upgrade priorities, ranked:

1. **Heads.** Old, dead heads are why your kit sounds bad in a room. New Remo Ambassadors on toms, a coated Ambassador on snare, an EMAD on the kick. ~$120.
2. **A cymbal bag that doesn't suck.** Hard case, not a soft sleeve. Cymbals crack in transit. $80.
3. **A bass-drum mic.** If venues don't provide one. Audix D6 or Shure Beta 52A used. $80–$150.
4. **A stool with a memory-foam top.** You'll be on it for three hours straight. $80.

What NOT to buy at this stage:
- Custom snare. Your kit snare with a new head is fine.
- High-end cymbals. Your starter Zildjian ZBTs sound better than you think on stage.
- A second kick pedal. You're not double-kicking your first gigs.

## Stage 3 — second year of gigging ($500–$1500)

Now you've played 20+ gigs. You know what you actually use.

1. **A better snare.** This is where most drummers find their voice. Used Ludwig Black Beauty, used Yamaha Maple Custom, used Pearl Reference. Buy used.
2. **A real cymbal set.** Used K Zildjians or Sabian HHX. Buy in pieces, not as a pack.
3. **A pedal that matches your foot.** DW 5000 or Pearl Eliminator. Try in person.

This is also when transcription tools start to pay for themselves — the gigging drummer who can transcribe a song in 5 minutes prepares for a sub call differently than the drummer who can't.

## Stage 4 — tour-level investment ($2000+)

If you're touring or recording professionally:

- **A pro kit.** Used Yamaha Recording Custom or DW Collector's Series. New if you must.
- **An electronic backup.** Roland TD-27 for silent practice on the road.
- **Microphones for your own use.** Audix DP7, Shure Beta drum kit, etc.

But — most drummers reading this aren't here. And that's fine. The diminishing returns kick in fast.

## What everyone gets wrong

Spending money instead of practicing. A $600 snare on a drummer with a weak backbeat sounds worse than a $150 snare on a drummer with a great backbeat. Always.

Buy the cheap thing. Play the cheap thing for a year. Then upgrade when you can articulate exactly why the cheap thing isn't working.
$body$,
 'GrooveSheet Team', 6, false, 'medium', '2025-10-03T12:00:00Z')

on conflict (slug) do update
  set title           = excluded.title,
      excerpt         = excluded.excerpt,
      body_md         = excluded.body_md,
      author          = excluded.author,
      read_time_min   = excluded.read_time_min,
      featured        = excluded.featured,
      size            = excluded.size,
      published_at    = excluded.published_at;
