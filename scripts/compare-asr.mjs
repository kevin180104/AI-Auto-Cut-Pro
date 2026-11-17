import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function canonicalWords(transcript) {
  return transcript.segments.flatMap(segment=>segment.words?.length
    ? segment.words.map(word=>word.text) : [segment.text])
    .join(' ').normalize('NFC').replace(/\s+/g,' ').trim();
}

export function compareTranscripts(before, after) {
  const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  return {
    sameInputFile:before.inputSha256!=null&&before.inputSha256===after.inputSha256,
    sameDecodedSamples:before.pcmSha256&&after.pcmSha256?before.pcmSha256===after.pcmSha256:null,
    sameExecutionProfile:before.profile&&after.profile?exact(before.profile,after.profile):null,
    sameWords:canonicalWords(before)===canonicalWords(after),
    segments:[before.segments.length,after.segments.length],
  };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4)throw Error('Usage: node scripts/compare-asr.mjs first.json second.json');
  const [first,second]=await Promise.all(process.argv.slice(2).map(async path=>JSON.parse(await readFile(path,'utf8'))));
  console.log(JSON.stringify(compareTranscripts(first,second),null,2));
}
