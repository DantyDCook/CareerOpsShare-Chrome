import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');

test('Manifest V3 permission and code boundary', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.manifest_version, 3);
  assert.equal(m.version, '0.1.0');
  assert.ok(m.permissions.includes('activeTab'));
  assert.ok(m.permissions.includes('scripting'));
  assert.ok(m.permissions.includes('contextMenus'));
  assert.equal('host_permissions' in m, false);
  assert.equal(m.background.service_worker, 'background.js');
  for (const icon of Object.values(m.icons)) assert.ok(existsSync(resolve(root, icon)));
});

test('both extension views reference packaged scripts and styles', () => {
  for (const page of ['popup.html', 'review.html']) {
    const html = read(page);
    assert.match(html, /src="ui\.js"/);
    assert.match(html, /href="ui\.css"/);
    assert.match(html, /id="copyOpen"/);
  }
});

test('no remote-loaded code or automatic submission transport', () => {
  for (const script of ['core.js', 'background.js', 'capture.js', 'ui.js']) {
    const js = read(script);
    assert.doesNotMatch(js, /\beval\s*\(/);
    assert.doesNotMatch(js, /\bnew\s+Function\s*\(/);
    assert.doesNotMatch(js, /\bfetch\s*\(/);
    assert.doesNotMatch(js, /XMLHttpRequest/);
    assert.doesNotMatch(js, /\.submit\s*\(/);
  }
});
