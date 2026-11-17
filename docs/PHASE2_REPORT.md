# Phase 2 progress

## Sprint 3.1 — 2026-11-16

- **PASS, synthetic:** Silero 6.2.3 ONNX independently analyzed both channels and unioned detections. Locally generated English synthetic speech placed left-only, right-only, and alternating returned the expected channel provenance. The automated channel mapping regression uses stubbed inference; real-model evidence is the separate local run. VAD can still miss speech: every proposed removal remains a human REVIEW decision. Vietnamese broadcast audio and subjective listening are NOT TESTED.
- **PASS, synthetic:** explicit, EDL-recorded PCM16 fade-in/fade-out and crossfade, capped at 10 ms, preserve sample rate and channels; crossfade shortens output by its overlap. Tests cover stereo discontinuity, clipping bounds, deterministic EDL render and output frame count. They do not establish consonant preservation or perceptual quality; human listening is required. Effects are opt-in through EDL, not automatically applied by the review CLI.
- **PASS, synthetic:** FFmpeg 7.1 at `C:\Program Files\FormatFactory5.21.0.0\ffmpeg.exe` has `libmp3lame`. Stereo 48 kHz synthetic WAV was encoded to MP3, decoded to verify duration/sample rate/channels, and the source retained. MP3 is lossy. Missing executable and existing destination are rejected. Explicit encoder-unavailable and subjective MP3 listening are NOT TESTED.
- **PASS, injected failures:** EDL and WAV are prepared and checked before publishing via exclusive links; EDL is published last. Render error or injected EDL publication failure produces no final EDL. A crash between links can leave an orphan WAV, reported for manual inspection; two-file atomic publication is not guaranteed. Temp and output files reside on their destination filesystems and require hard-link support.
- **PASS:** 38 Node tests (including local FFmpeg), six Python tests (one uses a stub for per-channel union, five backend), and eight skill checks. GitHub Actions result for this revision must be checked separately; model-dependent tests are local only.
- Preview cleanup is an explicit command after the user closes the player; preview audio stays local. No real audio or speech text was logged or uploaded. No subjective listening assessment was performed.

## Sprint 3 progress — 2026-11-16

- **PASS (local synthetic voice):** Silero VAD 6.2.3 ONNX ran on an English Windows-generated synthetic speech WAV at 22,050 Hz, 117,716 frames. It reported source frame ranges `[0,46041)` and `[58388,106017)`. CLI ran the model and rendered a distinct WAV with zero approved removals and unchanged source hash. No real Vietnamese recording or accuracy benchmark was used.
- **PASS (synthetic automated tests):** 32 Node tests, five Python backend tests and eight skill checks passed. Stereo preview includes 0.5 s context on each side, and output duration after removal was verified. Approve, reject, cancel and output collision behavior tested. Entering `yes` in an automated test is not evidence of listening.
- **LIMITED:** CLI writes before/after preview files into the operating system temporary directory and offers Windows default-player launch. Player launch and human listening have not been observed. Preview audio remains in temporary storage until manually removed. Detection is conservative but may miss quiet speech; stereo inference selects the higher-energy channel and may miss speech isolated in the other channel. Review is mandatory.
- **BLOCKED / NOT TESTED:** fades/crossfades, MP3 export and their regression checks are not implemented. FFmpeg 7.1 from `C:\Program Files\FormatFactory5.21.0.0\ffmpeg.exe` was verified via `-version`; encoding was not tested. Soft speech, noise, breath, expressive pauses and Vietnamese speech accuracy have not been verified on real recordings. The model runtime was tested locally, not in CI. CEP remains UNVERIFIED.
- **Safety:** Human approval is required for every removed interval; no automatic removal. EDL records detector and settings, original SHA-256 and approved ranges. WAV ancillary metadata is dropped with a warning. A warning is displayed when removals exceed 25% of duration.

## Sprint 2 evidence — 2026-11-16

An experimental CLI performs peak-energy activity detection over PCM16 mono/stereo at the source sample rate (no resampling), pads detected activity by 200 ms, proposes long low-energy spans, asks the operator to listen and explicitly approve each removal, then writes an EDL and a separate WAV and checks its frame count and source hash. No automatic removal occurs. Peak energy is not a speech classifier; weak speech/noise can be misclassified, so the workflow is experimental and requires listening. Synthetic tests covered 8 kHz mono and 48 kHz stereo, approval, rejection at EDL level, source hash, output and collision. Real Vietnamese recordings and accuracy are NOT TESTED.

`npm.cmd test`: 30 passed, 0 failed; eight skill checks passed. Python unittest: five passed, zero failed. GitHub Actions workflow added; remote CI result is pending until observed.

Silero VAD supports 8/16 kHz models and would need a validated downmix/resampling pipeline for other input rates ([Silero FAQ](https://github.com/snakers4/silero-vad/wiki/FAQ)). Faster-whisper is a potential local multilingual adapter ([project](https://github.com/SYSTRAN/faster-whisper)); neither model has been installed or benchmarked. No WER/CER claims. FFmpeg was not found on PATH; MP3 remains untested. Fades/crossfades remain unimplemented. Custom CEP and host APIs remain UNVERIFIED.

Foundation `fcad99b40f66d6ae5119b163b80469480973d3b9`; development branch `feat/phase2-runtime-integration`. This is work in progress, not acceptance.

## Backend

Codex bundled Python 3.12.14 was located and used to create ignored `.venv`. The standalone POC server was started as a separate process and returned successful `/health` and synthetic `/echo` responses on `127.0.0.1:8765`. Four Python HTTP integration tests use a separate ephemeral loopback port. No recording was sent. This does not verify an Audition panel connection.

## Speech analysis

Six adapter contracts cover VAD, ASR, alignment, retakes, ranking and review. Source frame ranges are checked and findings always require human review. No VAD, ASR, alignment, ranking model or real Vietnamese data has been implemented or validated; test adapters are mocks.

## Audio and metadata

Existing renderer remains unchanged. WAV ancillary metadata and markers are dropped (`metadataPreserved: false`); time-based metadata cannot be copied blindly after edits. Production policy must preserve safe static fields only where supported, recalculate time-dependent fields, and warn or refuse when required metadata cannot be retained. Fades/crossfades and MP3 export are not implemented. FFmpeg has not been verified. No timeline editing has been added.

## Audition

Audition binary file version 26.0.0.56 is present. CEP custom panel, ExtendScript and backend round trip in the host remain UNVERIFIED. A signed ZXP and its compatibility have not been produced or verified; Adobe SDK/signing tool was not located in the checked paths. No extension installed, debug setting or registry changed. The approval needed for installation must identify its package and installation method.

## Checks and remaining work

Node suite: 26 passed, 0 failed; eight basic skill checks passed. Python suite: 5 passed, 0 failed, including the UTC logging regression. These counts exclude host integration, audio listening, production models, fades and MP3. Retain historical Phase 1 reports as evidence. Phase 2 is incomplete pending these items and real-host validation.
