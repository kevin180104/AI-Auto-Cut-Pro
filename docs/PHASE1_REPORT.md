# Phase 1 — Foundation and Integration Evidence

**Date:** 2026-11-16 (Asia/Saigon)
**Status:** In progress; acceptance criteria not met.

## Repository and environment

- Current branch: `feat/phase1-foundation`.
- The repository has no commits and no configured remote. The project files are staged; no commit or PR can be created until a remote and Git author identity are configured.
- Adobe Audition was found at `C:\Program Files\Adobe\Adobe Audition 2026\Adobe Audition.exe`; ProductVersion `26.0.0`, FileVersion `26.0.0.56`.
- Node.js `v24.12.0`, npm `11.6.2`, Git `2.56.0.windows.4`.
- Python launchers were not found in PATH; FFmpeg was not found in PATH or common locations checked. This does not prove they are absent elsewhere.
- No software was installed and no Audition preferences were changed.

## Verification summary

| Area | Result | Evidence boundary |
| --- | --- | --- |
| `npm.cmd test` | PASS, 19 Node tests, 0 failures; 8 skill metadata/scenario checks pass | Synthetic fixtures only; see test output from 2026-11-16 |
| Skill inventory | PASS, 8 required project skills | Basic metadata and scenario validator; does not judge skill quality |
| Audio Engine WAV render | PASS for the tested synthetic fixtures | Does not establish suitability for real broadcast recordings |
| Real Vietnamese radio recordings | NOT TESTED | No approved sample recording was available in the workspace |
| Audition installation/version | SUPPORTED | Binary metadata and running host observed |
| Audition Portal panel | SUPPORTED | Built-in Adobe Audition Portal panel opened in Audition 26.0.0.56 |
| WAV file handoff | LIMITED | Synthetic rendered WAV opened in the real Audition waveform editor; no automated exchange protocol verified |
| Custom CEP/ExtendScript integration | UNVERIFIED | No test extension was built, installed, or executed |
| Panel/backend round trip | UNVERIFIED | No project panel/backend was connected to Audition |
| Session/file metadata API | UNVERIFIED | A file opened; session metadata API behavior was not exercised |
| Selection/timeline/cut/join API | UNVERIFIED | No supported host API operation was demonstrated |
| Adobe Audition simulation/mock | NOT RUN | There is no simulation result to report |

## Audio Engine scope and safety

`audio-engine/edl.js` validates EDL v1 using half-open integer sample-frame ranges, source SHA-256, stream metadata, separate source/output paths, complete source coverage, and non-overlapping ranges. Every removed segment needs explicit human approval, a reason, and evidence.

`audio-engine/wav.js` parses RIFF/WAVE PCM (8/16/24/32-bit) and IEEE float (32/64-bit), checks source hash and frame count, and copies retained frame bytes into a new WAV. It refuses an existing output path. The tested renderer does not modify the source. It currently handles one `fmt ` and one `data` chunk; ancillary metadata is dropped. It does not process MP3, fades, or effects.

The expanded synthetic tests cover PCM16/24/32, float32/64, mono/stereo, multiple sample rates, empty/truncated/invalid WAV input, overlapping and out-of-range EDL, source hash mismatch, output collision, edge-adjacent cuts, approved removals, source immutability, and byte preservation of retained ranges. These results apply only to the constructed test files. They do not certify audio quality or real-recording behavior.

## Adobe Audition proof of concept

The running Windows host was observed as Audition 26.0.0.56. Its existing **Window → Extensions → Adobe Audition Portal** panel opened successfully. This confirms the host can open that bundled panel; it does not prove a third-party extension can be installed or that ExtendScript calls work.

A one-second synthetic PCM16 mono 48 kHz WAV was rendered to a separate output path using an approved 500-frame removal. The output was opened in Audition's waveform editor, which displayed `synthetic-edl-output.wav` and a duration of approximately 0.989 seconds. This verifies a manual file-based export/open workflow for this fixture. It does not test real session transfer, metadata extraction, custom panel/backend exchange, or edit operations through an API.

| Capability | Classification | What was actually checked |
| --- | --- | --- |
| Detect installed Audition and version | SUPPORTED | Installed binary and live host reported 26.0.0.56 |
| Open built-in Portal panel | SUPPORTED | Panel appeared in the real host |
| CEP exists in this host | SUPPORTED (host panel only) | Bundled Portal panel opened; no custom extension lifecycle tested |
| ExtendScript calls in this host | UNVERIFIED | No script was executed |
| Custom panel ↔ backend exchange | UNVERIFIED | No round trip implemented |
| Read audio file in editor | SUPPORTED (manual WAV open) | Synthetic rendered WAV opened in Waveform view |
| Read session structure/metadata through API | UNVERIFIED | Not exercised |
| Programmatic selection/timeline edits/cut/join | UNVERIFIED | No supported API call demonstrated |
| File export → independent processing → re-import | LIMITED | WAV export and manual open were exercised; no round trip back into a session or timeline was tested |

Adobe's public pages describe CEP/ExtendScript, the Audition SDK, panels, metadata exchange, and session interchange at a high level. Documentation is context, not runtime proof. Sources: [Adobe Audition Developer](https://developer.adobe.com/audition/) and [Adobe Help: Enabling CEP extensions in Audition](https://helpx.adobe.com/audition/desktop/applying-effects/enabling-cep-extensions.html).

## Test data policy

- **Synthetic WAV:** tested locally; generated tone fixtures contain no user recording.
- **Real Vietnamese radio recording:** not tested. A fixture with documented access permission and an approved local path is still needed.
- **Adobe Audition simulation:** not run.
- **Real Adobe Audition:** installed host and bundled panel tested; synthetic output file opened. API editing and backend exchange remain unverified.
- No internal recording was uploaded to an external service.

## Remaining Phase 1 acceptance work

1. Provide/configure the intended GitHub remote and Git author identity; push this branch and open a PR. No repository was created or selected by this work.
2. Obtain the Audition SDK and run a custom CEP/ExtendScript round trip in a disposable test session without changing global host settings.
3. Demonstrate whether selection and timeline cut/join operations are exposed by supported APIs; otherwise define a reviewed file-based interchange workflow with an actual return import.
4. Test with a locally supplied, access-approved Vietnamese radio recording and report its provenance and checks separately from synthetic fixtures.
5. Define policy for WAV ancillary metadata and unsupported formats before production use.
6. Re-run the acceptance checks after the above evidence is available. Phase 1 is not declared complete.

## Test command

`npm.cmd test` runs the Node test suite and skill validator. Current result: **19 tests passed, 0 failed; 8 skill checks passed**.
