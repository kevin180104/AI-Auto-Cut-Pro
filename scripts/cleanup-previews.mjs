import { lstat, readdir, rmdir, unlink } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const target = process.argv[2] && resolve(process.argv[2]);
if (!target || dirname(target).toLowerCase() !== resolve(tmpdir()).toLowerCase() || !/^aacp-review-[a-z0-9]+$/i.test(basename(target))) throw new Error('Expected an aacp-review directory directly under the OS temp directory');
const info = await lstat(target);
if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Preview directory must be a real directory');
const files = await readdir(target, { withFileTypes: true });
if (files.some(f => !f.isFile() || !/^quiet-\d+-(before|after)\.wav$/.test(f.name))) throw new Error('Unexpected directory contents; nothing removed');
for (const f of files) await unlink(resolve(target, f.name));
await rmdir(target);
console.log('Preview directory removed.');
