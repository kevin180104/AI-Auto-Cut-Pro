# Lessons Learned

- Audition being installed does not prove its SDK or an integration path was tested.
- CEP support and headline SDK capabilities do not demonstrate automation of every editing operation.
- Tie compatibility claims to an observed host version and real test evidence.
- The bundled Audition Portal opening is useful proof of host panel availability, but says nothing by itself about a custom extension or editing API.
- A synthetic WAV opened in Audition verifies a manual file handoff only; session exchange, backend round trips, metadata APIs, and timeline edits need separate demonstrations.
- Keep test evidence separated by fixture type: synthetic WAV, approved real recording, mock/simulation, and actual Audition host.
- Preserve source frames and write to a new destination. Require explicit approval for every removed interval, and verify bytes outside those intervals remain identical.
- The bundled Audition CEP manifest is a useful source of the exact host identifier/runtime floor; still verify compatibility of a custom manifest in the target host.
- Keep custom CEP POCs read-only until the panel bridge and host APIs have been exercised in a disposable Audition session.
- When runtime prerequisites (Python or approved CEP loading) are missing, report the integration as NOT TESTED instead of substituting a different runtime and calling it a pass.
- For legacy `.jsx` static checks, feed source to Node through stdin; Node 24 rejects `.jsx` as a path extension before parsing. Align source assertions with the implementation's real bridge call form.
