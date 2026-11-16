const $ = (id) => document.getElementById(id);

function log(code, message) {
  const line = `${new Date().toISOString()} ${code} ${message}`;
  $('log').textContent = `${line}\n${$('log').textContent}`.slice(0, 12000);
}

function evalHost(script) {
  return new Promise((resolve, reject) => {
    const cep = window.__adobe_cep__;
    if (!cep || typeof cep.evalScript !== 'function') {
      reject(Object.assign(new Error('CEP evalScript bridge is unavailable'), { code: 'CEP_BRIDGE_UNAVAILABLE' }));
      return;
    }
    cep.evalScript(script, (result) => {
      if (result === 'EvalScript error.' || result === 'undefined') {
        reject(Object.assign(new Error(String(result)), { code: 'EXTENDSCRIPT_EVAL_FAILED' }));
        return;
      }
      try {
        const parsed = JSON.parse(result);
        if (!parsed.ok) reject(Object.assign(new Error(parsed.message || parsed.code || 'Host rejected request'), { code: parsed.code || 'EXTENDSCRIPT_HOST_ERROR' }));
        else resolve(parsed);
      }
      catch { reject(Object.assign(new Error('Host returned invalid JSON'), { code: 'EXTENDSCRIPT_BAD_RESPONSE' })); }
    });
  });
}

$('host-check').addEventListener('click', async () => {
  $('host-status').textContent = 'Đang kiểm tra…';
  try {
    const result = await evalHost('AACP.getHostInfo()');
    $('host-status').textContent = `Kết nối: ${result.name} ${result.version}`;
    log('HOST_OK', `ExtendScript response received (${result.name}, ${result.version})`);
  } catch (error) {
    $('host-status').textContent = `Lỗi: ${error.code || 'HOST_ERROR'}`;
    log(error.code || 'HOST_ERROR', error.message);
  }
});

$('backend-check').addEventListener('click', async () => {
  $('backend-status').textContent = 'Đang kiểm tra…';
  try {
    const health = await fetch('http://127.0.0.1:8765/health', { cache: 'no-store' });
    if (!health.ok) throw Object.assign(new Error(`Health HTTP ${health.status}`), { code: 'BACKEND_HEALTH_HTTP' });
    const echo = await fetch('http://127.0.0.1:8765/echo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe: 'aacp-cep-poc', requestId: crypto.randomUUID() }), cache: 'no-store',
    });
    if (!echo.ok) throw Object.assign(new Error(`Echo HTTP ${echo.status}`), { code: 'BACKEND_ECHO_HTTP' });
    const result = await echo.json();
    $('backend-status').textContent = `Kết nối: ${result.service} — ${result.reply}`;
    log('BACKEND_OK', `Local backend replied (request ${result.requestId})`);
  } catch (error) {
    $('backend-status').textContent = `Lỗi: ${error.code || 'BACKEND_UNAVAILABLE'}`;
    log(error.code || 'BACKEND_UNAVAILABLE', error.message);
  }
});

log('PANEL_READY', 'Panel JavaScript loaded; host/backend checks are user initiated.');
