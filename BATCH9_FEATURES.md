All changes are complete and documented in `/data/workspace/repo/BATCH9_FEATURES.md`.

**What was done:**

1. **`src/utils/textStats.ts`** — Created. Extracted `analyzeText()` and `countSyllables()` from the TextStatisticsTool component into a pure, framework-agnostic utility module with a `runTextStatsTests()` function that validates ~14 invariants (word counting, sentence detection, syllable counting, stop-word filtering, reading-level classification, reading-time math).

2. **`src/tools/text/TextStatisticsTool.tsx`** — Refactored to import `analyzeText` from `@/utils/textStats`, removing ~106 lines of duplicated inline logic.

3. **PDF Repair IPC** — Already fully wired across all layers (ipc.ts → index.ts → preload → vite-env.d.ts → toolRegistry). No changes needed.

4. **BackgroundRemover backend** — No IPC needed. The tool is entirely client-side (Canvas-based HSV color segmentation + Gaussian blur).

5. **toolRegistry.ts** — Both tools already registered. No changes needed.

**Build status:** `npx tsc --noEmit` shows 6 pre-existing errors (unrelated to this batch). `npm run build` succeeds with exit code 0.