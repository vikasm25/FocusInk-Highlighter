const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const anchor = require('../anchor.js');
const settings = require('../settings.js');

test('page keys and text context restore the correct repeated quote', () => {
  assert.equal(anchor.pageUrl('https://example.com/page?q=1#section'), 'https://example.com/page?q=1');
  assert.equal(anchor.pageUrl('chrome://settings'), null);
  const text = 'First idea. Keep this. Second idea. Keep this.';
  const second = text.lastIndexOf('Keep this.');
  assert.equal(anchor.findQuote(text, {
    quote: 'Keep this.', start: 0, prefix: 'Second idea. ', suffix: ''
  }), second);
  assert.equal(anchor.findQuote('Text has changed', { quote: 'Missing text', start: 0 }), -1);
});

test('saved box geometry follows its content and only overlapping text is selected for removal', () => {
  const box = { x: -0.05, y: -0.1, w: 1.1, h: 1.2 };
  const placed = anchor.boxRect({ left: 20, top: 40, width: 200, height: 50 }, box);
  assert.ok(Math.abs(placed.left - 10) < 0.001);
  assert.ok(Math.abs(placed.top - 35) < 0.001);
  assert.ok(Math.abs(placed.right - 230) < 0.001);
  assert.ok(Math.abs(placed.bottom - 95) < 0.001);
  const resized = anchor.boxRect({ left: 20, top: 40, width: 400, height: 100 }, box);
  assert.ok(Math.abs(resized.width - placed.width * 2) < 0.001);
  assert.ok(Math.abs(resized.height - placed.height * 2) < 0.001);
  assert.equal(anchor.overlaps(10, 20, 15, 25), true);
  assert.equal(anchor.overlaps(10, 20, 20, 25), false);
});

test('quick palette settings stay valid when switching from eight colors to four', () => {
  assert.equal(settings.normalize({ paletteSize: 4, defaultColor: 'lavender' }).defaultColor, 'yellow');
  assert.equal(settings.normalize({ paletteSize: 4 }).paletteSize, 4);
  assert.equal(settings.normalize({ showDock: false }).showDock, false);
  assert.equal(settings.normalize({ confirmWebsiteDelete: false }).confirmWebsiteDelete, false);
  assert.equal(settings.normalize().confirmWebsiteDelete, true);
  assert.equal(settings.normalize({ paletteSize: 7 }).paletteSize, 8);
});

test('saved highlights survive reads, edits, deletion, and simultaneous writes', async () => {
  const values = new Map();
  let listener;
  global.FocusInkAnchor = anchor;
  global.FocusInkSettings = settings;
  global.importScripts = () => {};
  global.crypto = require('node:crypto').webcrypto;
  global.chrome = {
    storage: { local: {
      async get(key) { return key === null ? Object.fromEntries(values) : { [key]: values.get(key) }; },
      async set(entries) {
        await new Promise(resolve => setTimeout(resolve, 2));
        for (const [key, value] of Object.entries(entries)) values.set(key, value);
      },
      async remove(keys) { for (const key of keys) values.delete(key); }
    } },
    runtime: { onMessage: { addListener(callback) { listener = callback; } } }
  };
  require('../background.js');
  const send = message => new Promise(resolve => listener(message, {}, resolve));
  const url = 'https://example.com/article#chapter-one';
  const item = { quote: 'A useful sentence', start: 42, prefix: 'Before ', suffix: ' after', color: 'yellow', note: 'Remember this' };
  const [first, second] = await Promise.all([
    send({ type: 'add', url, item }),
    send({ type: 'add', url, item: { ...item, quote: 'Another sentence', color: 'mint' } })
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const listed = await send({ type: 'list', url: 'https://example.com/article#chapter-two' });
  assert.equal(listed.data.length, 2);
  assert.equal(listed.data.find(row => row.id === first.data.id).note, 'Remember this');

  const updated = await send({ type: 'update', url, id: first.data.id, note: 'Edited note', color: 'sky' });
  assert.equal(updated.data.find(row => row.id === first.data.id).note, 'Edited note');
  assert.equal(updated.data.find(row => row.id === first.data.id).color, 'sky');
  const noNote = await send({ type: 'update', url, id: second.data.id, note: '', color: 'mint' });
  assert.equal(noNote.data.find(row => row.id === second.data.id).note, '');
  const removedHighlight = await send({ type: 'delete', url, id: first.data.id });
  assert.equal(removedHighlight.data.some(row => row.id === first.data.id), false);
  assert.equal((await send({ type: 'add', url, item: { ...item, color: 'invalid' } })).ok, false);
  const box = { selector: 'body > h1:nth-of-type(1)', tag: 'h1', text: 'Article heading',
    x: -0.05, y: -0.1, w: 1.1, h: 1.2 };
  const boxed = await send({ type: 'add', url, item: {
    kind: 'box', quote: 'Article heading', color: 'lavender', note: '', box
  } });
  assert.equal(boxed.ok, true);
  assert.equal(boxed.data.box.x, -0.05);
  assert.equal(boxed.data.box.tag, 'h1');
  const annotatedBox = await send({ type: 'update', url, id: boxed.data.id,
    note: 'Read this heading again', color: 'teal' });
  assert.equal(annotatedBox.data.find(row => row.id === boxed.data.id).note, 'Read this heading again');
  assert.equal((await send({ type: 'add', url, item: {
    kind: 'box', quote: 'Broken box', color: 'yellow', note: '', box: { ...box, w: Infinity }
  } })).ok, false);
  assert.equal((await send({ type: 'list', url: 'chrome://settings' })).ok, false);

  assert.equal((await send({ type: 'list', url })).data.length, 2);
  delete require.cache[require.resolve('../background.js')];
  require('../background.js');
  const reopened = await send({ type: 'list', url });
  assert.equal(reopened.data.length, 2);
  assert.equal(reopened.data.find(row => row.id === boxed.data.id).kind, 'box');
  assert.equal(reopened.data.find(row => row.id === boxed.data.id).note, 'Read this heading again');
  assert.equal(reopened.data.find(row => row.id === boxed.data.id).color, 'teal');
  const third = await send({ type: 'add', url, item: { ...item, quote: 'Third sentence' } });
  assert.equal((await send({ type: 'deleteMany', url, ids: [] })).ok, false);
  await send({ type: 'deleteMany', url, ids: [second.data.id, third.data.id] });
  assert.deepEqual((await send({ type: 'list', url })).data.map(row => row.id), [boxed.data.id]);
  await send({ type: 'delete', url, id: boxed.data.id });
  assert.equal((await send({ type: 'list', url })).data.length, 0);
  const legacyUrl = 'https://example.com/old-page';
  values.set(`focusink:${legacyUrl}`, [{ id: 'old', ...item, highlighted: false, createdAt: 1 }]);
  assert.equal((await send({ type: 'list', url: legacyUrl })).data[0].id, 'old');
  const migrated = await send({ type: 'update', url: legacyUrl, id: 'old',
    note: 'Updated old note', color: 'rose' });
  assert.equal(migrated.data[0].note, 'Updated old note');
  const otherPage = 'https://other.example/page';
  values.set('focusink:http://example.com/another', [{ id: 'second-old', ...item }]);
  values.set(`focusink:${otherPage}`, [{ id: 'other', ...item }]);
  values.set(settings.key, { confirmWebsiteDelete: false });
  const deletedWebsite = await send({ type: 'deleteWebsite', url });
  assert.equal(deletedWebsite.ok, true);
  assert.equal(values.has(`focusink:${url.split('#')[0]}`), false);
  assert.equal(values.has(`focusink:${legacyUrl}`), false);
  assert.equal(values.has('focusink:http://example.com/another'), false);
  assert.equal(values.has(`focusink:${otherPage}`), true);
  assert.equal(values.has(settings.key), true);
});

test('manifest references only existing extension files', () => {
  const manifest = require('../manifest.json');
  const files = [manifest.action.default_popup, manifest.action.default_icon,
    manifest.background.service_worker, manifest.options_page, ...manifest.content_scripts[0].js,
    ...manifest.content_scripts[0].css];
  for (const html of [manifest.action.default_popup, manifest.options_page]) {
    const source = fs.readFileSync(path.join(__dirname, '..', html), 'utf8');
    for (const [, file] of source.matchAll(/(?:src|href)="([a-z-]+\.(?:js|css))"/g)) files.push(file);
  }
  for (const file of files) assert.ok(fs.existsSync(path.join(__dirname, '..', file)), file);
});
