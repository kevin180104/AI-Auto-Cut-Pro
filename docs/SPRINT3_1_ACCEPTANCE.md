# Sprint 3.1 — Audio acceptance

Baseline: 91278f0a360f06a2963e2663b672661d658673ae. Date: 2026-11-16 (Asia/Saigon).

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline regression | PASS | Windows, Node 24, Python 3.12. 38 Node and 6 Python tests passed, plus 8 skill checks. MP3 test used FFmpeg 7.1 and libmp3lame. |
| Local storage | PASS | Git ignores work/acceptance/. Audio, previews, EDL and review JSON stay there. |
| Silero and preview | PASS (synthetic) | Silero ONNX 6.2.3 analyzed mono PCM16 at 22,050 Hz. The fixture repeats Windows synthetic English speech with three seconds of inserted digital silence. The local review JSON lists speech, quiet ranges and proposals. One before/after preview pair was generated. |
| WAV, EDL and MP3 | PASS (synthetic) | Input 301,582 frames. Approved fixture-only cut removed 75,851 frames. Hard cut 225,731 frames. Crossfade 225,621 frames. MP3 192 kbps decoded to 225,621 frames, 22,050 Hz mono. Original SHA-256 rechecked unchanged. |
| Adobe Audition | PASS (synthetic Waveform open) | Audition 26 opened crossfade.wav and crossfade.mp3 in Waveform Editor on Windows. Import into a multitrack session was NOT TESTED. |
| Vietnamese broadcast sample | BLOCKED | No authorized local recording received. |
| Human listening and fade quality | NOT TESTED | No listener feedback. Automated checks cannot determine speech completeness, naturalness or whether a join sounds better. |

## Join to review

| ID | Source cut in frames | Source time | Listen in output |
| --- | --- | --- | --- |
| quiet-1 | [106017, 181868) | 4.808–8.248 s | Hard cut at 4.808 s. Crossfade from 4.803 to 4.808 s, 110 frames of overlap. |

Open quiet-1-before.wav and quiet-1-after.wav to compare one second of context on both sides. Compare hard-cut.wav and crossfade.wav around the join, then listen to crossfade.mp3 at the same location. Record a separate verdict for each version and note clicks, room tone changes, breath loss and initial/final consonants. For a real sample, first listen to each proposed removal in context. Use b/a in the existing review CLI to play the previews and approve only the ranges you have checked. Keep uncertain ranges. Record only anonymous sample IDs, timecodes and verdicts in this document. Keep paths, transcripts and recordings local.

## Known limits and defects

Crossfade shortens the output by its overlap. Ancillary WAV metadata is dropped. WAV and EDL publication is not atomic as a pair and interrupted publication can leave an orphan WAV. Silero can miss quiet speech. MP3 is lossy. The acceptance run found no new reproducible product defect.

## Decision

Sprint 3.1 is not accepted for production or Sprint 4. Authorization for a Vietnamese WAV and actual listening results are still required. Check every real join and compare fade/crossfade variants before recording an acceptance verdict.
