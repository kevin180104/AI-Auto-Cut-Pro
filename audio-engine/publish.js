import { createHash } from 'node:crypto';
import { access, link, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { parseWavBuffer, renderWavBuffer } from './wav.js';

async function requireAbsent(path) {
  try { await access(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error(`Destination already exists: ${path}`);
}

/** Prepare verified files on their destination filesystems, publish without overwrite; EDL is the commit marker. */
export async function publishRender(edl, edlPath, hooks = {}) {
  if (new Set([edl.source.path, edl.output.path, edlPath].map(p => p.toLowerCase())).size !== 3) throw new Error('Paths must be distinct');
  await requireAbsent(edl.output.path); await requireAbsent(edlPath);
  const source = await readFile(edl.source.path);
  const result = renderWavBuffer(source, edl);
  let audioDir, edlDir, audioPublished = false, edlPublished = false;
  try {
    audioDir = await mkdtemp(join(dirname(edl.output.path), '.aacp-audio-'));
    edlDir = await mkdtemp(join(dirname(edlPath), '.aacp-edl-'));
    const audioTmp = join(audioDir, basename(edl.output.path));
    const edlTmp = join(edlDir, basename(edlPath));
    await writeFile(audioTmp, result.buffer, { flag: 'wx' });
    const parsed = parseWavBuffer(await readFile(audioTmp));
    if (parsed.sampleFrames !== result.outputFrames || parsed.sampleRate !== edl.source.sampleRate || parsed.channels !== edl.source.channels) throw new Error('Output verification failed');
    if (createHash('sha256').update(await readFile(edl.source.path)).digest('hex') !== edl.source.sha256.toLowerCase()) throw new Error('Source changed during rendering');
    await writeFile(edlTmp, JSON.stringify(edl, null, 2), { flag: 'wx' });
    JSON.parse(await readFile(edlTmp, 'utf8'));
    if (hooks.beforePublish) await hooks.beforePublish();
    await link(audioTmp, edl.output.path); audioPublished = true;
    if (hooks.beforeEdlPublish) await hooks.beforeEdlPublish();
    await link(edlTmp, edlPath); edlPublished = true;
    return { outputPath: edl.output.path, outputFrames: result.outputFrames, removedFrames: result.removedFrames, metadataPreserved: false, sourceHashUnchanged: true };
  } finally {
    // Never remove a published path: concurrent modification makes ownership ambiguous.
    // If interrupted between links, an orphan WAV can remain, but no completed EDL is published.
    if (audioDir) await rm(audioDir, { recursive: true, force: true });
    if (edlDir) await rm(edlDir, { recursive: true, force: true });
    if (audioPublished && !edlPublished) console.error('WAV was published but EDL publication failed; inspect the orphan WAV before retrying.');
  }
}
