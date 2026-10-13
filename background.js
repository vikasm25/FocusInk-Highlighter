importScripts('anchor.js', 'settings.js');

const colors = new Set(FocusInkSettings.colors);
let pending = Promise.resolve();

async function handle(message) {
  const url = FocusInkAnchor.pageUrl(message?.url);
  if (!url) throw new Error('This page cannot be highlighted.');
  if (message.type === 'deleteWebsite') {
    const host = new URL(url).hostname;
    const stored = await chrome.storage.local.get(null);
    const keys = Object.keys(stored).filter(key => {
      if (!key.startsWith('focusink:http')) return false;
      const page = key.slice('focusink:'.length);
      return FocusInkAnchor.pageUrl(page) === page && new URL(page).hostname === host;
    });
    if (keys.length) await chrome.storage.local.remove(keys);
    return keys.length;
  }
  const key = `focusink:${url}`;
  const stored = await chrome.storage.local.get(key);
  const records = Array.isArray(stored[key])
    ? stored[key].filter(item => item && typeof item.id === 'string' && typeof item.quote === 'string' &&
      (item.kind !== 'box' || (item.box && typeof item.box.selector === 'string')))
    : [];

  if (message.type === 'list') return records;

  if (message.type === 'add') {
    const item = message.item;
    const isBox = item?.kind === 'box';
    const box = item?.box;
    const validBox = isBox && box && typeof box.selector === 'string' && box.selector.length <= 1000 &&
      box.selector.length > 0 && typeof box.tag === 'string' && /^[a-z][a-z0-9-]*$/i.test(box.tag) &&
      ['x', 'y', 'w', 'h'].every(key => typeof box[key] === 'number' && Number.isFinite(box[key]) &&
        Math.abs(box[key]) <= 10) && box.w > 0 && box.h > 0;
    if (!item || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 3000 ||
        (!isBox && (!Number.isInteger(item.start) || item.start < 0)) ||
        (isBox && !validBox) || !colors.has(item.color) ||
        typeof item.note !== 'string' || item.note.length > 2000) {
      throw new Error('Choose valid content and keep notes under 2,000 characters.');
    }
    if (records.length >= 500) throw new Error('This page has reached its highlight limit.');
    const saved = {
      id: crypto.randomUUID(), kind: isBox ? 'box' : 'text', quote: item.quote,
      start: isBox ? 0 : item.start,
      prefix: String(item.prefix || '').slice(-80), suffix: String(item.suffix || '').slice(0, 80),
      box: isBox ? { selector: box.selector, tag: box.tag, text: String(box.text || '').slice(0, 160),
        x: box.x, y: box.y, w: box.w, h: box.h } : undefined,
      color: item.color, note: item.note,
      createdAt: Date.now()
    };
    records.unshift(saved);
    await chrome.storage.local.set({ [key]: records });
    return saved;
  }

  if (message.type === 'deleteMany') {
    if (!Array.isArray(message.ids) || !message.ids.length || message.ids.length > 500 ||
        message.ids.some(id => typeof id !== 'string' || !id)) throw new Error('Choose valid annotations to delete.');
    const ids = new Set(message.ids);
    const remaining = records.filter(item => !ids.has(item.id));
    await chrome.storage.local.set({ [key]: remaining });
    return remaining;
  }

  const index = records.findIndex(item => item.id === message.id);
  if (index < 0) throw new Error('Highlight not found. Refresh and try again.');
  if (message.type === 'update') {
    if (typeof message.note !== 'string' || message.note.length > 2000 || !colors.has(message.color)) {
      throw new Error('Choose a color and keep the note under 2,000 characters.');
    }
    records[index] = { ...records[index], color: message.color, note: message.note };
  } else if (message.type === 'delete') {
    records.splice(index, 1);
  } else {
    throw new Error('Unknown action.');
  }
  await chrome.storage.local.set({ [key]: records });
  return records;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const result = pending.then(() => handle(message));
  pending = result.catch(() => {});
  result.then(data => respond({ ok: true, data }),
    error => respond({ ok: false, error: error.message || 'Something went wrong.' }));
  return true;
});
