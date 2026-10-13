(() => {
  if (!document.body || !globalThis.CSS?.highlights || typeof Highlight === 'undefined') return;

  const colors = FocusInkSettings.colors;
  let settings = FocusInkSettings.normalize();
  const ink = {
    yellow: '#f4bf21', mint: '#61c99b', sky: '#65ade8', rose: '#e980a0',
    lavender: '#a98be8', peach: '#eea66d', teal: '#55bdb8', slate: '#8fa5c4'
  };
  const host = document.createElement('div');
  host.setAttribute('data-focusink-host', '');
  host.hidden = true;
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    :host { position: fixed !important; z-index: 2147483647 !important; font: 13px/1.4 Inter, ui-sans-serif, system-ui, sans-serif; color: #1d3557; }
    :host([hidden]) { display: none !important; }
    * { box-sizing: border-box; }
    .panel, .toast { width: 332px; border: 1px solid #dce7f5; border-radius: 14px; background: #fff; box-shadow: 0 16px 45px rgba(24,54,95,.22); }
    .panel { padding: 12px; }
    .top, .palette { display: flex; align-items: center; gap: 8px; }
    .brand { margin-right: auto; font-size: 11px; font-weight: 800; letter-spacing: .04em; }
    .palette { margin-top: 11px; gap: 10px; flex-wrap: wrap; }
    .dot { width: 26px; height: 26px; padding: 0; border: 2px solid #fff; border-radius: 50%; outline: 1px solid #d8dce8; cursor: pointer; }
    .dot[aria-pressed="true"] { outline: 2px solid #2e6fc5; }
    .yellow { background: #ffe17a; } .mint { background: #a7edcd; } .sky { background: #a9d9ff; } .rose { background: #ffc0cf; }
    .lavender { background: #d8c6ff; } .peach { background: #ffd1a9; } .teal { background: #a5ece8; } .slate { background: #c5d2e6; }
    .note-toggle, .box-toggle, .save, .cancel, .remove { border: 0; border-radius: 8px; font: inherit; cursor: pointer; }
    .note-toggle, .box-toggle { padding: 7px 9px; color: #2e6fc5; background: #e8f1ff; font-size: 11px; font-weight: 700; }
    .box-toggle { background: #eaf2ff; color: #3d65a1; }
    .remove { width: 100%; margin-top: 11px; padding: 8px 10px; color: #a93e58; background: #fff0f2; font-size: 11px; font-weight: 750; text-align: left; }
    .editor { margin-top: 11px; }
    textarea { width: 100%; min-height: 82px; resize: vertical; padding: 10px; border: 1px solid #dce7f5; border-radius: 9px; font: inherit; color: #1d3557; outline-color: #2e6fc5; }
    .actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 8px; }
    .save, .cancel { padding: 7px 12px; font-size: 11px; font-weight: 750; }
    .save { color: #fff; background: #2e6fc5; } .cancel { color: #686d7e; background: #f0f1f5; }
    .feedback { margin: 8px 0 0; color: #bb3851; font-size: 11px; }
    .toast { padding: 11px 14px; overflow-wrap: anywhere; color: #fff; background: #1b467e; border-color: #1b467e; }
    .edit-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 800; }
    .edit-head button { border: 0; background: transparent; color: #71768a; cursor: pointer; font-size: 19px; }
    .edit-quote { max-height: 48px; margin: 9px 0 11px; overflow: hidden; color: #686e82; font-size: 11px; line-height: 1.4; }
    .edit-panel label { display: block; margin: 8px 0 5px; color: #61677c; font-size: 11px; font-weight: 700; }
    .edit-panel select { width: 100%; height: 34px; padding: 0 8px; border: 1px solid #dce7f5; border-radius: 8px; background: #fff; color: #1d3557; }
    .edit-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 10px; }
    .edit-buttons button { padding: 8px 7px; border: 0; border-radius: 8px; background: #edf3fc; color: #426a9e; cursor: pointer; font: 700 11px/1.2 system-ui,sans-serif; }
    .edit-buttons .primary { color: #fff; background: #2e6fc5; }
    .edit-buttons .danger { color: #ad4258; background: #fff0f2; }
    .edit-tip { display: block; margin-top: 9px; color: #758899; font-size: 10px; }
    [hidden] { display: none !important; }
  `);
  shadow.adoptedStyleSheets = [sheet];

  const panel = document.createElement('div');
  panel.className = 'panel';
  const top = document.createElement('div');
  top.className = 'top';
  const brand = document.createElement('span');
  brand.className = 'brand';
  brand.textContent = 'FOCUSINK';
  top.append(brand);
  const swatches = new Map();
  let selectedColor = settings.defaultColor;
  let editing = false;
  const noteToggle = document.createElement('button');
  noteToggle.type = 'button';
  noteToggle.className = 'note-toggle';
  noteToggle.textContent = '+ Note';
  const boxToggle = document.createElement('button');
  boxToggle.type = 'button';
  boxToggle.className = 'box-toggle';
  boxToggle.textContent = '▢ Box';
  boxToggle.title = 'Draw a box around page content';
  top.append(noteToggle, boxToggle);
  panel.append(top);
  const palette = document.createElement('div');
  palette.className = 'palette';
  for (const color of colors) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dot ${color}`;
    button.title = `Highlight ${color}`;
    button.setAttribute('aria-label', `Highlight ${color}`);
    button.setAttribute('aria-pressed', String(color === selectedColor));
    button.addEventListener('click', () => {
      selectedColor = color;
      for (const [name, dot] of swatches) dot.setAttribute('aria-pressed', String(name === color));
      if (!editing) saveHighlight(color, '');
    });
    swatches.set(color, button);
    palette.append(button);
  }
  panel.append(palette);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.hidden = true;
  panel.append(remove);
  const editor = document.createElement('div');
  editor.className = 'editor';
  editor.hidden = true;
  const textarea = document.createElement('textarea');
  textarea.maxLength = 2000;
  textarea.placeholder = 'Add a thought about this highlight…';
  textarea.setAttribute('aria-label', 'Annotation note');
  const actions = document.createElement('div');
  actions.className = 'actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'cancel';
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'save';
  save.textContent = 'Save highlight';
  actions.append(cancel, save);
  editor.append(textarea, actions);
  panel.append(editor);
  const feedback = document.createElement('p');
  feedback.className = 'feedback';
  feedback.hidden = true;
  panel.append(feedback);
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.hidden = true;
  const editPanel = document.createElement('div');
  editPanel.className = 'panel edit-panel';
  editPanel.hidden = true;
  const editHead = document.createElement('div');
  editHead.className = 'edit-head';
  const editTitle = document.createElement('span');
  editTitle.textContent = 'EDIT ANNOTATION';
  const editClose = document.createElement('button');
  editClose.type = 'button';
  editClose.textContent = '×';
  editClose.setAttribute('aria-label', 'Close editor');
  editHead.append(editTitle, editClose);
  const editQuote = document.createElement('p');
  editQuote.className = 'edit-quote';
  const editNoteLabel = document.createElement('label');
  editNoteLabel.textContent = 'Note';
  const editNote = document.createElement('textarea');
  editNote.maxLength = 2000;
  editNote.placeholder = 'Add a note…';
  editNoteLabel.append(editNote);
  const editColorLabel = document.createElement('label');
  editColorLabel.textContent = 'Color';
  const editColor = document.createElement('select');
  editColor.setAttribute('aria-label', 'Annotation color');
  for (const name of colors) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name[0].toUpperCase() + name.slice(1);
    editColor.append(option);
  }
  editColorLabel.append(editColor);
  const editButtons = document.createElement('div');
  editButtons.className = 'edit-buttons';
  const editSave = document.createElement('button');
  editSave.type = 'button';
  editSave.className = 'primary';
  editSave.textContent = 'Save changes';
  const editDeleteNote = document.createElement('button');
  editDeleteNote.type = 'button';
  editDeleteNote.textContent = 'Remove note';
  const editDeleteBoth = document.createElement('button');
  editDeleteBoth.type = 'button';
  editDeleteBoth.className = 'danger';
  editDeleteBoth.textContent = 'Delete';
  editButtons.append(editSave, editDeleteNote, editDeleteBoth);
  const editFeedback = document.createElement('p');
  editFeedback.className = 'feedback';
  editFeedback.hidden = true;
  const editTip = document.createElement('small');
  editTip.className = 'edit-tip';
  editTip.textContent = 'Tip: press Delete to remove this annotation';
  editPanel.append(editHead, editQuote, editNoteLabel, editColorLabel, editButtons, editTip, editFeedback);
  shadow.append(panel, editPanel, toast);

  const overlayHost = document.createElement('div');
  overlayHost.setAttribute('data-focusink-overlay', '');
  document.documentElement.append(overlayHost);
  const overlay = overlayHost.attachShadow({ mode: 'closed' });
  const overlaySheet = new CSSStyleSheet();
  overlaySheet.replaceSync(`
    :host { position: fixed !important; inset: 0 !important; z-index: 2147483646 !important; pointer-events: none !important; font: 12px/1.4 Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    .box { position: absolute; border: 2px solid var(--ink); border-radius: 2px; box-shadow: 0 0 0 1px rgba(255,255,255,.35); pointer-events: none; }
    .box.flash { box-shadow: 0 0 0 5px rgba(255,255,255,.8), 0 0 0 8px var(--ink); }
    .hover-note { position: absolute; max-width: 280px; max-height: 220px; padding: 10px 12px; overflow: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; background: #1b467e; box-shadow: 0 10px 28px rgba(0,0,0,.25); color: #fff; overflow-wrap: anywhere; white-space: pre-wrap; pointer-events: none; }
    .dock { position: absolute; right: 18px; bottom: 18px; display: flex; align-items: center; gap: 7px; padding: 7px; border: 1px solid #dce7f5; border-radius: 13px; background: #fff; box-shadow: 0 8px 25px rgba(24,54,95,.2); pointer-events: auto; }
    .dock button { padding: 8px 11px; border: 0; border-radius: 8px; background: #2e6fc5; color: #fff; cursor: pointer; font: 700 11px/1.2 system-ui,sans-serif; }
    .dock button[aria-pressed="true"] { background: #1b467e; }
    .dock select { width: 83px; height: 30px; border: 1px solid #dce7f5; border-radius: 7px; background: #fff; color: #294e7e; font: 11px system-ui,sans-serif; }
    .draw { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; background: rgba(48,111,192,.035); }
    .hint { position: fixed; top: 18px; left: 50%; transform: translateX(-50%); padding: 9px 14px; border-radius: 10px; background: #1b467e; box-shadow: 0 7px 20px rgba(0,0,0,.2); color: #fff; white-space: nowrap; }
    .preview { position: absolute; border: 2px solid var(--ink); background: rgba(255,225,122,.12); }
    [hidden] { display: none !important; }
  `);
  overlay.adoptedStyleSheets = [overlaySheet];
  const marks = document.createElement('div');
  const draw = document.createElement('div');
  draw.className = 'draw';
  draw.hidden = true;
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Drag around content · Esc to cancel';
  const preview = document.createElement('div');
  preview.className = 'preview';
  preview.hidden = true;
  draw.append(hint, preview);
  const hoverNote = document.createElement('div');
  hoverNote.className = 'hover-note';
  hoverNote.hidden = true;
  const dock = document.createElement('div');
  dock.className = 'dock';
  const dockButton = document.createElement('button');
  dockButton.type = 'button';
  dockButton.textContent = '▢ Draw boxes';
  dockButton.setAttribute('aria-pressed', 'false');
  const dockColor = document.createElement('select');
  dockColor.setAttribute('aria-label', 'Box color');
  dock.append(dockButton, dockColor);
  overlay.append(marks, hoverNote, draw, dock);

  let pageUrl = FocusInkAnchor.pageUrl(location.href);
  let records = [];
  let pendingSelection = null;
  let selectedIds = [];
  let renderTimer;
  let toastTimer;
  let positionFrame;
  let boxMode = false;
  let boxColor = settings.defaultColor;
  let dragStart = null;
  let activeEditId = null;
  let hitRegions = [];
  const ranges = new Map();
  const positions = new Map();
  const boxes = new Map();
  let markEntries = [];

  async function send(type, payload = {}) {
    const result = await chrome.runtime.sendMessage({ type, url: pageUrl, ...payload });
    if (!result?.ok) throw new Error(result?.error || 'FocusInk did not respond.');
    return result.data;
  }

  function collectText() {
    const nodes = [];
    const parts = [];
    let length = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        return node.nodeValue && parent && !parent.closest(
          'script,style,noscript,textarea,input,select,option,button,svg,[hidden],[aria-hidden="true"],[contenteditable]'
        ) && !parent.isContentEditable ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      nodes.push({ node, start: length, end: length + node.nodeValue.length });
      parts.push(node.nodeValue);
      length += node.nodeValue.length;
    }
    return { nodes, text: parts.join('') };
  }

  function rangeAt(map, start, end) {
    const first = map.nodes.find(entry => start >= entry.start && start < entry.end);
    const last = map.nodes.find(entry => end > entry.start && end <= entry.end);
    if (!first || !last) return null;
    const range = document.createRange();
    range.setStart(first.node, start - first.start);
    range.setEnd(last.node, end - last.start);
    return range;
  }

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function boxElement(box) {
    let element = null;
    try { element = document.querySelector(box.selector); } catch {}
    if ((!element || (box.text && !normalizeText(element.textContent).includes(box.text))) &&
        box.text && /^[a-z][a-z0-9-]*$/i.test(box.tag || '')) {
      const matchingText = [...document.querySelectorAll(box.tag)]
        .find(node => normalizeText(node.textContent).includes(box.text));
      if (matchingText) element = matchingText;
    }
    return element;
  }

  function boxRect(element, box) {
    return FocusInkAnchor.boxRect(element.getBoundingClientRect(), box);
  }

  function updateMarks() {
    hitRegions = [];
    for (const entry of markEntries) {
      if (!entry.element.isConnected) {
        entry.node.hidden = true;
        continue;
      }
      const rect = boxRect(entry.element, entry.box);
      entry.node.style.left = `${rect.left}px`;
      entry.node.style.top = `${rect.top}px`;
      entry.node.style.width = `${rect.width}px`;
      entry.node.style.height = `${rect.height}px`;
      entry.node.hidden = !settings.showAnnotations || !rect.width || !rect.height ||
        rect.top > innerHeight || rect.bottom < 0 || rect.right < 0 || rect.left > innerWidth;
    }
    if (!settings.showAnnotations) return;
    for (const [id, range] of ranges) {
      for (const rect of range.getClientRects()) {
        if (rect.width && rect.height) hitRegions.push({ id, kind: 'text', rect });
      }
    }
    for (const [id, element] of boxes) {
      const record = records.find(item => item.id === id);
      if (element.isConnected && record?.box) hitRegions.push({ id, kind: 'box', rect: boxRect(element, record.box) });
    }
  }

  function recordAtPoint(x, y) {
    for (let i = hitRegions.length - 1; i >= 0; i--) {
      const { id, kind, rect } = hitRegions[i];
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const border = x <= rect.left + 6 || x >= rect.right - 6 ||
        y <= rect.top + 6 || y >= rect.bottom - 6;
      if (inside && (kind === 'text' || border)) return records.find(item => item.id === id);
    }
    return null;
  }

  function schedulePositions() {
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(() => { positionFrame = 0; updateMarks(); });
  }

  function renderHighlights() {
    if (FocusInkAnchor.pageUrl(location.href) !== pageUrl) {
      loadPage().catch(error => notify(error.message));
      return;
    }
    const map = collectText();
    ranges.clear();
    positions.clear();
    boxes.clear();
    markEntries = [];
    marks.replaceChildren();
    const groups = Object.fromEntries(colors.map(color => [color, new Highlight()]));
    for (const record of records) {
      if (record.kind === 'box') {
        const element = boxElement(record.box);
        if (!element) continue;
        boxes.set(record.id, element);
        const outline = document.createElement('div');
        outline.className = 'box';
        outline.style.setProperty('--ink', ink[record.color] || ink.yellow);
        marks.append(outline);
        markEntries.push({ node: outline, element, box: record.box, id: record.id });
        continue;
      }
      const start = FocusInkAnchor.findQuote(map.text, record);
      if (start < 0) continue;
      const range = rangeAt(map, start, start + record.quote.length);
      if (!range) continue;
      ranges.set(record.id, range);
      positions.set(record.id, { start, end: start + record.quote.length });
      if (settings.showAnnotations) {
        groups[colors.includes(record.color) ? record.color : 'yellow'].add(range);
      }
    }
    for (const color of colors) CSS.highlights.set(`focusink-${color}`, groups[color]);
    updateMarks();
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderHighlights, 250);
  }

  async function loadPage() {
    const nextUrl = FocusInkAnchor.pageUrl(location.href);
    if (!nextUrl) return;
    if (nextUrl !== pageUrl) {
      pageUrl = nextUrl;
      records = [];
      hideToolbar();
      stopBoxMode();
      renderHighlights();
    }
    const requestedUrl = pageUrl;
    const loaded = await send('list');
    if (requestedUrl !== pageUrl) return;
    records = loaded;
    scheduleRender();
  }

  function selectionAnchor(range) {
    if (range.startContainer.nodeType !== Node.TEXT_NODE || range.endContainer.nodeType !== Node.TEXT_NODE) return null;
    const map = collectText();
    const first = map.nodes.find(entry => entry.node === range.startContainer);
    const last = map.nodes.find(entry => entry.node === range.endContainer);
    if (!first || !last) return null;
    const start = first.start + range.startOffset;
    const end = last.start + range.endOffset;
    const quote = map.text.slice(start, end);
    if (!quote.trim() || quote.length > 3000) return null;
    return { quote, start, prefix: map.text.slice(Math.max(0, start - 80), start),
      suffix: map.text.slice(end, end + 80) };
  }

  function hideToolbar() {
    host.hidden = true;
    pendingSelection = null;
    selectedIds = [];
    activeEditId = null;
    editing = false;
    editor.hidden = true;
    editPanel.hidden = true;
    feedback.hidden = true;
    textarea.value = '';
  }

  function notify(message) {
    clearTimeout(toastTimer);
    panel.hidden = true;
    editPanel.hidden = true;
    toast.hidden = false;
    toast.textContent = message;
    host.style.left = `${Math.max(12, innerWidth - 350)}px`;
    host.style.top = '18px';
    host.hidden = false;
    toastTimer = setTimeout(() => { host.hidden = true; toast.hidden = true; panel.hidden = false; }, 3200);
  }

  function placeToolbar(rect, height) {
    host.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 340))}px`;
    const below = rect.bottom + 10;
    const top = below + height < innerHeight ? below : rect.top - height - 10;
    host.style.top = `${Math.max(8, Math.min(top, innerHeight - height - 8))}px`;
    host.hidden = false;
  }

  function showEdit(record, rect) {
    if (!record) return;
    clearTimeout(toastTimer);
    pendingSelection = null;
    selectedIds = [];
    activeEditId = record.id;
    editQuote.textContent = record.kind === 'box' ? `Box · ${record.quote}` : record.quote;
    editNote.value = record.note || '';
    editColor.value = record.color;
    editDeleteNote.hidden = !record.note;
    editFeedback.hidden = true;
    panel.hidden = true;
    toast.hidden = true;
    editPanel.hidden = false;
    placeToolbar(rect, 315);
  }

  async function applyEdit(action) {
    const record = records.find(item => item.id === activeEditId);
    if (!record) return;
    for (const button of [editSave, editDeleteNote, editDeleteBoth]) button.disabled = true;
    editFeedback.hidden = true;
    try {
      if (action === 'delete') await send('delete', { id: record.id });
      else await send('update', { id: record.id, color: editColor.value,
        note: action === 'note' ? '' : editNote.value.trim() });
      hideToolbar();
      notify(action === 'save' ? 'Annotation updated' :
        action === 'delete' ? 'Annotation deleted' : 'Note removed');
      await loadPage();
    } catch (error) {
      editFeedback.textContent = error.message;
      editFeedback.hidden = false;
    } finally {
      for (const button of [editSave, editDeleteNote, editDeleteBoth]) button.disabled = false;
    }
  }

  function applySettings(value) {
    settings = FocusInkSettings.normalize(value);
    selectedColor = settings.defaultColor;
    if (!colors.slice(0, settings.paletteSize).includes(boxColor)) boxColor = settings.defaultColor;
    for (const [name, dot] of swatches) {
      dot.hidden = colors.indexOf(name) >= settings.paletteSize;
      dot.setAttribute('aria-pressed', String(name === selectedColor));
    }
    dockColor.replaceChildren();
    for (const name of colors.slice(0, settings.paletteSize)) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name[0].toUpperCase() + name.slice(1);
      dockColor.append(option);
    }
    dockColor.value = boxColor;
    dock.hidden = !settings.showDock && !boxMode;
    if (!settings.hoverNotes || !settings.showAnnotations) hoverNote.hidden = true;
    scheduleRender();
  }

  function showSelection() {
    if (boxMode) return;
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) { hideToolbar(); return; }
    const range = selection.getRangeAt(0);
    const anchor = selectionAnchor(range);
    if (!anchor) { hideToolbar(); return; }
    clearTimeout(toastTimer);
    pendingSelection = anchor;
    selectedIds = [...positions].filter(([, pos]) =>
      FocusInkAnchor.overlaps(anchor.start, anchor.start + anchor.quote.length, pos.start, pos.end))
      .map(([id]) => id);
    if (selectedIds.length === 1) {
      showEdit(records.find(item => item.id === selectedIds[0]), range.getBoundingClientRect());
      return;
    }
    activeEditId = null;
    editPanel.hidden = true;
    remove.hidden = selectedIds.length === 0;
    remove.textContent = `Delete ${selectedIds.length} annotations`;
    editing = false;
    editor.hidden = true;
    feedback.hidden = true;
    toast.hidden = true;
    panel.hidden = false;
    const rect = range.getBoundingClientRect();
    placeToolbar(rect, selectedIds.length ? 150 : 115);
  }

  async function saveHighlight(color, note) {
    if (!pendingSelection) return;
    save.disabled = true;
    feedback.hidden = true;
    try {
      await send('add', { item: { ...pendingSelection, kind: 'text', color, note } });
      getSelection()?.removeAllRanges();
      hideToolbar();
      notify(note ? 'Highlight and note saved' : 'Highlight saved');
      await loadPage();
    } catch (error) {
      feedback.textContent = error.message;
      feedback.hidden = false;
    } finally {
      save.disabled = false;
    }
  }

  function selectorFor(element) {
    const parts = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
      const tag = node.tagName.toLowerCase();
      const siblings = node.parentElement
        ? [...node.parentElement.children].filter(child => child.tagName === node.tagName) : [];
      const index = siblings.indexOf(node) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
      if (node === document.body) break;
    }
    return parts.join(' > ');
  }

  function targetFor(rect) {
    const toolbarWasHidden = host.hidden;
    host.hidden = true;
    marks.hidden = true;
    draw.hidden = true;
    dock.hidden = true;
    let target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    host.hidden = toolbarWasHidden;
    draw.hidden = false;
    marks.hidden = false;
    dock.hidden = !settings.showDock && !boxMode;
    while (target && target !== document.body) {
      const bounds = target.getBoundingClientRect();
      if (bounds.width >= rect.width * .6 && bounds.height >= rect.height * .6 &&
          getComputedStyle(target).display !== 'inline') break;
      target = target.parentElement;
    }
    return target instanceof Element && target !== document.documentElement ? target : null;
  }

  function stopBoxMode() {
    boxMode = false;
    dragStart = null;
    draw.hidden = true;
    preview.hidden = true;
    dockButton.textContent = '▢ Draw boxes';
    dockButton.setAttribute('aria-pressed', 'false');
    dock.hidden = !settings.showDock;
  }

  function startBoxMode(color) {
    boxColor = colors.slice(0, settings.paletteSize).includes(color) ? color : settings.defaultColor;
    dockColor.value = boxColor;
    boxMode = true;
    hideToolbar();
    getSelection()?.removeAllRanges();
    hoverNote.hidden = true;
    draw.hidden = false;
    dock.hidden = false;
    dockButton.textContent = '✓ Done drawing';
    dockButton.setAttribute('aria-pressed', 'true');
  }

  function drawRect(a, b) {
    return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
  }

  async function finishBox(rect) {
    if (rect.width < 12 || rect.height < 12) {
      preview.hidden = true;
      notify('Drag a larger box to save it');
      return;
    }
    const target = targetFor(rect);
    preview.hidden = true;
    if (!target) { notify('Could not find content inside the box'); return; }
    const bounds = target.getBoundingClientRect();
    if (!bounds.width || !bounds.height) { notify('Could not anchor this box'); return; }
    const box = { selector: selectorFor(target), tag: target.tagName.toLowerCase(),
      text: normalizeText(target.textContent).slice(0, 160),
      x: (rect.left - bounds.left) / bounds.width, y: (rect.top - bounds.top) / bounds.height,
      w: rect.width / bounds.width, h: rect.height / bounds.height };
    const quote = box.text || `Box around ${target.tagName.toLowerCase()}`;
    try {
      await send('add', { item: { kind: 'box', quote, color: boxColor, note: '', box } });
      notify('Box saved · draw another or choose Done');
      await loadPage();
    } catch (error) { notify(error.message); }
  }

  noteToggle.addEventListener('click', () => {
    editing = true;
    editor.hidden = false;
    textarea.focus();
  });
  boxToggle.addEventListener('click', () => startBoxMode(selectedColor));
  cancel.addEventListener('click', () => { editing = false; editor.hidden = true; textarea.value = ''; });
  save.addEventListener('click', () => saveHighlight(selectedColor, textarea.value.trim()));
  editClose.addEventListener('click', hideToolbar);
  editSave.addEventListener('click', () => applyEdit('save'));
  editDeleteNote.addEventListener('click', () => applyEdit('note'));
  editDeleteBoth.addEventListener('click', () => applyEdit('delete'));
  dockButton.addEventListener('click', () => {
    if (boxMode) stopBoxMode();
    else startBoxMode(dockColor.value);
  });
  dockColor.addEventListener('change', () => { boxColor = dockColor.value; });
  remove.addEventListener('click', async () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    remove.disabled = true;
    try {
      if (ids.length === 1) await send('delete', { id: ids[0] });
      else await send('deleteMany', { ids });
      getSelection()?.removeAllRanges();
      hideToolbar();
      notify(ids.length === 1 ? 'Annotation deleted' : `${ids.length} annotations deleted`);
      await loadPage();
    } catch (error) {
      feedback.textContent = error.message;
      feedback.hidden = false;
    } finally { remove.disabled = false; }
  });
  draw.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragStart = { x: event.clientX, y: event.clientY };
    draw.setPointerCapture(event.pointerId);
    preview.hidden = false;
    preview.style.setProperty('--ink', ink[boxColor]);
    preview.style.left = `${dragStart.x}px`;
    preview.style.top = `${dragStart.y}px`;
    preview.style.width = '0px';
    preview.style.height = '0px';
  });
  draw.addEventListener('pointermove', event => {
    if (!dragStart) return;
    const rect = drawRect(dragStart, { x: event.clientX, y: event.clientY });
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
  });
  draw.addEventListener('pointerup', event => {
    if (!dragStart) return;
    const rect = drawRect(dragStart, { x: event.clientX, y: event.clientY });
    dragStart = null;
    finishBox(rect);
  });
  draw.addEventListener('pointercancel', stopBoxMode);
  document.addEventListener('pointerup', event => {
    if (boxMode || host.contains(event.target)) return;
    if (!getSelection()?.isCollapsed) setTimeout(showSelection, 0);
  });
  document.addEventListener('pointermove', event => {
    if (boxMode || !settings.showAnnotations || !settings.hoverNotes ||
        host.contains(event.target) || overlayHost.contains(event.target)) {
      hoverNote.hidden = true;
      return;
    }
    const record = recordAtPoint(event.clientX, event.clientY);
    if (!record?.note) { hoverNote.hidden = true; return; }
    hoverNote.textContent = record.note;
    hoverNote.hidden = false;
    const width = Math.min(280, innerWidth - 24);
    hoverNote.style.left = `${Math.max(8, Math.min(event.clientX + 14, innerWidth - width - 8))}px`;
    hoverNote.style.top = `${Math.max(8, Math.min(event.clientY + 16, innerHeight - 100))}px`;
  }, true);
  document.addEventListener('click', event => {
    if (boxMode || host.contains(event.target) || overlayHost.contains(event.target) ||
        !getSelection()?.isCollapsed) return;
    const record = recordAtPoint(event.clientX, event.clientY);
    if (!record || event.target.closest?.('a,button,[role="button"]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hoverNote.hidden = true;
    showEdit(record, { left: event.clientX, top: event.clientY, bottom: event.clientY });
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Delete' || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
        boxMode || event.target === host || event.target === overlayHost ||
        event.target instanceof Element && event.target.closest(
          'input,textarea,select,[contenteditable],[role="textbox"]')) return;
    if (activeEditId && !editPanel.hidden && !editDeleteBoth.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyEdit('delete');
    } else if (selectedIds.length && !panel.hidden && !remove.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      remove.click();
    }
  }, true);
  document.addEventListener('keyup', event => {
    if (event.key === 'Escape') { if (boxMode) stopBoxMode(); else hideToolbar(); return; }
    if (boxMode || host.contains(event.target)) return;
    if (event.key.startsWith('Arrow') || event.key === 'Shift') setTimeout(showSelection, 0);
  });
  document.addEventListener('pointerdown', event => {
    if (!host.contains(event.target) && host.hidden === false) hideToolbar();
  });
  document.addEventListener('scroll', schedulePositions, true);
  document.addEventListener('scroll', () => { hoverNote.hidden = true; }, true);
  window.addEventListener('resize', schedulePositions);
  window.addEventListener('load', schedulePositions);
  document.fonts?.ready.then(schedulePositions);
  const observer = new MutationObserver(mutations => {
    if (mutations.every(mutation => mutation.target === host || mutation.target === overlayHost)) return;
    scheduleRender();
  });
  observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[`focusink:${pageUrl}`]) loadPage().catch(error => notify(error.message));
    if (area === 'local' && changes[FocusInkSettings.key]) applySettings(changes[FocusInkSettings.key].newValue);
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === 'startBox') {
      if (!colors.includes(message.color)) { respond({ ok: false, error: 'Choose a box color.' }); return; }
      startBoxMode(message.color);
      respond({ ok: true });
      return;
    }
    if (message?.type !== 'jump') return;
    if (!ranges.has(message.id) && !boxes.has(message.id)) renderHighlights();
    const record = records.find(item => item.id === message.id);
    const range = ranges.get(message.id);
    const element = boxes.get(message.id);
    if (!range && !element) {
      respond({ ok: false, error: 'The saved content is no longer on this page.' });
      return;
    }
    (element || range.startContainer.parentElement)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    notify(record?.note ? record.note.slice(0, 220) : 'Annotation located');
    if (range) {
      CSS.highlights.set('focusink-flash', new Highlight(range));
      setTimeout(() => CSS.highlights.delete('focusink-flash'), 1400);
    } else {
      const entry = markEntries.find(item => item.id === message.id);
      entry?.node.classList.add('flash');
      setTimeout(() => entry?.node.classList.remove('flash'), 1400);
    }
    respond({ ok: true });
  });
  setInterval(() => {
    if (FocusInkAnchor.pageUrl(location.href) !== pageUrl) loadPage().catch(error => notify(error.message));
  }, 1200);
  chrome.storage.local.get(FocusInkSettings.key)
    .then(saved => applySettings(saved[FocusInkSettings.key]))
    .catch(error => notify(error.message));
  loadPage().catch(error => notify(error.message));
})();
