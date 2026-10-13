const $ = id => document.getElementById(id);
const colors = FocusInkSettings.colors;
let pageUrl;
let tabId;
let records = [];
let statusTimer;

async function send(type, payload = {}) {
  const result = await chrome.runtime.sendMessage({ type, url: pageUrl, ...payload });
  if (!result?.ok) throw new Error(result?.error || 'FocusInk did not respond.');
  return result.data;
}

function status(message, error = false) {
  clearTimeout(statusTimer);
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  $('status').hidden = false;
  statusTimer = setTimeout(() => { $('status').hidden = true; }, 4000);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setBoxPalette(settings) {
  $('box-color').replaceChildren();
  for (const name of colors.slice(0, settings.paletteSize)) {
    const option = element('option', '', name[0].toUpperCase() + name.slice(1));
    option.value = name;
    $('box-color').append(option);
  }
  $('box-color').value = settings.defaultColor;
}

function render() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const visible = records.filter(item => `${item.quote} ${item.note}`.toLocaleLowerCase().includes(query));
  $('count').textContent = String(records.length);
  const list = $('list');
  list.replaceChildren();
  $('empty').hidden = visible.length > 0;
  $('empty').querySelector('h3').textContent = records.length ? 'Nothing matches' : 'Nothing saved yet';
  $('empty').querySelector('p').textContent = records.length
    ? 'Try another word or phrase.' : 'Select text to highlight it, add a note, or choose Box to draw around content.';

  for (const item of visible) {
    const card = element('details', 'entry');
    const summary = element('summary');
    summary.append(element('span', `swatch ${colors.includes(item.color) ? item.color : 'yellow'}`));
    const copy = element('span', 'summary-copy');
    copy.append(element('span', 'quote', item.kind === 'box' ? `▢ ${item.quote.trim()}` :
      `“${item.quote.trim()}”`));
    copy.append(element('small', '', item.note ? 'Note attached · Click to edit' : 'Click to add a note'));
    summary.append(copy, element('span', 'chevron', '›'));
    card.append(summary);

    const editor = element('div', 'editor');
    const label = element('label', '', 'YOUR NOTE');
    const note = element('textarea');
    note.maxLength = 2000;
    note.value = item.note || '';
    note.placeholder = 'Add a thought or reminder…';
    label.append(note);
    const color = element('select');
    color.setAttribute('aria-label', 'Annotation color');
    for (const name of colors) {
      const option = element('option', '', name[0].toUpperCase() + name.slice(1));
      option.value = name;
      color.append(option);
    }
    color.value = item.color;
    const actions = element('div', 'actions');
    const save = element('button', 'save', 'Save');
    const jump = element('button', 'jump', item.kind === 'box' ? 'Go to box' : 'Go to text');
    const remove = element('button', 'delete', 'Delete');
    for (const button of [save, jump, remove]) button.type = 'button';
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        records = await send('update', { id: item.id, note: note.value.trim(), color: color.value });
        render();
        status('Annotation updated');
      } catch (error) { status(error.message, true); }
      finally { save.disabled = false; }
    });
    jump.addEventListener('click', async () => {
      try {
        const result = await chrome.tabs.sendMessage(tabId, { type: 'jump', id: item.id });
        if (!result?.ok) throw new Error(result?.error || 'Reload this page and try again.');
        window.close();
      } catch (error) {
        status(error.message.includes('Receiving end')
          ? 'Reload this page, then try Go to text again.' : error.message, true);
      }
    });
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        records = await send('delete', { id: item.id });
        render();
        status('Annotation deleted');
      } catch (error) { status(error.message, true); remove.disabled = false; }
    });
    actions.append(save, jump, remove);
    editor.append(label, color, actions);
    if (item.note) {
      const split = element('div', 'split-actions');
      const removeNote = element('button', '', 'Remove note');
      removeNote.type = 'button';
      removeNote.addEventListener('click', async () => {
        removeNote.disabled = true;
        try {
          records = await send('update', { id: item.id, note: '', color: item.color });
          render(); status('Note removed');
        } catch (error) { status(error.message, true); removeNote.disabled = false; }
      });
      split.append(removeNote);
      editor.append(split);
    }
    card.append(editor);
    list.append(card);
  }
}

async function load() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  pageUrl = FocusInkAnchor.pageUrl(tab?.url);
  if (!pageUrl) {
    $('page-name').textContent = 'Unavailable on this page';
    $('search').hidden = true;
    $('draw-box').disabled = true;
    $('box-color').disabled = true;
    $('empty').querySelector('h3').textContent = 'Open a website first';
    $('empty').querySelector('p').textContent = 'FocusInk works on regular http and https websites.';
    return;
  }
  $('page-name').textContent = new URL(pageUrl).hostname;
  records = await send('list');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  $('search').addEventListener('input', render);
  $('open-library').addEventListener('click', () => chrome.runtime.openOptionsPage());
  setBoxPalette(FocusInkSettings.normalize());
  chrome.storage.local.get(FocusInkSettings.key).then(saved => {
    setBoxPalette(FocusInkSettings.normalize(saved[FocusInkSettings.key]));
  }).catch(error => status(error.message, true));
  $('draw-box').addEventListener('click', async () => {
    $('draw-box').disabled = true;
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: 'startBox', color: $('box-color').value });
      if (!result?.ok) throw new Error(result?.error || 'Reload this page and try again.');
      window.close();
    } catch (error) {
      status(error.message.includes('Receiving end')
        ? 'Reload this page, then try Draw a box again.' : error.message, true);
      $('draw-box').disabled = false;
    }
  });
  load().catch(error => status(error.message, true));
});
