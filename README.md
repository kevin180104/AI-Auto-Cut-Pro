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
