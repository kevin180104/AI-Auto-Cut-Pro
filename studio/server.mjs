import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, open, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvedEdl } from '../speech-analysis/activity.js';
import { publishRender } from '../audio-engine/publish.js';
import { exportMp3 } from '../audio-engine/mp3.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const statuses = ['KEEP', 'APPROVE', 'REVIEW'];
const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };

export async function createStudio(directory = join(root, 'work/acceptance/real-01')) {
  const dir = await realpath(directory);
  const reviewBytes = await readFile(join(dir, 'review.json'));
  const review = JSON.parse(reviewBytes);
  let reference;
  try {
    reference = JSON.parse(await readFile(join(dir, 'studio-source.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    reference = JSON.parse(await readFile(join(dir, 'reference.edl.json'), 'utf8'));
  }
  const sourcePath = reference.source.path;
  const identity = { sourceHash: review.source.sha256, proposalVersion: hash(reviewBytes) };
  if (reference.source.sha256 !== identity.sourceHash) throw new Error('Nguồn và danh sách đề xuất không khớp');
  const proposals = new Map();
  let last = 0;
  for (const p of review.proposals) {
    if (!/^quiet-\d+$/.test(p.id) || proposals.has(p.id) || !Number.isSafeInteger(p.startFrame) || !Number.isSafeInteger(p.endFrame) || p.startFrame < last || p.endFrame <= p.startFrame || p.endFrame > review.source.totalSamples) throw new Error('Danh sách đề xuất không hợp lệ');
    proposals.set(p.id, p);
    last = p.endFrame;
  }
  const decisionPath = join(dir, 'studio-decisions.json');
  let queue = Promise.resolve();
  function serialize(task) {
    const result = queue.then(async () => {
      const lockPath = decisionPath + '.lock';
      const lock = await open(lockPath, 'wx');
      try { return await task(); }
      finally { await lock.close(); await unlink(lockPath); }
    });
    queue = result.catch(() => {});
    return result;
  }
  async function state() {
    let saved;
    try { saved = JSON.parse(await readFile(decisionPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { ...identity, revision: 0, decisions: {}, history: [] }; throw error; }
    if (Object.keys(identity).some(key => saved[key] !== identity[key])) throw new Error('Quyết định đã lưu thuộc bản thu hoặc danh sách khác');
    if (!Number.isSafeInteger(saved.revision) || !Array.isArray(saved.history) || saved.revision !== saved.history.length || !saved.decisions) throw new Error('Tiến độ đã lưu không hợp lệ');
    for (const [id, decision] of Object.entries(saved.decisions)) {
      const proposal = proposals.get(id);
      if (!proposal || decision.id !== id || !statuses.includes(decision.status) || decision.startFrame !== proposal.startFrame || decision.endFrame !== proposal.endFrame) throw new Error('Quyết định đã lưu không khớp đề xuất');
    }
    return saved;
  }
  function matching(body, saved) {
    if (Object.keys(identity).some(key => body[key] !== identity[key]) || body.revision !== saved.revision) throw new Error('Phiên duyệt đã thay đổi. Hãy tải lại trang.');
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const host = '127.0.0.1:' + server.address().port;
    const json = (code, data) => { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== 'http://' + host) || ['cross-site','same-site'].includes(req.headers['sec-fetch-site'])) return json(403, {error:'Yêu cầu ngoài Studio'});
    const route = req.url;
    try {
      if (req.method === 'GET' && Object.hasOwn(assets, route)) {
        const [name, type] = assets[route];
        res.writeHead(200, {'Content-Type':type+'; charset=utf-8'});
        return res.end(await readFile(new URL(name, import.meta.url)));
      }
      if (req.method === 'GET' && route === '/api/state') {
        const saved = await state();
        return json(200, { ...identity, revision:saved.revision, decisions:saved.decisions, proposals:review.proposals, sampleRate:review.source.sampleRate });
      }
      const match = /^\/audio\/(quiet-\d+)\/(before|after)$/.exec(route);
      if (req.method === 'GET' && match && proposals.has(match[1])) {
        const path = join(dir, match[1]+'-'+match[2]+'.wav');
        const info = await lstat(path);
        if (!info.isFile() || await realpath(path) !== path) return json(404, {error:'Preview không hợp lệ'});
        const size = info.size;
        const range = req.headers.range;
        let start = 0, end = size - 1;
        if (range) {
          const parts = /^bytes=(\d+)-(\d*)$/.exec(range);
          if (!parts || Number(parts[1]) >= size || (parts[2] && Number(parts[2]) < Number(parts[1]))) {
            res.writeHead(416, {'Content-Range':'bytes */'+size}); return res.end();
          }
          start = Number(parts[1]); if (parts[2]) end = Math.min(end, Number(parts[2]));
          res.setHeader('Content-Range', 'bytes '+start+'-'+end+'/'+size);
        }
        res.writeHead(range ? 206 : 200, {'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':end-start+1});
        const stream = createReadStream(path,{start,end});
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        return stream.pipe(res);
      }
      if (req.method !== 'POST' || !['/api/decision','/api/export'].includes(route)) return json(404,{error:'Không tìm thấy'});
      if (req.headers.origin !== 'http://'+host || req.headers['x-studio'] !== '1' || req.headers['content-type'] !== 'application/json') return json(403,{error:'Yêu cầu ngoài Studio'});
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 4096) return json(413,{error:'Yêu cầu quá lớn'}); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks));
      const result = await serialize(async () => {
        const saved = await state();
        matching(body,saved);
        if (route === '/api/export') {
          if (body.confirm !== true || saved.history.length === 0) throw new Error('Cần xác nhận kết thúc phiên duyệt');
          const ids = [...proposals.keys()].filter(id => saved.decisions[id]?.status === 'APPROVE');
          const stem = 'studio-r'+saved.revision;
          const wav = join(dir,stem+'.wav');
          const edl = approvedEdl(review,ids,sourcePath,wav);
          edl.review = {...identity,revision:saved.revision,approvals:ids.map(id=>saved.decisions[id])};
          await publishRender(edl,join(dir,stem+'.edl.json'));
          const output = {wav:stem+'.wav', approved:ids.length};
          if (body.crossfade === true && edl.keepSegments.length > 1) {
            const comparison = structuredClone(edl);
            comparison.output.path = join(dir,stem+'-crossfade.wav');
            comparison.effects = {approval:'human-approved',crossfadeFrames:Math.floor(review.source.sampleRate*0.005)};
            try {
              await publishRender(comparison,join(dir,stem+'-crossfade.edl.json'));
              output.crossfade = stem+'-crossfade.wav';
            } catch { output.crossfadeError = true; }
          }
          if (body.mp3 === true) {
            try { await exportMp3({ffmpegPath:process.env.AACP_FFMPEG || 'C:/Program Files/FormatFactory5.21.0.0/ffmpeg.exe',sourcePath:wav,outputPath:join(dir,stem+'.mp3')}); }
            catch { output.mp3Error = true; }
          }
          return {...output,mp3:body.mp3===true && !output.mp3Error};
        }
        const p = proposals.get(body.id);
        if (!p || !statuses.includes(body.status)) throw new Error('Quyết định không hợp lệ');
        const prior = saved.decisions[p.id];
        if (prior?.status === body.status) return {revision:saved.revision,decisions:saved.decisions};
        if (prior && body.replace !== true) throw new Error('Cần xác nhận thay đổi quyết định đã lưu');
        const decision = {id:p.id,status:body.status,startFrame:p.startFrame,endFrame:p.endFrame,startSeconds:p.startSeconds,endSeconds:p.endSeconds,at:new Date().toISOString(),previousStatus:prior?.status ?? null};
        saved.decisions[p.id] = decision;
        saved.history.push(decision);
        saved.revision++;
        const temp = decisionPath+'.'+process.pid+'.'+saved.revision+'.tmp';
        await writeFile(temp,JSON.stringify(saved,null,2),{flag:'wx'});
        try { await rename(temp,decisionPath); }
        catch (error) { await unlink(temp); throw error; }
        return {revision:saved.revision,decisions:saved.decisions};
      });
      return json(200,result);
    } catch (error) {
      if (!res.headersSent) return json(409,{error:error.code ? 'Không thể đọc hoặc ghi file cục bộ ('+error.code+')' : error.message});
      res.destroy();
    }
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createStudio(process.argv[2] ? resolve(process.argv[2]) : undefined);
  server.listen(Number(process.env.AACP_PORT || 8768),'127.0.0.1',()=>console.log('Audio Review Studio: http://127.0.0.1:'+server.address().port));
}
