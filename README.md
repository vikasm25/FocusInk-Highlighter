# FocusInk

A blue-themed Chrome extension for highlighting text, drawing boxes around webpage content, and attaching notes. Saved annotations return after a refresh or browser restart.

Created by **Vikas Kumar Meena**.

## Install

1. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
2. Choose **Load unpacked** and select the `FocusInk-Highlighter` folder.
3. Refresh websites that were already open before installing the extension.
4. Optionally pin FocusInk to the toolbar for quick access.

After changing the extension's files, click **Reload** on its card at `chrome://extensions`, then refresh open webpages.

## Highlight and annotate

- Select text on an `http` or `https` page, then choose a highlight color, **+ Note**, or **Box** from the on-page toolbar.
- To outline content, choose **Box** from the selection toolbar, the floating **Draw boxes** button, or the extension popup. Drag to draw a box. Choose **Done drawing** or press **Esc** when finished.
- Hover over a highlight or box border to read its note. Click it to edit the note or color. **Remove note** keeps the annotation; **Delete** removes the annotation and its note.
- Press the keyboard **Delete** key while an annotation is selected on the webpage to remove it. Individual deletions do not ask for confirmation.

## Library

Choose **Open your library** in the popup. The library shows website, page, and annotation totals beside the heading on wide screens and below it on narrow screens. Select a website in the left panel to see its pages and annotations on the right. Search annotations, filter by highlights, boxes, or notes, and open an entry to edit it or revisit its website.

Every annotation has a checkbox visible without opening its entry:

- **One or more checked:** **Delete** removes only those annotations immediately.
- **None checked:** **Delete** removes all annotations for the selected website, across its pages. A confirmation appears unless you previously disabled it.

The whole-website confirmation includes **Don't ask again**. You can turn the prompt back on under **Settings → Confirm whole-website deletion**.

## Settings

Choose a 4- or 8-color quick palette and a default color. You can also show or hide the floating Draw button, saved annotations on webpages, and note previews on hover. Settings apply to open pages automatically.

## Storage and limits

FocusInk stores highlights, boxes, notes, and settings locally in Chrome extension storage. Nothing is uploaded or synced. Page URLs are saved without their `#fragment`.

An annotation reappears when FocusInk can find its original text or box target. If a website changes its content or layout, or places content inside a closed shadow root or embedded frame, the annotation may not reappear on the page. Its saved entry remains in the library. Chrome internal pages and PDF viewer pages are not supported.

## Check

Run `node --test tests/*.test.js` to check storage, library deletion, and text matching. There is no build step or third-party runtime dependency.
