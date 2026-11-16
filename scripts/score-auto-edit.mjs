import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ratio=(a,b)=>b?a/b:null;
// Labels are selected by an independent reviewer against the exact same source and frame grid.
export function score(report, edl, labels) {
  if(labels.sourceHash!==edl.source.sha256)throw Error('Label source hash mismatch');
  const pairKey=takes=>takes.map(t=>t.startFrame+':'+t.endFrame).sort().join('|');
  const detected=new Set(report.decisions.filter(d=>d.kind==='retake'&&d.classification!=='shared-context').map(d=>pairKey(d.takes)));
  const positives=new Set(labels.retakes.map(pairKey));
  const tp=[...detected].filter(key=>positives.has(key)).length;
  const covers=(cut,expected)=>cut.sourceStartSample>=expected.startFrame&&cut.sourceEndSample<=expected.endFrame;
  const automatic=edl.removedSegments.filter(r=>r.approval==='auto-approved');
  const unsafe=automatic.filter(cut=>!labels.safeRanges.some(range=>covers(cut,range))).length;
  return {retakes:{tp,fp:detected.size-tp,fn:positives.size-tp,precision:ratio(tp,detected.size),recall:ratio(tp,positives.size)},
    cuts:{selected:automatic.length,unsafe,precision:ratio(automatic.length-unsafe,automatic.length),falseDeletionRate:ratio(unsafe,automatic.length)}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==5)throw Error('Usage: node scripts/score-auto-edit.mjs report.json edl.json independent-labels.json');
  const [report,edl,labels]=await Promise.all(process.argv.slice(2).map(async path=>JSON.parse(await readFile(path,'utf8'))));
  console.log(JSON.stringify(score(report,edl,labels),null,2));
}
