const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const settings = require('../settings.js');
const anchor = require('../anchor.js');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.classList = { toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  querySelector(name) {
    this.parts ||= new Map();
    if (!this.parts.has(name)) this.parts.set(name, new Element(name));
    return this.parts.get(name);
  }
}

function mount(chrome) {
  const ids = ['site-count', 'page-count', 'annotation-count', 'library-search',
    'library-filter', 'websites', 'website-list-count', 'pages', 'selected-site-title',
    'selected-site-summary', 'library-empty', 'delete-annotations', 'library-status',
    'site-delete-dialog', 'delete-dialog-copy', 'skip-website-confirm', 'palette-size',
    'default-color', 'show-dock', 'show-annotations', 'hover-notes', 'confirm-website-delete'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
  nodes['library-filter'].value = 'all';
  const document = {
    getElementById(id) { return nodes[id]; },
    createElement(tag) { return new Element(tag); },
    addEventListener() {}
  };
  const context = vm.createContext({ document, URL, FocusInkSettings: settings,
    FocusInkAnchor: anchor, chrome, setTimeout: () => 0, clearTimeout() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8'), context);
  return { nodes, context };
}

test('library website selection and search show annotations for the chosen site', () => {
  const { nodes, context } = mount();
  vm.runInContext(`rows = [
    {host:'alpha.example', url:'https://alpha.example/one', item:{id:'a', kind:'text', quote:'First idea', color:'yellow', note:''}},
    {host:'beta.example', url:'https://beta.example/two', item:{id:'b', kind:'box', quote:'Second idea', color:'mint', note:'Needle'}}
  ]; render();`, context);

  assert.equal(nodes['website-list-count'].textContent, '2');
  assert.equal(nodes['selected-site-title'].textContent, 'alpha.example');
  assert.equal(nodes.pages.children.length, 1);
  const annotationRow = nodes.pages.children[0].children[1].children[0];
  assert.equal(annotationRow.children[0].tagName, 'input');
  assert.equal(annotationRow.children[1].tagName, 'details');
  nodes.websites.children[1].listeners.get('click')();
  assert.equal(nodes['selected-site-title'].textContent, 'beta.example');
  assert.equal(nodes.pages.children.length, 1);

  nodes['library-search'].value = 'needle';
  vm.runInContext('render()', context);
  assert.equal(nodes.websites.children.length, 1);
  assert.equal(nodes['selected-site-title'].textContent, 'beta.example');
  nodes['library-filter'].value = 'highlights';
  vm.runInContext('render()', context);
  assert.equal(nodes['library-empty'].hidden, false);
});

test('checked deletion is immediate; website deletion can be cancelled and its prompt skipped later', async () => {
  const values = new Map([
    ['focusink:https://alpha.example/one', [
      { id: 'a', kind: 'text', quote: 'First', color: 'yellow', note: '', createdAt: 3 },
      { id: 'b', kind: 'text', quote: 'Second', color: 'sky', note: 'Read', createdAt: 2 }
    ]],
    ['focusink:https://beta.example/two', [
      { id: 'c', kind: 'box', quote: 'Third', color: 'mint', note: '', createdAt: 1 }
    ]]
  ]);
  const sent = [];
  const chrome = {
    storage: { local: {
      async get(key) { return key === null ? Object.fromEntries(values) : { [key]: values.get(key) }; },
      async set(entries) { for (const [key, value] of Object.entries(entries)) values.set(key, value); }
    } },
    runtime: { async sendMessage(message) {
      sent.push(message.type);
      if (message.type === 'deleteMany') {
        const key = `focusink:${message.url}`;
        values.set(key, values.get(key).filter(item => !message.ids.includes(item.id)));
      } else if (message.type === 'deleteWebsite') {
        for (const key of [...values.keys()]) if (key.startsWith('focusink:') &&
          key.includes('alpha.example')) values.delete(key);
        if (message.url.includes('beta.example')) values.delete(`focusink:${message.url}`);
      }
      return { ok: true };
    } }
  };
  const { nodes, context } = mount(chrome);
  let confirmations = 0;
  let approve = false;
  nodes['site-delete-dialog'].showModal = function () {
    confirmations++;
    queueMicrotask(() => {
      nodes['skip-website-confirm'].checked = true;
      this.returnValue = approve ? 'delete' : 'cancel';
      this.listeners.get('close')();
    });
  };
  await vm.runInContext('loadAll()', context);
  const checkbox = nodes.pages.children[0].children[1].children[0].children[0];
  checkbox.checked = true;
  checkbox.listeners.get('change')();
  await vm.runInContext('deleteAnnotations()', context);
  assert.equal(confirmations, 0);
  assert.deepEqual(values.get('focusink:https://alpha.example/one').map(item => item.id), ['b']);
  assert.ok(values.has('focusink:https://beta.example/two'));
  await vm.runInContext('deleteAnnotations()', context);
  assert.equal(confirmations, 1);
  assert.ok(values.has('focusink:https://alpha.example/one'));
  assert.equal(values.has(settings.key), false);
  approve = true;
  await vm.runInContext('deleteAnnotations()', context);
  assert.equal(confirmations, 2);
  assert.equal(values.has('focusink:https://alpha.example/one'), false);
  assert.equal(values.get(settings.key).confirmWebsiteDelete, false);
  await vm.runInContext('deleteAnnotations()', context);
  assert.equal(confirmations, 2);
  assert.equal(values.has('focusink:https://beta.example/two'), false);
  assert.deepEqual(sent, ['deleteMany', 'deleteWebsite', 'deleteWebsite']);
});
