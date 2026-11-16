# Error Memory

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
