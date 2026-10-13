(function (root) {
  function pageUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      url.hash = '';
      return url.href;
    } catch {
      return null;
    }
  }

  function findQuote(text, record) {
    if (!record?.quote || typeof text !== 'string') return -1;
    const start = Number.isInteger(record.start) ? record.start : 0;
    let best = -1;
    let bestScore = Infinity;
    for (let at = text.indexOf(record.quote); at !== -1; at = text.indexOf(record.quote, at + 1)) {
      const before = text.slice(Math.max(0, at - (record.prefix?.length || 0)), at);
      const after = text.slice(at + record.quote.length, at + record.quote.length + (record.suffix?.length || 0));
      const score = Math.abs(at - start)
        - (record.prefix && before === record.prefix ? text.length + 1 : 0)
        - (record.suffix && after === record.suffix ? text.length + 1 : 0);
      if (score < bestScore) { best = at; bestScore = score; }
    }
    return best;
  }

  function boxRect(bounds, box) {
    const left = bounds.left + box.x * bounds.width;
    const top = bounds.top + box.y * bounds.height;
    const width = box.w * bounds.width;
    const height = box.h * bounds.height;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  function overlaps(start, end, savedStart, savedEnd) {
    return start < savedEnd && end > savedStart;
  }

  const api = { pageUrl, findQuote, boxRect, overlaps };
  root.FocusInkAnchor = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
