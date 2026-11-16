import { exportMp3 } from '../audio-engine/mp3.js';
const [ffmpegPath, sourcePath, outputPath, bitrate] = process.argv.slice(2);
if (!ffmpegPath || !sourcePath || !outputPath) throw new Error('Usage: node scripts/export-mp3.mjs <ffmpeg.exe> <verified.wav> <new.mp3> [bitrate-kbps]');
console.log('MP3 is lossy; WAV ancillary metadata is not preserved.');
console.log(JSON.stringify(await exportMp3({ ffmpegPath, sourcePath, outputPath, bitrateKbps: bitrate ? Number(bitrate) : 192 }), null, 2));
