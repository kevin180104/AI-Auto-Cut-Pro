import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { score } from './score-auto-edit.mjs';

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function evaluateCorpus(manifestPath) {
  const base = dirname(resolve(manifestPath));
  const manifest = await json(manifestPath);
  if (manifest.version !== 1 || !Array.isArray(manifest.recordings) || !manifest.recordings.length) throw Error('Expected a version 1 corpus with recordings');
  const seen = new Set();
  const results = [];
  for (const entry of manifest.recordings) {
    if (!['development', 'calibration', 'acceptance'].includes(entry.split) || entry.authorized !== true ||
        typeof entry.reviewer !== 'string' || !entry.reviewer.trim() || entry.independent !== true) {
      throw Error('Each recording requires a split, confirmed authorization and an independent reviewer');
    }
    const [report, edl, labels] = await Promise.all(
      ['report', 'edl', 'labels'].map(key => json(resolve(base, entry[key]))),
    );
    const hash = edl.source.sha256;
    if (!/^[a-f0-9]{64}$/.test(hash) || seen.has(hash)) throw Error('Duplicate or invalid recording hash across corpus splits');
    seen.add(hash);
    if (!Number.isSafeInteger(edl.source.totalSamples) || edl.source.totalSamples <= 0) throw Error('Invalid source frame count');
    const validRange = range => Number.isSafeInteger(range?.startFrame) && Number.isSafeInteger(range?.endFrame) &&
      range.startFrame >= 0 && range.endFrame > range.startFrame && range.endFrame <= edl.source.totalSamples;
    if (!Array.isArray(labels.retakes) || !labels.retakes.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(validRange)) ||
        !Array.isArray(labels.safeRanges) || !labels.safeRanges.every(validRange)) throw Error('Invalid independent label ranges');
    if (labels.annotationComplete !== true) throw Error('Partial annotation cannot be scored for precision or recall');
    results.push({ split: entry.split, ...score(report, edl, labels) });
  }
  const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
  return Object.fromEntries(['development','calibration','acceptance'].map(split => {
    const group = results.filter(result => result.split === split);
    const sums = (section, key) => group.reduce((sum, row) => sum + row[section][key], 0);
    const tp = sums('retakes','tp'), fp = sums('retakes','fp'), fn = sums('retakes','fn');
    const selected = sums('cuts','selected'), unsafe = sums('cuts','unsafe');
    return [split, { recordings:group.length, retakes:{tp,fp,fn,precision:ratio(tp,tp+fp),recall:ratio(tp,tp+fn)},
      cuts:{selected,unsafe,falseDeletionRate:ratio(unsafe,selected)} }];
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error('Usage: node scripts/evaluate-corpus.mjs local-manifest.json');
  console.log(JSON.stringify(await evaluateCorpus(process.argv[2]), null, 2));
}
