const $ = id => document.getElementById(id);
const player = $('player');
let data, selected, variant = 'before', busy = false, waveform = 0;
let context;
const frameTime = frame => {
  const ms = Math.floor(frame * 1000 / data.sampleRate);
  return new Date(ms).toISOString().slice(11,23);
};
const status = id => data.decisions[id]?.status || 'REVIEW';
const visible = () => data.proposals.filter(p => !$('filter').value || status(p.id) === $('filter').value);
const message = text => { $('message').textContent = text; };
async function request(path, body) {
  const response = await fetch(path, body ? {method:'POST',headers:{'Content-Type':'application/json','X-Studio':'1'},body:JSON.stringify({...body,sourceHash:data.sourceHash,proposalVersion:data.proposalVersion,revision:data.revision})} : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
function display() {
  const done = data.proposals.filter(p => status(p.id) !== 'REVIEW').length;
  $('progress').max = data.proposals.length || 1;
  $('progress').value = done;
  $('progressText').textContent = done+' / '+data.proposals.length+' đã quyết định';
  $('list').replaceChildren();
  for (const p of visible()) {
    const button = document.createElement('button');
    button.setAttribute('aria-current', String(p.id === selected?.id));
    button.append(p.id, ' '+status(p.id));
    const time = document.createElement('small');
    time.textContent = frameTime(p.startFrame)+' – '+frameTime(p.endFrame);
    button.append(time);
    button.onclick = () => select(p);
    $('list').append(button);
  }
  $('title').textContent = selected ? frameTime(selected.startFrame)+' – '+frameTime(selected.endFrame) : 'Không có đề xuất trong bộ lọc';
  $('position').textContent = selected ? '#'+(data.proposals.indexOf(selected)+1)+' / '+data.proposals.length : '';
  $('detail').textContent = selected ? selected.id+' · '+status(selected.id)+' · frame ['+selected.startFrame+', '+selected.endFrame+')' : '';
  for(const b of document.querySelectorAll('.decisions button')) b.disabled=!selected||busy;
  $('export').disabled=busy||!Object.keys(data.decisions).length;
}
async function loadAudio(play = false) {
  const token = ++waveform;
  const canvas = $('wave'), draw = canvas.getContext('2d');
  canvas.width = canvas.clientWidth || 640; canvas.height = 132;
  draw.clearRect(0,0,canvas.width,canvas.height);
  player.pause();
  if (!selected) { player.removeAttribute('src'); player.load(); return; }
  const p = selected, mode = variant;
  const url = '/audio/'+p.id+'/'+mode;
  $('before').setAttribute('aria-pressed', String(mode==='before'));
  $('after').setAttribute('aria-pressed', String(mode==='after'));
  player.src = url;
  if (play) player.play().catch(error=>message(error.message));
  $('legend').textContent = mode === 'before' ? 'Nền vàng: vùng đề xuất cắt. Hai bên là ngữ cảnh.' : 'Vạch vàng: vị trí nối sau khi bỏ vùng đề xuất.';
  try {
    context ||= new AudioContext();
    const response = await fetch(url);
    if (!response.ok) throw new Error('Preview không khả dụng');
    const audio = await context.decodeAudioData(await response.arrayBuffer());
    if (token !== waveform) return;
    const left = Math.min(1,p.startFrame/data.sampleRate);
    const x0 = left / audio.duration * canvas.width;
    const x1 = x0 + (p.endFrame-p.startFrame)/data.sampleRate/audio.duration*canvas.width;
    draw.fillStyle = '#ffd08038';
    draw.fillRect(x0,0,mode==='before'?x1-x0:2,canvas.height);
    const samples = audio.getChannelData(0);
    draw.strokeStyle='#acdfff'; draw.beginPath();
    for(let x=0;x<canvas.width;x++) {
      const from=Math.floor(x*samples.length/canvas.width), end=Math.floor((x+1)*samples.length/canvas.width);
      let low=0, high=0;
      for(let i=from;i<end;i++){low=Math.min(low,samples[i]);high=Math.max(high,samples[i]);}
      draw.moveTo(x,66-high*58);draw.lineTo(x,66-low*58);
    }
    draw.stroke();
  } catch(error) { if(token===waveform) message('Dạng sóng: '+error.message); }
}
function select(p) { const playing=!player.paused; selected=p; display(); void loadAudio(playing); }
function move(delta) {
  const list=visible(), index=list.indexOf(selected);
  if (list.length) select(list[Math.max(0,Math.min(list.length-1,index+delta))]);
}
function switchTo(mode) {if(mode!==variant){const playing=!player.paused;variant=mode;void loadAudio(playing);}}
async function decide(value) {
  if(!selected||busy)return;
  const id=selected.id, prior=data.decisions[id];
  if(prior?.status===value)return;
  if(prior&&!confirm('Đổi quyết định '+prior.status+' thành '+value+'?'))return;
  busy=true;display();
  try {
    Object.assign(data,await request('/api/decision',{id,status:value,replace:!!prior}));
    message('Đã lưu '+id+' · '+value);
    if(selected?.id===id&&!visible().includes(selected)) select(visible()[0]);
  } catch(error){message(error.message);}
  finally{busy=false;display();}
}
$('filter').onchange=()=>select(visible()[0]);
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);
$('before').onclick=()=>switchTo('before');$('after').onclick=()=>switchTo('after');
for(const b of document.querySelectorAll('.decisions button'))b.onclick=()=>decide(b.dataset.status);
$('export').onclick=async()=>{
  const count=data.proposals.filter(p=>status(p.id)==='APPROVE').length;
  if(busy||!confirm('Kết thúc phiên duyệt và cắt '+count+' vùng APPROVE? Các vùng KEEP và REVIEW sẽ được giữ.'))return;
  busy=true;display();message('Đang xác minh nguồn và xuất file…');
  const crossfade=$('crossfade').checked;
  if(crossfade&&!confirm('Duyệt chồng 5 ms âm thanh giữ lại tại mỗi điểm nối bên trong để tạo bản so sánh?')){busy=false;display();message('Đã hủy xuất.');return;}
  try{const r=await request('/api/export',{confirm:true,crossfade,mp3:$('mp3').checked});message('Đã xuất '+r.wav+(r.crossfade?' · '+r.crossfade:r.crossfadeError?' · Không xuất được crossfade':'')+(r.mp3Error?' · Xuất MP3 thất bại':r.mp3?' · Và MP3 từ bản cắt thẳng':''));}
  catch(error){message(error.message);}finally{busy=false;display();}
};
document.addEventListener('keydown',event=>{
  if(!data||event.ctrlKey||event.altKey||event.metaKey||event.target.closest('input, textarea, select, [contenteditable]'))return;
  const key=event.key.toLowerCase();
  const actions={' ':()=>player.paused?player.play().catch(e=>message(e.message)):player.pause(),'1':()=>decide('KEEP'),'2':()=>decide('APPROVE'),'3':()=>decide('REVIEW'),arrowleft:()=>move(-1),arrowright:()=>move(1),a:()=>switchTo('before'),b:()=>switchTo('after'),r:()=>{player.currentTime=0;player.play().catch(e=>message(e.message));}};
  if(Object.hasOwn(actions,key)){if(key===' '&&event.target.closest('button,a'))return;event.preventDefault();if(!event.repeat)actions[key]();}
});
const crossfadeLabel=document.createElement('label');
const crossfadeInput=document.createElement('input');
crossfadeInput.type='checkbox';crossfadeInput.id='crossfade';
crossfadeLabel.append(crossfadeInput,' Thêm bản crossfade 5 ms');
$('export').before(crossfadeLabel);
try { data=await request('/api/state'); select(data.proposals[0]); } catch(error){message(error.message);}
