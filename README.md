# AI Auto Cut Pro

AI Auto Cut Pro is a Windows-first, Vietnamese-first project for assisting with spoken-word audio editing. Its target workflow is to detect and group retakes, compare speech with a supplied script, propose reversible edits, render WAV/MP3, and produce an auditable edit report.

## Project status

The foundation is synchronized to [GitHub](https://github.com/kevin180104/AI-Auto-Cut-Pro) on `main` and `feat/phase1-foundation`. Phase 2 development uses `feat/phase2-runtime-integration`. Read [docs/PHASE1_REPORT.md](docs/PHASE1_REPORT.md) and [docs/PHASE1_5_REPORT.md](docs/PHASE1_5_REPORT.md) for historical evidence and limits.

Implemented: EDL v1 validation and a standalone RIFF/WAVE renderer in `audio-engine/`. The renderer copies approved PCM/IEEE-float sample frames into a new WAV and validates the source hash. It currently drops ancillary WAV metadata and does not render MP3, fades, or effects.

Speech recognition, Vietnamese script alignment, automatic take selection, and Audition integration are not implemented. No user recording has been tested.

## Safety model

- Source recordings are immutable inputs.
- Every removed range requires explicit human approval in the current EDL version.
- Every edit is reviewable and reversible through an EDL.
- Low-confidence speech and script differences go to human review.
- Audio and scripts stay local unless the user explicitly enables a named cloud provider and approves sending the data.
- Numbers, dates, names, and source-script content must be preserved.

## Development prerequisites

See the verified machine inventory and blockers in `docs/PHASE1_REPORT.md`. Node.js and Git are present. Python and FFmpeg were not found in the initial environment check. No software was installed.

## Layout

- `AGENTS.md`: repository-wide instructions.
- `.agents/skills/`: focused engineering playbooks for the required subsystems.
- `.ai/`: project rules, compatibility/audio safety constraints, architecture decisions, and defect memory.
- `audio-engine/`: EDL and WAV foundations.
- `docs/`: investigation reports and design notes.

The configured remote is `https://github.com/kevin180104/AI-Auto-Cut-Pro.git`.

## Checks

Run `npm.cmd test` to execute the Node unit tests and validate project skill metadata.

## Experimental local review CLI

`node scripts/review-wav.mjs input.wav output.wav output.edl.json` analyzes PCM16 mono/stereo WAV at its native sample rate. It reports low-energy ranges and asks for `yes` for each removal after listening. It writes a new EDL and WAV and checks the result and source hash. Other answers reject a proposed removal. The detector is peak energy, not a trained speech VAD: quiet speech can be misclassified. Review every proposed range and listen to the output. Ancillary WAV metadata is dropped. Never use this experimental tool for unattended edits or production recordings.

To use the experimental local Silero ONNX model, install `speech-analysis/requirements-vad.txt` in a Python environment, then set `$env:AACP_VAD_PYTHON` to its Python executable before running the same command. A model failure stops the workflow rather than silently switching detectors. Each proposal produces before/after WAV previews in the operating system temporary directory; `b` or `a` opens them with the default Windows player. Preview files contain audio and must be removed by the user when no longer needed. `yes` records manual approval, `q` cancels, and other input keeps the segment. The tool cannot verify actual listening. Both detectors remain experimental; review weak speech, breaths and intentional pauses carefully.

After closing any player using the previews, remove a printed preview directory explicitly with `node scripts/cleanup-previews.mjs <preview-directory>`. The command only accepts generated preview directories under the OS temp folder and rejects unexpected contents.

Optional PCM16 effects can be specified in an EDL as `effects: { "approval": "human-approved", "fadeInFrames": 0, "fadeOutFrames": 0, "crossfadeFrames": 0 }`. Crossfade overlaps retained audio, shortens the output, and is limited to 10 ms; listen to every join and do not apply it across speech. CLI review does not automatically add effects. Export a checked WAV as lossy MP3 with `node scripts/export-mp3.mjs <ffmpeg.exe> <input.wav> <new-output.mp3> [bitrate-kbps]`. This checks decoded duration and format, retains the WAV, and refuses to overwrite an existing MP3.

## Audio Review Studio

From the repository on Windows 11, run:

```powershell
npm.cmd run studio
Start-Process http://127.0.0.1:8768
```

Keep the first PowerShell window open and run the second command in another window. The Studio reads the existing private review dataset in work/acceptance/real-01. Navigate with Left/Right, compare with A/B, play/pause with Space and restart with R. Press 1 to keep, 2 to approve a cut, or 3 to return it to review. Changes to saved choices ask for confirmation.

At the end of the session, choose export and confirm. Only APPROVE intervals are removed. The optional 5 ms crossfade creates a separate comparison WAV and requires a second confirmation. Optional MP3 is made from the hard-cut WAV. Set AACP_FFMPEG to an alternative FFmpeg executable if needed. Exports and decision history stay in the ignored dataset folder. A revision that already has an export is protected from overwrite. The source file registered in the local reference EDL must remain available and unchanged. WAV ancillary metadata may be omitted and MP3 is lossy.
