/* global cep_node */
(function () {
  var child = null;
  var ready = null;
  var busy = false;
  var button = document.getElementById('prepare-wav');
  var openButton = document.getElementById('open-review');
  var status = document.getElementById('handoff-status');
  var output = document.getElementById('output-folder');
  function close() {
    if (child) child.stdin.end();
    child = null;
  }
  window.addEventListener('unload', close);
  function pick(cep, directory, title, formats) {
    var result = cep.fs.showOpenDialog(false, directory, title, '', formats);
    if (result.err) throw Error('Không mở được hộp thoại (CEP '+result.err+').');
    return result.data && result.data[0];
  }
  button.addEventListener('click', function () {
    if (busy) return;
    try {
      if (!window.cep || typeof cep_node === 'undefined') throw Error('Cần mở panel trong Audition với CEP Node được hỗ trợ.');
      var cep = window.cep;
      var path = cep_node.require('path');
      var fs = cep_node.require('fs');
      var root = pick(cep,true,'Chọn thư mục dự án AI Auto Cut Pro',[]);
      if (!root) return;
      var launcher = path.join(root,'scripts','audition-handoff.mjs');
      if (!fs.existsSync(launcher)) throw Error('Thư mục dự án không có trình xử lý Audition.');
      var node = 'C:\\Program Files\\nodejs\\node.exe';
      if (!fs.existsSync(node)) node = pick(cep,false,'Chọn node.exe đã cài', ['exe']);
      if (!node) return;
      if (path.basename(node).toLowerCase() !== 'node.exe') throw Error('Chọn tệp node.exe.');
      var source = pick(cep,false,'Chọn WAV đã lưu hoặc xuất từ Audition',['wav']);
      if (!source) return;
      close();
      ready = null;
      openButton.disabled = true;
      output.textContent = '';
      busy = true;
      button.disabled = true;
      status.textContent = 'Đang phân tích âm thanh trên máy…';
      var proc = cep_node.require('child_process').spawn(node,[launcher,source],{
        cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']
      });
      child = proc;
      proc.stdin.on('error',function(){});
      proc.stderr.resume();
      var buffer = '';
      proc.stdout.on('data',function(chunk){
        if(child !== proc) return;
        buffer += chunk.toString();
        var lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for(var i=0;i<lines.length;i++){
          if(lines[i].indexOf('AACP_READY ')!==0) continue;
          try {
            var info = JSON.parse(lines[i].slice(11));
            if(!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/$/.test(info.url)) throw Error('Địa chỉ Studio không hợp lệ.');
            ready = info;
            output.textContent = info.directory;
            status.textContent = 'Phiên đã sẵn sàng. Mở Studio để nghe, duyệt và xuất WAV.';
            openButton.disabled = false;
            button.disabled = false;
            busy = false;
          } catch(error) { status.textContent = error.message; }
        }
      });
      proc.on('error',function(error){
        if(child !== proc) return;
        status.textContent = 'Không thể khởi động: '+error.message;
        child=null; busy=false; button.disabled=false;
      });
      proc.on('exit',function(code){
        if(child !== proc) return;
        child=null; ready=null; busy=false; button.disabled=false; openButton.disabled=true;
        status.textContent=code===0?'Phiên Studio đã đóng.':'Xử lý thất bại. Kiểm tra Node, Python, model và FFmpeg.';
      });
    } catch(error) {
      busy=false;button.disabled=false;
      status.textContent=error.message;
    }
  });
  openButton.addEventListener('click',function(){
    if(ready) window.cep.util.openURLInDefaultBrowser(ready.url);
  });
}());
