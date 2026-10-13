(function (root) {
  const key = 'focusink:settings';
  const colors = ['yellow', 'mint', 'sky', 'rose', 'lavender', 'peach', 'teal', 'slate'];
  const defaults = { paletteSize: 8, defaultColor: 'yellow', showDock: true,
    showAnnotations: true, hoverNotes: true, confirmWebsiteDelete: true };

  function normalize(value) {
    const settings = { ...defaults, ...value };
    settings.paletteSize = settings.paletteSize === 4 ? 4 : 8;
    if (!colors.slice(0, settings.paletteSize).includes(settings.defaultColor)) {
      settings.defaultColor = 'yellow';
    }
    for (const name of ['showDock', 'showAnnotations', 'hoverNotes', 'confirmWebsiteDelete']) {
      settings[name] = settings[name] !== false;
    }
    return settings;
  }

  const api = { key, colors, defaults, normalize };
  root.FocusInkSettings = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
