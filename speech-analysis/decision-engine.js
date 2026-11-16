import { createHash } from 'node:crypto';

export const RULE = 'digital-silence-v1';
const overlap = (a,b) => a.startFrame < b.endFrame && b.startFrame < a.endFrame;
const words = text => text.normalize('NFC').toLocaleLowerCase('vi').match(/[\p{L}\p{M}\p{N}]+/gu) || [];

function alignment(a,b) {
  let previous = new Uint32Array(b.length+1);
  for (const token of a) {
    const current = new Uint32Array(b.length+1);
    for(let j=1;j<=b.length;j++) current[j]=token===b[j-1]?previous[j-1]+1:Math.max(previous[j],current[j-1]);
    previous=current;
  }
  return previous[b.length];
}

export function findRetakes(segments, speech, rate, measure, script=[]) {
  const matches=[];
  for(let i=0;i<segments.length;i++) {
    const a=segments[i], x=words(a.text);
    for(let j=i+1;j<Math.min(i+4,segments.length);j++) {
      const b=segments[j], y=words(b.text), gap=b.start-a.end;
      if(gap<0||gap>5||Math.min(x.length,y.length)<3)continue;
      const shared=alignment(x,y), coverage=shared/Math.min(x.length,y.length);
      const commonStart=x[0]===y[0]&&x[1]===y[1];
      const novelty=Math.min(x.length,y.length)-shared;
      if(coverage<0.75||shared<3||(!commonStart&&novelty>1))continue;
      const likelyDistinct=x.length===y.length&&novelty>=2;
      const same=x.join(' ')===y.join(' ');
      const incomplete=!likelyDistinct&&!same&&novelty<=1&&Math.abs(x.length-y.length)>=2;
      const rawText=a.text+' '+b.text;
      const protectedText=/\p{N}|\b(?:ngày|tháng|năm|luật|nghị định|quyết định|thông tư|số|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\b/iu.test(rawText)||/\p{Lu}/u.test(a.text.trim().slice(1)+b.text.trim().slice(1));
      const takes=[a,b].map(s=>{
        const range={startFrame:Math.floor(s.start*rate),endFrame:Math.ceil(s.end*rate)};
        const t=words(s.text);
        const acoustic=measure(range);
        const scriptMatch=script.length?Math.max(...script.map(line=>{const v=words(line);return alignment(t,v)/Math.max(t.length,v.length,1);})):null;
        return {...range,words:t.length,scriptMatch,acoustic,vadOverlap:speech.some(r=>overlap(r,range))};
      }).sort((l,r)=>(r.scriptMatch??0)-(l.scriptMatch??0)||Number(r.vadOverlap)-Number(l.vadOverlap)||l.acoustic.fullScale-r.acoustic.fullScale||(incomplete?r.words-l.words:0));
      matches.push({id:'take-'+i+'-'+j,kind:'retake',status:protectedText?'PROTECTED':'RETAIN_UNCERTAIN',
        classification:likelyDistinct?'shared-context':same?'repetition-intent-unknown':incomplete?'possible-incomplete-restart':'possible-correction',
        orderedTokenCoverage:coverage,gapSeconds:gap,takes,reason:'Requires labeled intent and semantic validation before speech removal'});
    }
  }
  return matches;
}

export function validateCalibration(data, sourceHash) {
  if (!data||data.rule!==RULE||data.independent!==true||data.domain!=='vietnamese-broadcast'||!data.id||
      !Array.isArray(data.cases)||data.cases.some(row=>!row||typeof row.selected!=='boolean'||typeof row.safe!=='boolean'||!/^[a-f0-9]{64}$/.test(row.sourceHash)||row.sourceHash===sourceHash)) return null;
  const selected=data.cases.filter(row=>row.selected);
  const hashes=new Set(selected.map(row=>row.sourceHash));
  // Zero observed unsafe decisions is a minimum operational gate, not a guarantee.
  if(selected.length<100||hashes.size<10||selected.some(row=>!row.safe)||!data.cases.some(row=>!row.safe)) return null;
  return {id:data.id,sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}

export function decidePauses(proposals, {source,speech,segments,measure,calibration,shadow}) {
  const rate=source.sampleRate, hold=Math.ceil(rate*0.2), asrGuard=Math.ceil(rate*0.15);
  const protectedWords=segments.flatMap(s=>s.words?.length?s.words:[s]).map(w=>({startFrame:Math.floor(w.start*rate)-asrGuard,endFrame:Math.ceil(w.end*rate)+asrGuard}));
  const policy=validateCalibration(calibration,source.sha256);
  return proposals.map(p=>{
    const range={startFrame:p.startFrame+hold,endFrame:p.endFrame-hold};
    const base={id:p.id,kind:'pause',...range,proposalStart:p.startFrame,proposalEnd:p.endFrame,status:'RETAIN_UNCERTAIN'};
    if(range.endFrame<=range.startFrame||p.startFrame===0||p.endFrame===source.totalSamples) return {...base,reason:'Boundary pause or insufficient room'};
    if(speech.some(s=>overlap(s,range))||protectedWords.some(w=>overlap(w,range))) return {...base,status:'PROTECTED',reason:'VAD or padded ASR crosses proposed cut'};
    const signal=measure({startFrame:range.startFrame-hold,endFrame:range.endFrame+hold});
    if(signal.peak!==0) return {...base,reason:'Audible energy or nonzero samples in pause',signal};
    if(!segments.length) return {...base,reason:'ASR yielded no evidence',signal};
    const qualified={...base,signal,eligible:true};
    if(!policy||shadow) return {...qualified,reason:shadow?'Shadow mode':'Independent calibration unavailable'};
    return {...qualified,status:'AUTO_APPROVED',reason:'Interior digital silence with protected margins',policy};
  });
}

export function createDecisionEdl(source,outputPath,decisions) {
  const cuts=decisions.filter(d=>d.status==='AUTO_APPROVED').sort((a,b)=>a.startFrame-b.startFrame);
  const keepSegments=[], removedSegments=[];
  let cursor=0;
  for(const d of cuts){
    if(d.startFrame<=cursor||d.endFrame>=source.totalSamples)throw Error('Conflicting automatic cuts');
    keepSegments.push({id:'keep-'+keepSegments.length,sourceStartSample:cursor,sourceEndSample:d.startFrame});
    removedSegments.push({id:d.id,sourceStartSample:d.startFrame,sourceEndSample:d.endFrame,approval:'auto-approved',
      reason:d.reason,evidence:'VAD, padded ASR and exact digital silence on every channel',
      provenance:{rule:RULE,calibration:d.policy,sourceHash:source.sha256}});
    cursor=d.endFrame;
  }
  keepSegments.push({id:'keep-'+keepSegments.length,sourceStartSample:cursor,sourceEndSample:source.totalSamples});
  return {version:1,source,output:{path:outputPath},keepSegments,removedSegments};
}
