import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseWavBuffer, renderWavBuffer } from './wav.js';

function makePcm16Wav(frameCount, channels = 2) {
  const blockAlign = channels * 2;
  const audio = Buffer.alloc(frameCount * blockAlign);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      audio.writeInt16LE((frame + 1) * 100 + channel, frame * blockAlign + channel * 2);
    }
  }
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(48000, 4);
  fmt.writeUInt32LE(48000 * blockAlign, 8);
  fmt.writeUInt16LE(blockAlign, 12);
  fmt.writeUInt16LE(16, 14);
  const dataChunk = Buffer.alloc(8 + audio.length + (audio.length & 1));
  dataChunk.write('data', 0, 4, 'ascii');
  dataChunk.writeUInt32LE(audio.length, 4);
  audio.copy(dataChunk, 8);
  const fmtChunk = Buffer.alloc(8 + fmt.length);
  fmtChunk.write('fmt ', 0, 4, 'ascii');
  fmtChunk.writeUInt32LE(fmt.length, 4);
  fmt.copy(fmtChunk, 8);
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), fmtChunk, dataChunk]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function makeEdl(source, frameCount) {
  const sha256 = createHash('sha256').update(source).digest('hex');
  return {
    version: 1,
    source: {
      path: 'C:\\audio\\source.wav',
      sha256,
      sampleRate: 48000,
      channels: 2,
      totalSamples: frameCount,
    },
    output: { path: 'C:\\audio\\edited.wav' },
    keepSegments: [
      { id: 'intro', sourceStartSample: 0, sourceEndSample: 4 },
      { id: 'ending', sourceStartSample: 6, sourceEndSample: frameCount },
    ],
    removedSegments: [
      {
        id: 'approved-retake',
        sourceStartSample: 4,
        sourceEndSample: 6,
        approval: 'human-approved',
        reason: 'Reviewer selected the later take',
        evidence: 'Reviewed retake group 1',
      },
    ],
  };
}

test('parses PCM WAV stream metadata and frame count', () => {
  const parsed = parseWavBuffer(makePcm16Wav(10));
  assert.equal(parsed.sampleRate, 48000);
  assert.equal(parsed.channels, 2);
  assert.equal(parsed.bitsPerSample, 16);
  assert.equal(parsed.sampleFrames, 10);
});

test('renders EDL keep ranges without changing retained sample bytes', () => {
  const source = makePcm16Wav(10);
  const before = Buffer.from(source);
  const edl = makeEdl(source, 10);
  const sourceInfo = parseWavBuffer(source);
  const expectedAudio = Buffer.concat([
    source.subarray(sourceInfo.dataOffset, sourceInfo.dataOffset + 4 * sourceInfo.blockAlign),
    source.subarray(sourceInfo.dataOffset + 6 * sourceInfo.blockAlign, sourceInfo.dataOffset + 10 * sourceInfo.blockAlign),
  ]);
  const result = renderWavBuffer(source, edl);
  const output = parseWavBuffer(result.buffer);

  assert.equal(output.sampleFrames, 8);
  assert.equal(output.sampleRate, 48000);
  assert.equal(output.channels, 2);
  assert.deepEqual(result.buffer.subarray(output.dataOffset, output.dataOffset + output.dataLength), expectedAudio);
  assert.deepEqual(source, before, 'renderer must not mutate source bytes');
  assert.equal(result.removedFrames, 2);
  assert.equal(result.metadataPreserved, false);
});

test('rejects input whose hash or frame count differs from the EDL', () => {
  const source = makePcm16Wav(10);
  const changed = Buffer.from(source);
  changed[changed.length - 1] ^= 0xff;
  assert.throws(() => renderWavBuffer(changed, makeEdl(source, 10)), /SHA-256/i);
  assert.throws(() => renderWavBuffer(source, makeEdl(source, 11)), /frame count/i);
});

test('rejects compressed formats and malformed chunk lengths', () => {
  const compressed = makePcm16Wav(10);
  compressed.writeUInt16LE(6, 20);
  assert.throws(() => parseWavBuffer(compressed), /compressed WAV codecs/i);

  const malformed = makePcm16Wav(10);
  malformed.writeUInt32LE(0xffffffff, 40);
  assert.throws(() => parseWavBuffer(malformed), /exceeds declared file size/i);
});
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderWavFromEdl } from './wav.js';

test('writes to a new WAV path and leaves an existing output untouched', async () => {
  const tempDir = await mkdtemp(path.join(process.cwd(), 'work', 'wav-render-test-'));
  try {
    const sourcePath = path.join(tempDir, 'source.wav');
    const outputPath = path.join(tempDir, 'edited.wav');
    const source = makePcm16Wav(10);
    await writeFile(sourcePath, source, { flag: 'wx' });
    const edl = makeEdl(source, 10);
    edl.source.path = sourcePath;
    edl.output.path = outputPath;

    const report = await renderWavFromEdl(edl);
    assert.equal(report.outputPath, outputPath);
    assert.equal(report.outputFrames, 8);
    assert.deepEqual(await readFile(sourcePath), source, 'source recording must stay unchanged');
    const originalOutput = await readFile(outputPath);
    await assert.rejects(renderWavFromEdl(edl), /already exists/i);
    assert.deepEqual(await readFile(outputPath), originalOutput, 'existing output must stay unchanged');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

function makeWavVariant({ frames = 10, channels, sampleRate, bitsPerSample, formatTag }) {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const audio = Buffer.alloc(frames * blockAlign);
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = frame * blockAlign + channel * bytesPerSample;
      const normalized = ((frame + channel) % 7 - 3) / 4;
      if (formatTag === 3 && bitsPerSample === 32) audio.writeFloatLE(normalized, offset);
      else if (formatTag === 3 && bitsPerSample === 64) audio.writeDoubleLE(normalized, offset);
      else if (bitsPerSample === 8) audio.writeUInt8(128 + Math.round(normalized * 100), offset);
      else audio.writeIntLE(Math.round(normalized * (2 ** (bitsPerSample - 1) - 1)), offset, bytesPerSample);
    }
  }
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(formatTag, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * blockAlign, 8);
  fmt.writeUInt16LE(blockAlign, 12);
  fmt.writeUInt16LE(bitsPerSample, 14);
  const fmtChunk = Buffer.alloc(24);
  fmtChunk.write('fmt ', 0, 4, 'ascii');
  fmtChunk.writeUInt32LE(fmt.length, 4);
  fmt.copy(fmtChunk, 8);
  const dataChunk = Buffer.alloc(8 + audio.length + (audio.length & 1));
  dataChunk.write('data', 0, 4, 'ascii');
  dataChunk.writeUInt32LE(audio.length, 4);
  audio.copy(dataChunk, 8);
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), fmtChunk, dataChunk]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function makeVariantEdl(source, keepRanges, removedRanges = []) {
  const parsed = parseWavBuffer(source);
  const sha256 = createHash('sha256').update(source).digest('hex');
  return {
    version: 1,
    source: {
      path: 'C:\\audio\\variant-source.wav',
      sha256,
      sampleRate: parsed.sampleRate,
      channels: parsed.channels,
      totalSamples: parsed.sampleFrames,
    },
    output: { path: 'C:\\audio\\variant-edited.wav' },
    keepSegments: keepRanges.map(([start, end], index) => ({ id: `keep-${index}`, sourceStartSample: start, sourceEndSample: end })),
    removedSegments: removedRanges.map(([start, end], index) => ({
      id: `remove-${index}`,
      sourceStartSample: start,
      sourceEndSample: end,
      approval: 'human-approved',
      reason: 'Synthetic test removal',
      evidence: 'Explicit test EDL approval',
    })),
  };
}

for (const format of [
  { name: 'PCM 16-bit mono at 44.1 kHz', formatTag: 1, bitsPerSample: 16, channels: 1, sampleRate: 44100 },
  { name: 'PCM 24-bit stereo at 48 kHz', formatTag: 1, bitsPerSample: 24, channels: 2, sampleRate: 48000 },
  { name: 'PCM 32-bit mono at 96 kHz', formatTag: 1, bitsPerSample: 32, channels: 1, sampleRate: 96000 },
  { name: 'IEEE float 32-bit stereo at 32 kHz', formatTag: 3, bitsPerSample: 32, channels: 2, sampleRate: 32000 },
  { name: 'IEEE float 64-bit mono at 44.1 kHz', formatTag: 3, bitsPerSample: 64, channels: 1, sampleRate: 44100 },
]) {
  test(`renders ${format.name} and preserves retained sample bytes`, () => {
    const source = makeWavVariant(format);
    const parsedSource = parseWavBuffer(source);
    const edl = makeVariantEdl(source, [[0, 3], [7, 10]], [[3, 7]]);
    const result = renderWavBuffer(source, edl);
    const parsedOutput = parseWavBuffer(result.buffer);
    const bytesPerRange = (end, start) => (end - start) * parsedSource.blockAlign;
    const expected = Buffer.concat([
      source.subarray(parsedSource.dataOffset, parsedSource.dataOffset + bytesPerRange(3, 0)),
      source.subarray(parsedSource.dataOffset + 7 * parsedSource.blockAlign, parsedSource.dataOffset + 10 * parsedSource.blockAlign),
    ]);

    assert.equal(parsedOutput.bitsPerSample, format.bitsPerSample);
    assert.equal(parsedOutput.effectiveFormatTag, format.formatTag);
    assert.equal(parsedOutput.channels, format.channels);
    assert.equal(parsedOutput.sampleRate, format.sampleRate);
    assert.equal(parsedOutput.sampleFrames, 6);
    assert.deepEqual(result.buffer.subarray(parsedOutput.dataOffset, parsedOutput.dataOffset + parsedOutput.dataLength), expected);
  });
}

test('preserves the first and last retained frames when cuts are adjacent to source edges', () => {
  const source = makeWavVariant({ frames: 10, channels: 1, sampleRate: 48000, bitsPerSample: 16, formatTag: 1 });
  const parsedSource = parseWavBuffer(source);
  const edl = makeVariantEdl(source, [[2, 8]], [[0, 2], [8, 10]]);
  const result = renderWavBuffer(source, edl);
  const parsedOutput = parseWavBuffer(result.buffer);
  const firstRetainedFrame = source.subarray(parsedSource.dataOffset + 2 * parsedSource.blockAlign, parsedSource.dataOffset + 3 * parsedSource.blockAlign);
  const lastRetainedFrame = source.subarray(parsedSource.dataOffset + 7 * parsedSource.blockAlign, parsedSource.dataOffset + 8 * parsedSource.blockAlign);
  const outputAudio = result.buffer.subarray(parsedOutput.dataOffset, parsedOutput.dataOffset + parsedOutput.dataLength);

  assert.deepEqual(outputAudio.subarray(0, parsedOutput.blockAlign), firstRetainedFrame);
  assert.deepEqual(outputAudio.subarray(outputAudio.length - parsedOutput.blockAlign), lastRetainedFrame);
});

test('rejects empty files, invalid RIFF headers, and truncated chunks', () => {
  assert.throws(() => parseWavBuffer(Buffer.alloc(0)), /too short/i);
  assert.throws(() => parseWavBuffer(Buffer.from('not a wave file')), /RIFF\/WAVE/i);
  const truncated = makeWavVariant({ frames: 10, channels: 1, sampleRate: 48000, bitsPerSample: 16, formatTag: 1 });
  truncated.writeUInt32LE(0xffffffff, 40);
  assert.throws(() => parseWavBuffer(truncated), /exceeds declared file size/i);
});
