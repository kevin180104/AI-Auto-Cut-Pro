# Audition CEP POC

This is an uninstalled, read-only proof-of-concept package. Its CEP panel asks the host for `app.name`/`app.version` through an ExtendScript `evalScript` bridge and performs an HTTP health/echo round trip with a Python standard-library backend bound to `127.0.0.1:8765`. No audio is sent. Logs contain UTC timestamps, request IDs, and error codes, not audio content.

## Host facts and limits

- The installed Audition Portal manifest identifies Audition as host `AUDT`, version `11.0`; this package uses that observed host tuple. It is not inferred from Premiere Pro.
- The shipped Portal manifest requires CSXS runtime `6.0`; this is used as a compatibility floor for the POC manifest.
- The package has not been installed or loaded in Audition. Runtime behavior, host scripting calls, and the CEP runtime tuple remain unverified.
- No global CEP debug mode, registry value, or Adobe preference has been changed.

## Local backend

Requires Python 3.10+ (not found in PATH during the Phase 1.5 inventory):

```powershell
python integrations/audition-cep-poc/backend/server.py
```

The service only binds loopback and only provides `/health` and a bounded `/echo` test endpoint. It does not accept paths, commands, or media payloads. Stop with Ctrl+C.

## Audition test status

This package must be installed into a user-scoped CEP extension directory and enabled by a method allowed by Adobe and the local policy before the panel can be tested. That installation/debug step was not performed because it can require changing Adobe CEP trust/debug configuration, which this task explicitly forbids without separate approval. Do not report panel, ExtendScript, or panel/backend PASS until observed in Audition 26.0.0.56.
