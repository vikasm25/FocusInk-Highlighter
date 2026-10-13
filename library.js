const $ = id => document.getElementById(id);
const colors = FocusInkSettings.colors;
let rows = [];
let selectedHost = null;
const selected = new Set();
let bulkBusy = false;
let settings = FocusInkSettings.normalize();
let statusTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function status(message, error = false, target = 'library-status') {
  clearTimeout(statusTimer);
  const node = $(target);
  node.textContent = message;
  node.classList.toggle('error', error);
  node.hidden = false;
  statusTimer = setTimeout(() => { node.hidden = true; }, 4000);
}

async function send(url, type, payload = {}) {
  const result = await chrome.runtime.sendMessage({ type, url, ...payload });
  if (!result?.ok) throw new Error(result?.error || 'FocusInk did not respond.');
  return result.data;
}

const rowKey = row => JSON.stringify([row.url, row.item.id]);

function updateDeleteAction() {
  const button = $('delete-annotations');
  const count = rows.filter(row => row.host === selectedHost && selected.has(rowKey(row))).length;
  const total = rows.filter(row => row.host === selectedHost).length;
  button.textContent = 'Delete';
  button.title = count ? `Delete ${count} checked annotation${count === 1 ? '' : 's'}` :
    `Delete all ${total} annotations for ${selectedHost || 'this website'}`;
  button.disabled = bulkBusy || total === 0;
}

async function loadAll() {
  const stored = await chrome.storage.local.get(null);
  rows = [];
  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith('focusink:') || !Array.isArray(value)) continue;
    const url = key.slice('focusink:'.length);
    if (FocusInkAnchor.pageUrl(url) !== url) continue;
    const host = new URL(url).hostname;
    for (const item of value) {
      if (item && typeof item.id === 'string' && typeof item.quote === 'string') {
        rows.push({ url, host, item });
      }
    }
  }
  rows.sort((a, b) => (b.item.createdAt || 0) - (a.item.createdAt || 0));
  const present = new Set(rows.map(rowKey));
  for (const key of selected) if (!present.has(key)) selected.delete(key);
  render();
}

async function changeRow(row, type, payload, success, button) {
  button.disabled = true;
  try {
    await send(row.url, type, { id: row.item.id, ...payload });
    await loadAll();
    status(success);
  } catch (error) {
    status(error.message, true);
    button.disabled = false;
  }
}

function annotationCard(row) {
  const { item, url } = row;
  const wrapper = element('div', 'annotation-row');
  const card = element('details', 'annotation');
  const summary = element('summary');
  const checkbox = element('input', 'annotation-select');
  checkbox.type = 'checkbox';
  checkbox.checked = selected.has(rowKey(row));
  checkbox.setAttribute('aria-label', `Select annotation: ${item.quote.slice(0, 80)}`);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selected.add(rowKey(row));
    else selected.delete(rowKey(row));
    updateDeleteAction();
  });
  const swatch = element('span', `swatch ${colors.includes(item.color) ? item.color : 'yellow'}`);
  const copy = element('div', 'annotation-copy');
  const quote = item.kind === 'box' ? `▢ ${item.quote}` :
    `“${item.quote}”`;
  copy.append(element('span', 'annotation-quote', quote));
  const date = Number.isFinite(item.createdAt) ? new Date(item.createdAt).toLocaleDateString() : 'Saved';
  copy.append(element('small', 'annotation-meta', `${date}${item.note ? ' · Note attached' : ''}`));
  summary.append(swatch, copy, element('span', 'chevron', '›'));
  card.append(summary);
  wrapper.append(checkbox, card);

  const editor = element('div', 'editor');
  const noteLabel = element('label', '', 'Note');
  const note = element('textarea');
  note.maxLength = 2000;
  note.value = item.note || '';
  note.placeholder = 'Add a note or reminder…';
  noteLabel.append(note);
  const colorLabel = element('label', '', 'Color');
  const color = element('select');
  for (const name of colors) {
    const option = element('option', '', name[0].toUpperCase() + name.slice(1));
    option.value = name;
    color.append(option);
  }
  color.value = item.color;
  colorLabel.append(color);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'primary', 'Save changes');
  save.type = 'button';
  save.addEventListener('click', () => changeRow(row, 'update', {
    note: note.value.trim(), color: color.value
  }, 'Annotation updated', save));
  const open = element('a', '', 'Open website ↗');
  open.href = url;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  actions.append(save, open);
  if (item.note) {
    const removeNote = element('button', '', 'Remove note');
    removeNote.type = 'button';
    removeNote.addEventListener('click', () => changeRow(row, 'update', {
      note: '', color: item.color
    }, 'Note removed', removeNote));
    actions.append(removeNote);
  }
  const removeBoth = element('button', 'danger', 'Delete');
  removeBoth.type = 'button';
  removeBoth.addEventListener('click', () =>
    changeRow(row, 'delete', {}, 'Annotation deleted', removeBoth));
  actions.append(removeBoth);
  editor.append(noteLabel, colorLabel, actions);
  card.append(editor);
  return wrapper;
}

function render() {
  $('site-count').textContent = String(new Set(rows.map(row => row.host)).size);
  $('page-count').textContent = String(new Set(rows.map(row => row.url)).size);
  $('annotation-count').textContent = String(rows.length);
  const query = $('library-search').value.trim().toLocaleLowerCase();
  const filter = $('library-filter').value;
  const visible = rows.filter(({ url, host, item }) => {
    const matchesText = `${host} ${url} ${item.quote} ${item.note || ''}`
      .toLocaleLowerCase().includes(query);
    const matchesType = filter === 'all' || filter === 'boxes' && item.kind === 'box' ||
      filter === 'notes' && Boolean(item.note) ||
      filter === 'highlights' && item.kind !== 'box';
    return matchesText && matchesType;
  });

  const sites = new Map();
  for (const row of visible) {
    if (!sites.has(row.host)) sites.set(row.host, new Map());
    const pages = sites.get(row.host);
    if (!pages.has(row.url)) pages.set(row.url, []);
    pages.get(row.url).push(row);
  }
  if (!sites.has(selectedHost)) selectedHost = sites.keys().next().value || null;
  const visibleKeys = new Set(visible.map(rowKey));
  for (const key of selected) if (!visibleKeys.has(key)) selected.delete(key);
  updateDeleteAction();

  $('website-list-count').textContent = String(sites.size);
  const websites = $('websites');
  websites.replaceChildren();
  for (const [host, pages] of sites) {
    const site = element('button', 'website');
    site.type = 'button';
    site.setAttribute('aria-current', String(host === selectedHost));
    site.append(element('span', 'site-icon', host[0]?.toUpperCase() || 'W'),
      element('span', 'site-title', host),
      element('span', 'count-pill',
        String([...pages.values()].reduce((total, items) => total + items.length, 0))));
    site.addEventListener('click', () => { selected.clear(); selectedHost = host; render(); });
    websites.append(site);
  }

  const pagesContainer = $('pages');
  pagesContainer.replaceChildren();
  const chosenPages = sites.get(selectedHost);
  const selectedCount = chosenPages
    ? [...chosenPages.values()].reduce((total, items) => total + items.length, 0) : 0;
  $('selected-site-title').textContent = selectedHost || (rows.length ? 'No matching website' : 'Your library');
  $('selected-site-summary').textContent = chosenPages
    ? `${chosenPages.size} page${chosenPages.size === 1 ? '' : 's'} · ${selectedCount} annotation${selectedCount === 1 ? '' : 's'}`
    : 'Select a website to view its annotations.';
  $('library-empty').hidden = Boolean(chosenPages);
  $('library-empty').querySelector('h2').textContent = rows.length ? 'Nothing matches' : 'Nothing here yet';
  $('library-empty').querySelector('p').textContent = rows.length
    ? 'Try another search or filter.' : 'Save a highlight or box on a website and it will appear here.';
  if (!chosenPages) return;

  for (const [url, items] of chosenPages) {
    const page = element('section', 'page');
    const path = new URL(url);
    const pageTitle = path.pathname === '/' && !path.search ? 'Home page' : path.pathname + path.search;
    const pageSummary = element('div', 'page-header');
    pageSummary.append(element('span', 'page-name', pageTitle),
      element('span', 'page-count', `${items.length} saved`));
    page.append(pageSummary);
    const annotations = element('div', 'annotations');
    for (const row of items) annotations.append(annotationCard(row));
    page.append(annotations);
    pagesContainer.append(page);
  }
}

async function confirmWebsiteDeletion(host, count) {
  const saved = await chrome.storage.local.get(FocusInkSettings.key);
  settings = FocusInkSettings.normalize(saved[FocusInkSettings.key]);
  if (!settings.confirmWebsiteDelete) return { approved: true, skipNextTime: false };
  const dialog = $('site-delete-dialog');
  $('delete-dialog-copy').textContent =
    `This will delete all ${count} annotation${count === 1 ? '' : 's'} saved for ${host}, across every page.`;
  $('skip-website-confirm').checked = false;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve({
    approved: dialog.returnValue === 'delete',
    skipNextTime: $('skip-website-confirm').checked
  }), { once: true }));
}

async function deleteAnnotations() {
  if (!selectedHost || bulkBusy) return;
  const hostRows = rows.filter(row => row.host === selectedHost);
  if (!hostRows.length) return;
  const checked = hostRows.filter(row => selected.has(rowKey(row)));
  const host = selectedHost;
  try {
    if (!checked.length) {
      const choice = await confirmWebsiteDeletion(host, hostRows.length);
      if (!choice.approved) return;
      if (choice.skipNextTime) {
        settings = FocusInkSettings.normalize({ ...settings, confirmWebsiteDelete: false });
        await chrome.storage.local.set({ [FocusInkSettings.key]: settings });
        renderSettings();
      }
    }
    bulkBusy = true;
    updateDeleteAction();
    if (checked.length) {
      const byPage = new Map();
      for (const row of checked) {
        if (!byPage.has(row.url)) byPage.set(row.url, []);
        byPage.get(row.url).push(row.item.id);
      }
      for (const [url, ids] of byPage) await send(url, 'deleteMany', { ids });
    } else {
      await send(hostRows[0].url, 'deleteWebsite');
    }
    selected.clear();
    await loadAll();
    status(checked.length
      ? `${checked.length} annotation${checked.length === 1 ? '' : 's'} deleted`
      : `All annotations for ${host} deleted`);
  } catch (error) {
    status(error.message, true);
    await loadAll();
  } finally {
    bulkBusy = false;
    updateDeleteAction();
  }
}

function renderSettings() {
  $('palette-size').value = String(settings.paletteSize);
  $('default-color').replaceChildren();
  for (const name of colors.slice(0, settings.paletteSize)) {
    const option = element('option', '', name[0].toUpperCase() + name.slice(1));
    option.value = name;
    $('default-color').append(option);
  }
  $('default-color').value = settings.defaultColor;
  $('show-dock').checked = settings.showDock;
  $('show-annotations').checked = settings.showAnnotations;
  $('hover-notes').checked = settings.hoverNotes;
  $('confirm-website-delete').checked = settings.confirmWebsiteDelete;
}

async function saveSettings(patch) {
  const next = FocusInkSettings.normalize({ ...settings, ...patch });
  try {
    await chrome.storage.local.set({ [FocusInkSettings.key]: next });
    settings = next;
    renderSettings();
    status('Settings saved · open pages update automatically', false, 'settings-status');
  } catch (error) { status(error.message, true, 'settings-status'); }
}

function showView() {
  const view = location.hash === '#settings' ? 'settings' : 'library';
  $('library-view').hidden = view !== 'library';
  $('settings-view').hidden = view !== 'settings';
  $('nav-library').setAttribute('aria-current', view === 'library' ? 'page' : 'false');
  $('nav-settings').setAttribute('aria-current', view === 'settings' ? 'page' : 'false');
}

document.addEventListener('DOMContentLoaded', () => {
  $('nav-library').addEventListener('click', () => { location.hash = 'library'; });
  $('nav-settings').addEventListener('click', () => { location.hash = 'settings'; });
  window.addEventListener('hashchange', showView);
  showView();
  $('library-search').addEventListener('input', () => { selected.clear(); render(); });
  $('library-filter').addEventListener('change', () => { selected.clear(); render(); });
  $('delete-annotations').addEventListener('click', deleteAnnotations);
  $('palette-size').addEventListener('change', event =>
    saveSettings({ paletteSize: Number(event.target.value) }));
  $('default-color').addEventListener('change', event =>
    saveSettings({ defaultColor: event.target.value }));
  for (const [id, name] of [['show-dock', 'showDock'], ['show-annotations', 'showAnnotations'],
    ['hover-notes', 'hoverNotes'], ['confirm-website-delete', 'confirmWebsiteDelete']]) {
    $(id).addEventListener('change', event => saveSettings({ [name]: event.target.checked }));
  }
  chrome.storage.local.get(FocusInkSettings.key).then(saved => {
    settings = FocusInkSettings.normalize(saved[FocusInkSettings.key]);
    renderSettings();
  }).catch(error => status(error.message, true, 'settings-status'));
  loadAll().catch(error => status(error.message, true));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[FocusInkSettings.key]) {
      settings = FocusInkSettings.normalize(changes[FocusInkSettings.key].newValue);
      renderSettings();
    }
    if (Object.keys(changes).some(key => key.startsWith('focusink:https://') ||
      key.startsWith('focusink:http://'))) {
      loadAll().catch(error => status(error.message, true));
    }
  });
});
