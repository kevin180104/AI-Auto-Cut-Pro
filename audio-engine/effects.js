/** Explicitly approved PCM16 effects. Crossfades overlap retained frames and shorten output. */
export function applyPcm16Effects(parts, channels, sampleRate, effects) {
  if (!effects || effects.approval !== 'human-approved') throw new Error('Effects require explicit human approval');
  const { fadeInFrames = 0, fadeOutFrames = 0, crossfadeFrames = 0 } = effects;
  for (const value of [fadeInFrames, fadeOutFrames, crossfadeFrames]) if (!Number.isSafeInteger(value) || value < 0) throw new Error('Effect lengths must be non-negative sample frames');
  if (crossfadeFrames > Math.floor(sampleRate * 0.01)) throw new Error('Crossfade exceeds 10 ms safety limit');
  const align = channels * 2;
  if (parts.some(p => p.length % align)) throw new Error('Partial PCM16 frame');
  const lengths = parts.map(p => p.length / align);
  if (parts.length > 1 && lengths.some((n, i) => n < crossfadeFrames * ((i > 0 ? 1 : 0) + (i < parts.length - 1 ? 1 : 0)))) throw new Error('Crossfade exceeds retained segment length');
  const total = lengths.reduce((a, b) => a + b, 0) - crossfadeFrames * Math.max(0, parts.length - 1);
  if (fadeInFrames > total || fadeOutFrames > total || fadeInFrames + fadeOutFrames > total) throw new Error('Fades exceed output length');
  const out = Buffer.alloc(total * align); let cursor = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i], overlap = i ? crossfadeFrames : 0;
    for (let f = 0; f < overlap; f++) {
      const weight = (f + 1) / (overlap + 1);
      for (let c = 0; c < channels; c++) {
        const pos = ((cursor - overlap + f) * channels + c) * 2;
        const value = Math.round(out.readInt16LE(pos) * (1 - weight) + part.readInt16LE((f * channels + c) * 2) * weight);
        out.writeInt16LE(Math.max(-32768, Math.min(32767, value)), pos);
      }
    }
    part.copy(out, cursor * align, overlap * align); cursor += lengths[i] - overlap;
  }
  for (let f = 0; f < total; f++) {
    const gainIn = fadeInFrames ? Math.min(1, (f + 1) / fadeInFrames) : 1;
    const gainOut = fadeOutFrames ? Math.min(1, (total - f) / fadeOutFrames) : 1;
    const gain = Math.min(gainIn, gainOut);
    if (gain < 1) for (let c = 0; c < channels; c++) { const pos = (f * channels + c) * 2; out.writeInt16LE(Math.round(out.readInt16LE(pos) * gain), pos); }
  }
  return { buffer: out, sampleFrames: total };
}
