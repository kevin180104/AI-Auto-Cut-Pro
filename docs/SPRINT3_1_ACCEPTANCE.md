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

## Authorized Vietnamese recording — follow-up

Sample real-01 is a user-authorized local Vietnamese recording, mono IEEE float WAV, 48 kHz, 107,064,320 frames (37:10.507). No source filename, transcript, audio or per-cut timecodes are published. All review artifacts reside in ignored local storage under work/acceptance/real-01/.

| Check | Result | Evidence |
| --- | --- | --- |
| Direct Silero input | FAIL | The PCM16-only Python adapter rejected the IEEE float WAV (format tag 3). |
| Silero with analysis copy | PASS | Converted a separate copy to PCM16 at the same rate, frame count and channel count. Silero ONNX produced 239 detected activity intervals, 240 complementary low-activity intervals and 140 proposals. These are model detections awaiting review. |
| Per-proposal previews | PASS | Generated 280 structurally valid float WAV previews from the original sample bytes. The before/after pairs include up to one second of context on each side. |
| Reference WAV and source integrity | PASS | Rendered a keep-all EDL with zero cuts. Reopened WAV contains byte-identical audio samples, 48 kHz mono float32, 107,064,320 frames. Original whole-file SHA-256 remained unchanged. |
| Reference MP3 | PASS | FFmpeg 7.1 encoded 192 kbps MP3 and decoded it back to 107,064,320 frames, 48 kHz mono. |
| Real recording in Audition | NOT TESTED | The controlled attempt did not yield a verifiable file-open result because the Audition accessibility state became unavailable. |
| Listening, approved real edits and fade/crossfade | NOT TESTED | The user has not yet reviewed the proposals. No real edits or effects were applied to the reference files. |

Use the local LISTEN.md for the full join list and review.json for frame-accurate regions. Mark each proposal KEEP, APPROVE or REVIEW after listening to both files. For approved interior joins, compare the plain cut and fade/crossfade versions at matched playback level and record clicks, consonants, breathing, pacing and room tone. Audition opening of synthetic exports remains a separate result.

The PCM16 analysis copy is a workaround for the documented model input limit. It does not quantize the reference WAV or previews. No new product defect was confirmed. Production acceptance remains pending human listening and validation of any approved real edits.
