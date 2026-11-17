# Error Memory

## P3-004 — FFmpeg missing on CI runner

- Detected 2026-11-16, GitHub Actions run 43828637921.
- Symptom: MP3 integration test failed with `spawnSync /usr/bin/ffmpeg ENOENT`.
- Cause: runner image did not provide FFmpeg at the assumed path.
- Fix: install FFmpeg in CI before invoking the unchanged integration test.
- Regression: GitHub Actions runs the same MP3 encode/decode test with `/usr/bin/ffmpeg`.
- Prevention: provision external executables explicitly in fresh CI environments. Status: CI rerun pending.

## P3-003 — Silero adapter rejects pathlib input

- Detected 2026-11-16 in synthetic stereo regression; `speech-analysis/silero_vad_local.py`.
- Symptom: `wave.open` treated `Path` as an open stream and raised `AttributeError`.
- Cause: Python 3.12 `wave.open` requires a string or file object.
- Fix: convert path-like objects with `os.fspath`.
- Regression: `test_silero_channels.py` invokes `detect` with pathlib paths for left, right and alternating channels.
- Prevention: normalize filesystem path-like objects at the API boundary. Status: pending regression verification.

## P3-002 — Stereo VAD selected only the loudest channel

- Detected 2026-11-16, baseline 7ec0959, `speech-analysis/silero_vad_local.py`.
- Symptom: speech isolated in the lower-energy channel could be omitted from protected ranges.
- Cause: selecting one channel based on whole-file mean energy discarded the other channel.
- Fix: infer independently on each channel and union frame ranges while retaining per-channel evidence.
- Regression: Silero 6.2.3 ONNX executed on local synthetic speech placed left-only, right-only and alternately; assert detected channel provenance. Real Vietnamese speech and noisy recordings remain untested.
- Prevention: protect the union of channel detections; never assume one channel represents the whole recording. Status: fixed for tested synthetic samples, accuracy not certified.

## P3-001 — EDL published before successful render

- Detected 2026-11-16, baseline 7ec0959, `scripts/review-wav.mjs`.
- Symptom: render failure could leave an EDL at its final path despite no valid WAV.
- Cause: EDL was written before render and verification.
- Fix: render and verify in destination-local temporary directories, publish WAV using exclusive hard link and EDL last; retain a clearly reported orphan WAV if interrupted after WAV publication.
- Regression: `failed render or EDL publication never publishes a completed EDL` injects hash mismatch and EDL publication failure, checks source and collision handling.
- Prevention: publish a completion marker only after verified data; never remove an already-published path when ownership could have changed. Status: verification pending.

## P2-004 — Preview setup closed piped review input

- Detected 2026-11-16 in CLI synthetic regression; affected `scripts/review-wav.mjs`.
- Symptom: `ERR_USE_AFTER_CLOSE` before approval.
- Cause: readline consumed piped input while asynchronous preview creation was still running.
- Fix: generate previews before creating the readline interface.
- Regression: existing CLI end-to-end approval test plus full suite.
- Prevention: prepare asynchronous resources before listening to input. Status: fixed; end-to-end regression passed.

## P2-003 — CI fresh checkout missing test scratch directory

- Detected 2026-11-16 in GitHub Actions run 43804491064; affected CI setup.
- Symptom: WAV collision test failed creating a temporary folder under `work/`.
- Root cause: `work/` is ignored and does not exist in a fresh checkout.
- Fix: create the scratch parent directory in CI before tests.
- Regression: rerun the unchanged WAV test and full CI on a fresh checkout.
- Prevention: explicitly provision ignored fixture directories in clean CI environments. Status: CI verification pending.

## P2-002 — CLI path normalization fails

- Detected 2026-11-16 in the synthetic end-to-end test; affected module `scripts/review-wav.mjs`.
- Symptom: CLI exited before review with `ERR_INVALID_ARG_TYPE`.
- Root cause: `Array.map(resolve)` supplied index and array to the variadic path function.
- Fix: wrap `resolve` in a single-argument callback.
- Regression: `CLI accepts a human approval and preserves source hash` runs the full path.
- Prevention: wrap variadic functions passed as array callbacks. Status: fixed; end-to-end regression passed.

## P2-001 — Backend log timestamp incorrectly marked UTC

- Detected 2026-11-16 in the Phase 2 backend runtime test; affects the POC backend on non-UTC hosts.
- Symptom: log time used local time while the format ended in `Z`.
- Root cause: Python logging defaults to local time; `Z` was added without setting the formatter's converter.
- Fix: configure `logging.Formatter.converter = time.gmtime` in `backend/server.py`.
- Regression check: inspect a formatted record against UTC and run the backend HTTP integration suite.
- Prevention: only label timestamps UTC when the clock conversion is explicitly UTC. Status: fixed; verify with backend test suite.

Follow-up 2026-11-16: no additional reproducible product defect was established. GitHub HTTP 404 is an access/existence ambiguity; missing Python in searched locations and an uninstalled CEP panel are environment blockers, not diagnosed application defects.

No application defect has been reproduced or diagnosed in this Phase 1 verification. The 19 current automated tests pass, including the expanded synthetic WAV and EDL boundary cases. The Audition POC did not expose a product defect; one UI automation action against a metadata control was inconclusive and is not treated as an application failure.

## P1.5-001 — POC static-check harness assumptions

- **Detected:** 2026-11-16; **affected version:** Node.js 24.12.0; **status:** fixed and regression checked.
- **Symptom:** the new POC static checks failed when Node was asked to `--check` a `.jsx` path, and a source assertion expected `__adobe_cep__.evalScript` as one property chain.
- **Reproduction:** run `npm.cmd test` with the first version of `integrations/audition-cep-poc/poc.test.js`.
- **Root cause:** Node's syntax checker rejects the `.jsx` extension before parsing, while the panel stores `window.__adobe_cep__` in a local `cep` variable and calls `cep.evalScript`.
- **Affected module:** `integrations/audition-cep-poc/poc.test.js` (test harness only; no Audition behavior implicated).
- **Fix:** send both JS/JSX source strings to `node --check --input-type=commonjs` through stdin and assert the actual bridge invocation shape.
- **Regression check:** the panel/ExtendScript syntax and bridge-path tests in `integrations/audition-cep-poc/poc.test.js`, plus full `npm.cmd test`.
- **Prevention rule:** static tests should validate the actual source structure/runtime constraints rather than assuming extension handling or a particular local variable spelling.

Do not create a defect entry for an unverified integration capability or an inconclusive UI automation action. If a reproducible product defect is found, record the failing fixture and exact host/build, root cause, fix, regression check, and prevention rule before marking it resolved.

Each entry must include ID, detection date, affected version, symptom, reproduction conditions, root cause, affected file/module, fix, regression check, prevention rule, and verification status. Do not store private recordings in this file or repository.

## P4-001 — PyAV WAV decode API mismatch

- Detected on Windows in Sprint 4 with faster-whisper 1.2.1 and PyAV 19.0.2.
- Opening the real WAV through faster-whisper raised TypeError because PyAV rejected the metadata_errors argument. The run failed before generating a transcript.
- The local adapter now invokes FFmpeg with an argument vector to decode mono float32 at 16 kHz and passes the sample array to faster-whisper.
- Regression evidence: real source and output transcription through the new path. Track transcription completion separately from model accuracy.
- Prevention: verify the actual decode and model input path against the deployed runtime.

## P4-002 — Markdown reported an undefined full-scale count

- Seen in the completed real-01 export. JSON contained fullScaleSamples while Markdown read fullScale.
- Corrected the formatter, updated the local report from the measured JSON and added a regression test for valid and missing counts.

## P5-001 — Auto Edit constructed a keep-all EDL before evaluating cuts

- Sprint 4 always set removedSegments to an empty array, so no input could exercise automatic cutting.
- Sprint 5 derives removed and retained intervals from the calibrated decision gate. The renderer additionally requires exact silence inside each automatic cut and its guard margins.
- Regression: synthetic PCM16 and float32 cases produce a nonzero verified cut. Missing/leaked/unsafe calibration and nonzero samples preserve or reject the cut. Real broadcast activation is still pending independent benchmark labels.

## P6-001 — ASR word drift on matching input

- Reproduced on the same local synthetic WAV with matching decoded PCM and execution profile on Windows. The full real-01 historical run also differed, but lacked full provenance.
- Inspecting faster-whisper 1.2.1 revealed default decoding temperature fallback can enter a sampling path. Set temperature=0 explicitly and record input, decoder, model and runtime provenance. Do not approve a trial with a missing or mismatched execution profile.
- Repeated local model checks matched on the synthetic WAV and a 30-second authorized Vietnamese excerpt after the change. Full-length repeatability and the precise cause of the historical mismatch remain unverified. Comparator regression tests independently verify that hashes, profiles and word agreement are separate.
