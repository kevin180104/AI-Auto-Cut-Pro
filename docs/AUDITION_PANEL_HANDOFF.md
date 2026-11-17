# AI Auto Cut Pro for Adobe Audition — integration preview

## Workflow

1. In Audition, save or export the relevant program as a local PCM16 or float32 WAV.
2. From Window → Extensions → AI Auto Cut Pro, select **Phân tích WAV**. Choose the trusted AI Auto Cut Pro repository folder and the exported WAV. If necessary, choose the installed node.exe.
3. The panel invokes a fixed Node entry point with argument vectors. The local pipeline runs Silero, Vietnamese ASR and a shadow export, then serves a dedicated Studio session on loopback.
4. Click **Mở Studio để duyệt**. Listen to the proposals, approve only appropriate changes, and export the approved WAV. Keep the Audition panel open while using that session.
5. In Audition use **File → Import** to load the approved WAV from the displayed session folder. For a multitrack session, place the imported WAV manually on a new track.

Selecting the exported program scope prevents review of unrelated portions of a longer recording. This panel uses the existing proposal rules. It does not implement the broadcast reference analysis as an automatic edit policy.

## Requirements and installation status

The panel package is for CEP on Windows. It requires the local repository, Node 24, FFmpeg, the project's Python with Silero and faster-whisper, and local model weights. AACP_FFMPEG, AACP_ASR_PYTHON and AACP_ASR_MODEL can override the project defaults in the process environment. The package is an unsigned ZIP of CEP assets, not a signed ZXP installer. A supported installation requires an Adobe-compatible signed package or an explicitly authorized local unsigned test setup. No host preferences were changed and no extension was installed.

## Verification

| Capability | Result |
| --- | --- |
| Local WAV to Studio handoff | PASS on a synthetic WAV using the actual worker, Silero/ASR/FFmpeg and a loopback Studio listener. One proposal and both WAV previews were served. Closing the launcher stdin stopped the listener. |
| Audition host | Executable FileVersion 26.0.0.56 (ProductVersion 26.0.0) observed; custom panel loading and CEP Node execution UNVERIFIED. |
| Multitrack file import | Documented manual File → Import workflow. This package has not been round-trip tested in a disposable Audition session. |
| Timeline editing, selection and native undo | UNVERIFIED. The panel uses file exchange and does not call these APIs. |

User media and session data remain under work/audition. The output folder contains a shadow draft and a studio-session subfolder. Import the WAV generated after approval in studio-session. Preserve the associated EDL for traceability.

Sources: https://developer.adobe.com/audition/ and https://helpx.adobe.com/audition/desktop/applying-effects/enabling-cep-extensions.html
