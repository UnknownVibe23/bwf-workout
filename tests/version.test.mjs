import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'version.js'), 'utf8');
const m = src.match(/var APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/);
assert.ok(m, 'version.js defines APP_VERSION in SemVer format');
const [, major, minor, patch] = m.map(Number);
assert.ok(major >= 0 && minor >= 0 && patch >= 0);

const sw = readFileSync(join(root, 'sw.js'), 'utf8');
assert.ok(sw.includes("importScripts('./version.js')"), 'sw.js reads the version from version.js');
assert.ok(!/bwf-workout-v\d/.test(sw), 'sw.js has no hardcoded cache version');

const html = readFileSync(join(root, 'index.html'), 'utf8');
assert.ok(html.includes('./version.js'), 'index.html loads version.js');

console.log(`Version test passed: APP_VERSION = ${m[1]}.${m[2]}.${m[3]}`);
