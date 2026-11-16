import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFile(path.join(root, name), 'utf8');

test('CEP manifest targets the Audition host observed in the installed Portal manifest', async () => {
  const manifest = await read('CSXS/manifest.xml');
  assert.match(manifest, /Host Name="AUDT" Version="11\.0"/);
  assert.match(manifest, /RequiredRuntime Name="CSXS" Version="6\.0"/);
  assert.match(manifest, /<MainPath>\.\/index\.html<\/MainPath>/);
});

test('panel and ExtendScript source pass JavaScript syntax checks', async () => {
  for (const filename of ['panel.js', 'jsx/host.jsx']) {
    const source = await read(filename);
    const result = spawnSync(process.execPath, ['--check', '--input-type=commonjs'], { input: source, encoding: 'utf8' });
    assert.equal(result.status, 0, `${filename}: ${result.stderr || result.stdout}`);
  }
});

test('POC panel exercises host and backend request paths with coded log output', async () => {
  const panel = await read('panel.js');
  assert.match(panel, /cep\.evalScript\(script/);
  assert.match(panel, /AACP\.getHostInfo\(\)/);
  assert.match(panel, /127\.0\.0\.1:8765\/health/);
  assert.match(panel, /127\.0\.0\.1:8765\/echo/);
  assert.match(panel, /toISOString\(\)/);
  assert.match(panel, /BACKEND_UNAVAILABLE/);
});

test('Python backend is constrained to loopback and has bounded health/echo endpoints', async () => {
  const backend = await read('backend/server.py');
  assert.match(backend, /HOST = "127\.0\.0\.1"/);
  assert.match(backend, /MAX_BODY = 2048/);
  assert.match(backend, /self\.path != "\/health"/);
  assert.match(backend, /self\.path != "\/echo"/);
  assert.match(backend, /BODY_SIZE_INVALID/);
});
