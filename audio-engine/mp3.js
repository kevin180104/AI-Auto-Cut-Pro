import { spawnSync } from 'node:child_process';
import { link, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseWavBuffer } from './wav.js';
import { createHash } from 'node:crypto';

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { encoding: options.binary ? null : 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg failed: ${String(result.stderr).slice(-1200)}`);
  return result;
}

/** Encode a verified WAV to a new MP3 and decode-check before exclusive publication. */
export async function exportMp3({ ffmpegPath, sourcePath, outputPath, bitrateKbps = 192 }) {
  if (!ffmpegPath || !sourcePath || !outputPath || resolve(sourcePath).toLowerCase() === resolve(outputPath).toLowerCase()) throw new Error('Distinct paths and FFmpeg executable are required');
  if (![128, 160, 192, 224, 256, 320].includes(bitrateKbps)) throw new Error('Unsupported bitrate');
  const source = await readFile(sourcePath);
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const wav = parseWavBuffer(source);
  if (![1, 2].includes(wav.channels)) throw new Error('MP3 export supports mono or stereo only');
  const encoders = run(ffmpegPath, ['-hide_banner', '-encoders']);
  if (!/\blibmp3lame\b/.test(encoders.stdout)) throw new Error('FFmpeg libmp3lame encoder unavailable');
  const dir = await mkdtemp(join(dirname(resolve(outputPath)), '.aacp-mp3-'));
  try {
    const temp = join(dir, 'render.mp3');
    run(ffmpegPath, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-n', '-i', sourcePath, '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', `${bitrateKbps}k`, temp]);
    const decoded = run(ffmpegPath, ['-nostdin', '-hide_banner', '-i', temp, '-map', '0:a:0', '-f', 's16le', '-acodec', 'pcm_s16le', 'pipe:1'], { binary: true });
    const info = decoded.stderr.toString();
    const rateMatch = info.match(/Audio: mp3[^\n]*? (\d+) Hz, (mono|stereo)/i);
    if (!rateMatch || Number(rateMatch[1]) !== wav.sampleRate || (rateMatch[2].toLowerCase() === 'mono' ? 1 : 2) !== wav.channels) throw new Error('MP3 stream format differs from WAV');
    const decodedFrames = decoded.stdout.length / (wav.channels * 2);
    if (!Number.isInteger(decodedFrames) || Math.abs(decodedFrames - wav.sampleFrames) > wav.sampleRate * 0.1) throw new Error('MP3 duration differs from WAV');
    if (createHash('sha256').update(await readFile(sourcePath)).digest('hex') !== sourceHash) throw new Error('WAV changed during MP3 export');
    await link(temp, outputPath);
    return { outputPath, sampleRate: wav.sampleRate, channels: wav.channels, decodedFrames, bitrateKbps, lossy: true, sourceHashUnchanged: true };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
