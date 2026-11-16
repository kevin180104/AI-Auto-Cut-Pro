/** Heuristic evidence only. Raw scores must never authorize a cut. */
export function classify(segments, proposals) {
  const words = segments.flatMap(s => s.words);
  const findings = proposals.map(p => ({
    id:p.id, start:p.startSeconds, end:p.endSeconds,
    mode:words.some(w => w.start < p.endSeconds && w.end > p.startSeconds) ? 'PROTECTED' : 'CONSERVATIVE',
    reason:'VAD pause candidate. Intent and speech absence are unverified.',
  }));
  const tokens = text => text.normalize('NFC').toLocaleLowerCase('vi').match(/[\p{L}\p{M}\p{N}]+/gu) || [];
  const protectedText = text => /\p{N}|\b[A-ZĐ]{2,}\b/u.test(text) || /\p{Lu}/u.test(text.trim().slice(1));
  for (let i=1;i<segments.length;i++) {
    const a=segments[i-1], b=segments[i];
    if (b.start-a.end>5) continue;
    const x=tokens(a.text), y=tokens(b.text);
    if (Math.min(x.length,y.length)<3) continue;
    let prefix=0;
    while (prefix<Math.min(x.length,y.length) && x[prefix]===y[prefix]) prefix++;
    if (prefix<3 || prefix/Math.min(x.length,y.length)<0.75) continue;
    const average = s => s.words.reduce((sum,w)=>sum+w.score,0)/Math.max(1,s.words.length);
    findings.push({start:a.start,end:b.end,mode:protectedText(a.text)||protectedText(b.text)?'PROTECTED':'CONSERVATIVE',
      reason:'Adjacent repeated prefix. Could be retake, incomplete reading or intentional repetition.',
      takes:[a,b].map(s=>({start:s.start,end:s.end,tokenCount:tokens(s.text).length,meanAsrScore:average(s)}))
        .sort((l,r)=>r.tokenCount-l.tokenCount||r.meanAsrScore-l.meanAsrScore)});
  }
  return findings;
}
