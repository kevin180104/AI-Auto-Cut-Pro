import { createHash } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import { win32 } from 'node:path';
import { validateEdl } from './edl.js';
import { applyPcm16Effects } from './effects.js';

const MAX_RIFF_SIZE = 0xffffffff;

function fail(message) {
  throw new Error(message);
}

function parseWavBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) fail('WAV input is too short');
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    fail('Only little-endian RIFF/WAVE files are supported');
  }

  const declaredEnd = buffer.readUInt32LE(4) + 8;
  if (declaredEnd < 12 || declaredEnd > buffer.length) fail('RIFF size exceeds available input data');
  const chunks = [];
  let offset = 12;
  while (offset < declaredEnd) {
    if (offset + 8 > declaredEnd) fail('Incomplete RIFF chunk header');
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > declaredEnd) fail(`RIFF chunk ${id} exceeds declared file size`);
    chunks.push({ id, size, headerStart: offset, dataStart, dataEnd, nextOffset: dataEnd + (size & 1) });
    offset = dataEnd + (size & 1);
  }
  if (offset !== declaredEnd) fail('Invalid RIFF chunk padding');

  const formats = chunks.filter((chunk) => chunk.id === 'fmt ');
  const dataChunks = chunks.filter((chunk) => chunk.id === 'data');
  if (formats.length !== 1) fail('WAV must contain exactly one fmt chunk');
  if (dataChunks.length !== 1) fail('WAV must contain exactly one data chunk');
  const fmt = formats[0];
  if (fmt.size < 16) fail('WAV fmt chunk is too short');

  const formatTag = buffer.readUInt16LE(fmt.dataStart);
  const channels = buffer.readUInt16LE(fmt.dataStart + 2);
  const sampleRate = buffer.readUInt32LE(fmt.dataStart + 4);
  const byteRate = buffer.readUInt32LE(fmt.dataStart + 8);
  const blockAlign = buffer.readUInt16LE(fmt.dataStart + 12);
  const bitsPerSample = buffer.readUInt16LE(fmt.dataStart + 14);
  let effectiveFormatTag = formatTag;
  if (formatTag === 0xfffe) {
    if (fmt.size < 40) fail('WAVE_FORMAT_EXTENSIBLE fmt chunk is incomplete');
    const extensionSize = buffer.readUInt16LE(fmt.dataStart + 16);
    if (extensionSize < 22) fail('WAVE_FORMAT_EXTENSIBLE extension is too short');
    effectiveFormatTag = buffer.readUInt32LE(fmt.dataStart + 24);
    if (![1, 3].includes(effectiveFormatTag)) fail('Extensible WAV must use PCM or IEEE float subformat');
    const validBits = buffer.readUInt16LE(fmt.dataStart + 18);
    if (validBits < 1 || validBits > bitsPerSample) fail('Invalid valid-bits value in extensible WAV');
  }

  if (![1, 3].includes(effectiveFormatTag)) fail('Compressed WAV codecs are not supported');
  if (!Number.isInteger(channels) || channels < 1) fail('WAV channel count is invalid');
  if (!Number.isInteger(sampleRate) || sampleRate < 1) fail('WAV sample rate is invalid');
  if (effectiveFormatTag === 1 && ![8, 16, 24, 32].includes(bitsPerSample)) fail('PCM must use 8, 16, 24, or 32 bits');
  if (effectiveFormatTag === 3 && ![32, 64].includes(bitsPerSample)) fail('IEEE float must use 32 or 64 bits');
  const expectedBlockAlign = channels * Math.ceil(bitsPerSample / 8);
  if (blockAlign !== expectedBlockAlign) fail('WAV block alignment does not match channel/bit format');
  if (byteRate !== sampleRate * blockAlign) fail('WAV byte rate does not match sample rate and block alignment');
  if (dataChunks[0].size % blockAlign !== 0) fail('WAV data chunk ends in a partial sample frame');

  const data = dataChunks[0];
  return {
    chunks,
    fmtChunk: buffer.subarray(fmt.headerStart, fmt.nextOffset),
    dataOffset: data.dataStart,
    dataLength: data.size,
    formatTag,
    effectiveFormatTag,
    channels,
    sampleRate,
    byteRate,
    blockAlign,
    bitsPerSample,
    sampleFrames: data.size / blockAlign,
  };
}

function makeChunk(id, payload) {
  const size = 8 + payload.length + (payload.length & 1);
  const chunk = Buffer.alloc(size);
  chunk.write(id, 0, 4, 'ascii');
  chunk.writeUInt32LE(payload.length, 4);
  payload.copy(chunk, 8);
  return chunk;
}

function makeFactChunk(sampleFrames) {
  const fact = Buffer.alloc(4);
  fact.writeUInt32LE(sampleFrames, 0);
  return makeChunk('fact', fact);
}

function buildWaveFile(fmtChunk, data, effectiveFormatTag, sampleFrames) {
  const chunks = [fmtChunk];
  if (effectiveFormatTag === 3) chunks.push(makeFactChunk(sampleFrames));
  chunks.push(makeChunk('data', data));
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), ...chunks]);
  if (body.length > MAX_RIFF_SIZE) fail('Rendered WAV exceeds the RIFF 32-bit size limit');
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

/** Render approved EDL keep ranges as a WAV, copying frames without altering sample values. */
function renderWavBuffer(sourceBuffer, edl) {
  validateEdl(edl);
  const wav = parseWavBuffer(sourceBuffer);
  const sourceHash = createHash('sha256').update(sourceBuffer).digest('hex');
  if (sourceHash.toLowerCase() !== edl.source.sha256.toLowerCase()) fail('Source SHA-256 does not match the EDL');
  if (wav.sampleFrames !== edl.source.totalSamples) fail('WAV sample-frame count does not match the EDL');
  if (wav.sampleRate !== edl.source.sampleRate || wav.channels !== edl.source.channels) {
    fail('WAV stream format does not match the EDL');
  }

  const frameRanges = edl.keepSegments.map((segment) => ({
    start: wav.dataOffset + segment.sourceStartSample * wav.blockAlign,
    end: wav.dataOffset + segment.sourceEndSample * wav.blockAlign,
  }));
  const retainedBytes = frameRanges.reduce((sum, range) => sum + range.end - range.start, 0);
  if (retainedBytes > MAX_RIFF_SIZE) fail('Rendered WAV audio exceeds the RIFF 32-bit size limit');
  const parts = frameRanges.map((range) => sourceBuffer.subarray(range.start, range.end));
  let retainedAudio = Buffer.concat(parts, retainedBytes);
  let outputFrames = retainedBytes / wav.blockAlign;
  if (edl.effects) {
    if (wav.formatTag !== 1 || wav.bitsPerSample !== 16) fail('Effects require PCM16 WAV');
    const processed = applyPcm16Effects(parts, wav.channels, wav.sampleRate, edl.effects);
    retainedAudio = processed.buffer; outputFrames = processed.sampleFrames;
  }
  const outputBuffer = buildWaveFile(wav.fmtChunk, retainedAudio, wav.effectiveFormatTag, outputFrames);

  return {
    buffer: outputBuffer,
    sourceFormat: {
      sampleRate: wav.sampleRate,
      channels: wav.channels,
      bitsPerSample: wav.bitsPerSample,
      sampleFrames: wav.sampleFrames,
    },
    outputFrames,
    removedFrames: wav.sampleFrames - retainedBytes / wav.blockAlign,
    overlapFrames: retainedBytes / wav.blockAlign - outputFrames,
    metadataPreserved: false,
  };
}

/** Read an EDL's source, render to its output path, and refuse to overwrite any existing file. */
async function renderWavFromEdl(edl) {
  validateEdl(edl);
  const samePath = win32.resolve(edl.source.path).toLowerCase() === win32.resolve(edl.output.path).toLowerCase();
  if (samePath) fail('Output path must differ from source path');
  const sourceBuffer = await readFile(edl.source.path);
  const result = renderWavBuffer(sourceBuffer, edl);
  let handle;
  try {
    handle = await open(edl.output.path, 'wx');
    await handle.writeFile(result.buffer);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
      await unlink(edl.output.path).catch(() => {});
    }
    if (error.code === 'EEXIST') fail('Output file already exists; it was not overwritten');
    throw error;
  }
  await handle.close();
  return {
    outputPath: edl.output.path,
    outputFrames: result.outputFrames,
    removedFrames: result.removedFrames,
    overlapFrames: result.overlapFrames,
    sourceFormat: result.sourceFormat,
    metadataPreserved: result.metadataPreserved,
  };
}

export { parseWavBuffer, renderWavBuffer, renderWavFromEdl };
