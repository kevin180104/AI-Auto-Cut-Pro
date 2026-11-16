import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillsRoot = path.resolve(scriptDir, '..', '.agents', 'skills');
const entries = await readdir(skillsRoot, { withFileTypes: true });
const skillDirs = entries.filter((entry) => entry.isDirectory());
const required = [
  'audition-compatibility',
  'speech-error-detection',
  'best-take-selection',
  'vietnamese-script-alignment',
  'audio-editing-engine',
  'audio-quality-assurance',
  'error-memory-manager',
  'regression-guardian',
];

const errors = [];
for (const name of required) {
  if (!skillDirs.some((entry) => entry.name === name)) errors.push(`Missing skill directory: ${name}`);
}
for (const entry of skillDirs) {
  const file = path.join(skillsRoot, entry.name, 'SKILL.md');
  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    errors.push(`${entry.name}: SKILL.md is missing`);
    continue;
  }
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) {
    errors.push(`${entry.name}: YAML frontmatter is missing`);
    continue;
  }
  const fields = frontmatter[1];
  const skillName = fields.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fields.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!skillName || skillName !== entry.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName) || skillName.length > 64) {
    errors.push(`${entry.name}: name must match its folder and the Agent Skills naming rules`);
  }
  if (!description || description.length > 1024) errors.push(`${entry.name}: description must be 1-1024 characters`);
  if (!/^#\s/m.test(content.slice(frontmatter[0].length))) errors.push(`${entry.name}: Markdown instructions are missing`);
  if (!/acceptance|scenario/i.test(content)) errors.push(`${entry.name}: validation scenarios are missing`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${required.length} required Agent Skills have valid basic metadata and validation scenarios.`);
}
