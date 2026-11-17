import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildWaveFile } from '../audio-engine/wav.js';

export async function prepareStudioSession(output, source, bytes, wav, review) {
  if (review.source.sha256 !== source.sha256 ||
      review.source.totalSamples !== wav.sampleFrames ||
      review.source.sampleRate !== wav.sampleRate ||
      review.source.channels !== wav.channels) throw Error('Studio analysis does not match source');
  const directory = join(output, 'studio-session');
  await mkdir(directory);
  const save = (name, value) => writeFile(join(directory, name), value, { flag: 'wx' });
  const clip = (start, end) => bytes.subarray(wav.dataOffset + start * wav.blockAlign, wav.dataOffset + end * wav.blockAlign);
  const proposals = [];
  for (const row of review.proposals) {
    if (!/^quiet-\d+$/.test(row.id) || !Number.isSafeInteger(row.startFrame) ||
        !Number.isSafeInteger(row.endFrame) || row.startFrame < 0 ||
        row.endFrame <= row.startFrame || row.endFrame > wav.sampleFrames) throw Error('Invalid Studio proposal');
    const start = Math.max(0, row.startFrame - wav.sampleRate);
    const end = Math.min(wav.sampleFrames, row.endFrame + wav.sampleRate);
    const before = clip(start, end);
    const after = Buffer.concat([clip(start, row.startFrame), clip(row.endFrame, end)]);
    if (!after.length) continue;
    for (const [side, data] of [['before',before],['after',after]]) {
      await save(row.id+'-'+side+'.wav', buildWaveFile(wav.fmtChunk, data, wav.effectiveFormatTag, data.length / wav.blockAlign));
    }
    proposals.push(row);
  }
  await save('studio-source.json', JSON.stringify({source}));
  await save('review.json', JSON.stringify({...review, proposals}));
  return directory;
}
