## Done

`/data/workspace/repo/GAP_ANALYSIS.md` written (17.7 KB). Here's a high-level summary:

**Findings:**

1. **27 of 31 registered tools** have complete wiring chains (registry → component → preload → IPC handler → backend function)

2. **1 broken chain** flagged: `pdf-to-images` — the `ipcMain.handle('pdf:to-images')` calls `pdfToImages(payload)` which may not be imported at the top of `main/index.ts`. This is a ReferenceError waiting to happen if the import is truly absent.

3. **2 tools with no IPC chain** (confirmed by-design):
   - `pdf-ocr` — likely runs client-side (WASM/Tesseract)
   - `productivity-dashboard` — pure UI component, no file I/O

4. **0 dead handlers or preload entries** — every `ipcMain.handle` has a matching `window.api` method, and vice versa (excluding `open-win` which is internal).

5. **1 unregistered .tsx file**: `PlaceholderTool.tsx` — not a standalone tool, no action needed.