import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyzeActivity, approvedEdl } from './activity.js';
import { parseWavBuffer, renderWavBuffer } from '../audio-engine/wav.js';
import { makePreview } from './preview.js';
import { publishRender } from '../audio-engine/publish.js';
import { exportMp3 } from '../audio-engine/mp3.js';

function fixture(channels = 1, rate = 8000) {
  const frames = rate * 4, size = frames * channels * 2, b = Buffer.alloc(44 + size);
  b.write('RIFF'); b.writeUInt32LE(36 + size, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(size, 40);
  for (let i = 0; i < frames; i++) if (i < rate || i >= 3 * rate) for (let c = 0; c < channels; c++) b.writeInt16LE(c === 0 ? 7000 : -7000, 44 + (i * channels + c) * 2);
  return b;
}
for (const [channels, rate] of [[1, 8000], [2, 48000]]) test(`energy detector preserves margins at ${rate} Hz, ${channels} channels`, () => {
  const b = fixture(channels, rate); const result = analyzeActivity(b);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].startFrame, Math.round(rate * 1.2));
  assert.equal(result.proposals[0].endFrame, Math.round(rate * 2.8));
  const reject = approvedEdl(result, [], 'source.wav', 'out.wav');
  assert.equal(reject.removedSegments.length, 0);
  const edl = approvedEdl(result, [result.proposals[0].id], 'source.wav', 'out.wav');
  const rendered = renderWavBuffer(b, edl); assert.equal(rendered.outputFrames, rate * 4 - (result.proposals[0].endFrame - result.proposals[0].startFrame));
  assert.throws(() => approvedEdl(result, ['unknown'], 'source.wav', 'out.wav'));
});
test('silent input and unsupported WAV produce no unsafe proposal', () => {
  const b = fixture(); b.fill(0, 44); assert.equal(analyzeActivity(b).proposals.length, 0);
  b.writeUInt16LE(8, 34); assert.throws(() => analyzeActivity(b));
});
test('preview includes context and preserves both channels before and after removal', () => {
  const source = fixture(2); const analysis = analyzeActivity(source); const p = analysis.proposals[0];
  const preview = makePreview(source, analysis, p, 0.5);
  const before = parseWavBuffer(preview.before), after = parseWavBuffer(preview.after);
  assert.equal(before.channels, 2); assert.equal(after.channels, 2);
  assert.equal(before.sampleFrames - after.sampleFrames, p.endFrame - p.startFrame);
  assert.equal(before.sampleFrames, p.endFrame - p.startFrame + 8000);
});
test('CLI accepts a human approval and preserves source hash while producing valid WAV and EDL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aacp-')); const src = join(dir, 'source.wav'), out = join(dir, 'output.wav'), edl = join(dir, 'edl.json');
  const b = fixture(); await writeFile(src, b); const hash = createHash('sha256').update(b).digest('hex');
  const run = spawnSync(process.execPath, ['scripts/review-wav.mjs', src, out, edl], { input: 'yes\n', encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); assert.equal(createHash('sha256').update(await readFile(src)).digest('hex'), hash);
  assert.equal(JSON.parse(await readFile(edl, 'utf8')).removedSegments[0].approval, 'human-approved');
  assert.ok(parseWavBuffer(await readFile(out)).sampleFrames < 32000);
  const collision = spawnSync(process.execPath, ['scripts/review-wav.mjs', src, out, edl], { input: 'yes\n', encoding: 'utf8' }); assert.notEqual(collision.status, 0);
});
test('CLI rejects or cancels without deleting unapproved audio', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aacp-reject-')); const src = join(dir, 'source.wav'); await writeFile(src, fixture());
  const out = join(dir, 'kept.wav'), edl = join(dir, 'kept.json');
  const rejected = spawnSync(process.execPath, ['scripts/review-wav.mjs', src, out, edl], { input: 'no\n', encoding: 'utf8' });
  assert.equal(rejected.status, 0, rejected.stderr); assert.equal(JSON.parse(await readFile(edl, 'utf8')).removedSegments.length, 0);
  assert.equal(parseWavBuffer(await readFile(out)).sampleFrames, 32000);
  const cancelledOutput = join(dir, 'cancelled.wav'), cancelledEdl = join(dir, 'cancelled.json');
  const cancelled = spawnSync(process.execPath, ['scripts/review-wav.mjs', src, cancelledOutput, cancelledEdl], { input: 'q\n', encoding: 'utf8' });
  assert.notEqual(cancelled.status, 0); await assert.rejects(readFile(cancelledOutput), { code: 'ENOENT' }); await assert.rejects(readFile(cancelledEdl), { code: 'ENOENT' });
});
test('failed render or EDL publication never publishes a completed EDL or overwrites source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aacp-publish-')); const src = join(dir, 'source.wav'), out = join(dir, 'out.wav'), edlPath = join(dir, 'out.json');
  const data = fixture(); await writeFile(src, data); const a = analyzeActivity(data); const edl = approvedEdl(a, [], src, out);
  const bad = structuredClone(edl); bad.source.sha256 = '0'.repeat(64);
  await assert.rejects(publishRender(bad, edlPath)); await assert.rejects(readFile(out), { code: 'ENOENT' }); await assert.rejects(readFile(edlPath), { code: 'ENOENT' });
  await assert.rejects(publishRender(edl, edlPath, { beforeEdlPublish() { throw new Error('injected EDL publication failure'); } }), /injected/);
  await assert.rejects(readFile(edlPath), { code: 'ENOENT' }); assert.deepEqual(await readFile(src), data);
  await assert.rejects(publishRender(edl, edlPath), /exists/);
});
test('EDL approved crossfade renders reproducibly with expected stereo frames', () => {
  const b = fixture(2, 8000); const a = analyzeActivity(b); const edl = approvedEdl(a, [a.proposals[0].id], 'source.wav', 'out.wav');
  edl.effects = { approval: 'human-approved', fadeInFrames: 16, fadeOutFrames: 16, crossfadeFrames: 40 };
  const first = renderWavBuffer(b, edl), second = renderWavBuffer(b, edl);
  assert.deepEqual(first.buffer, second.buffer); assert.equal(first.overlapFrames, 40);
  assert.equal(parseWavBuffer(first.buffer).channels, 2); assert.equal(parseWavBuffer(first.buffer).sampleRate, 8000);
  assert.equal(first.outputFrames, 32000 - (a.proposals[0].endFrame - a.proposals[0].startFrame) - 40);
});
test('MP3 export rejects unavailable FFmpeg', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aacp-mp3-test-')); const src = join(dir, 'source.wav'); await writeFile(src, fixture());
  await assert.rejects(exportMp3({ ffmpegPath: join(dir, 'missing.exe'), sourcePath: src, outputPath: join(dir, 'out.mp3') }));
});
test('MP3 export encodes and validates synthetic stereo without overwrite', { skip: !process.env.AACP_TEST_FFMPEG }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aacp-mp3-test-')); const src = join(dir, 'source.wav'), out = join(dir, 'out.mp3');
  const b = fixture(2, 48000); await writeFile(src, b);
  const result = await exportMp3({ ffmpegPath: process.env.AACP_TEST_FFMPEG, sourcePath: src, outputPath: out });
  assert.equal(result.lossy, true); assert.equal(result.sampleRate, 48000); assert.equal(result.channels, 2);
  await assert.rejects(exportMp3({ ffmpegPath: process.env.AACP_TEST_FFMPEG, sourcePath: src, outputPath: out })); assert.deepEqual(await readFile(src), b);
});
