import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStudio } from '../studio/server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function file(path, label) {
  if (!(await stat(path).catch(() => null))?.isFile()) throw Error(label+' not available');
  return path;
}

export async function startHandoff(source) {
  const input = resolve(source);
  if (extname(input).toLowerCase() !== '.wav') throw Error('Chọn WAV đã lưu hoặc xuất từ Audition.');
  await file(input, 'WAV');
  const python = process.env.AACP_ASR_PYTHON || join(root, '.venv', 'Scripts', 'python.exe');
  const model = process.env.AACP_ASR_MODEL || join(root, 'work', 'models', 'faster-whisper-base');
  await file(python, 'Python');
  await file(join(model,'model.bin'), 'ASR model');
  const parent = join(root,'work','audition');
  await mkdir(parent,{recursive:true});
  const output = join(parent,'session-'+randomUUID());
  console.log('AACP_STAGE preparing');
  await new Promise((done,fail)=>{
    const worker=spawn(process.execPath,[join(root,'scripts','auto-edit.mjs'),input,'--output',output,'--shadow','--studio'],{
      cwd:root,env:{...process.env,AACP_ASR_PYTHON:python,AACP_ASR_MODEL:model},stdio:['ignore','ignore','inherit'],windowsHide:true
    });
    worker.once('error',fail);
    worker.once('exit',code=>code===0?done():fail(Error('Local audio preparation failed ('+code+')')));
  });
  const directory=join(output,'studio-session');
  const server=await createStudio(directory);
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
  return {server,url:'http://127.0.0.1:'+server.address().port+'/',directory};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3)throw Error('Usage: node scripts/audition-handoff.mjs input.wav');
  const {server,url,directory}=await startHandoff(process.argv[2]);
  console.log('AACP_READY '+JSON.stringify({url,directory}));
  // CEP owns the stdin pipe. End the listener when the panel closes.
  process.stdin.on('end',()=>server.close());
  process.stdin.resume();
}
