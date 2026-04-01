# DocFlow Pro Baseline Technical Assessment

**Date:** 2025-04-01
**Environment:** Node.js v22.22.2, npm 10.9.7, Linux (Debian-based)
**Project:** Electron + Vite + React TypeScript

---

## Executive Summary

**Status: FAIL**

The DocFlow Pro application does not compile and cannot run in its current state. Multiple TypeScript compilation errors block the build process, and critical dependencies are missing from the project. The development server fails during module resolution.

---

## Dependencies Installation

All packages listed in `package.json` are installed successfully (as evidenced by the presence of `node_modules` and `npm list` output). However, the source code imports three additional packages that are **not** declared as dependencies:

| Missing Package | Used By | Purpose |
|-----------------|---------|---------|
| `marked` | `src/tools/text/MarkdownTool.tsx` | Markdown to HTML conversion |
| `dompurify` | `src/tools/text/MarkdownTool.tsx` | HTML sanitization |
| `pdfjs-dist` | `src/tools/pdf/PdfOcrTool.tsx` | PDF rendering for OCR |

**Impact:** Vite fails to resolve these modules during build, causing immediate build failure.

---

## TypeScript Compilation Errors

Running `npx tsc --noEmit` (or `npm run build` which runs `tsc` first) produces **17 errors across 8 files** under `src/` and `electron/`.

### Error Summary

#### 1. Missing Module Declarations
- `src/tools/text/MarkdownTool.tsx:2` - `Cannot find module 'marked'`
- `src/tools/pdf/PdfOcrTool.tsx:2` - `Cannot find module 'pdfjs-dist'`

#### 2. BaseToolLayout Prop Mismatches (Widespread)
The layout component `BaseToolLayout` has a narrow prop type that does not accept props that several tools pass. The component also does not render `children`.

**BaseToolLayoutProps currently includes:**
`title`, `description`, `accept`, `instructions`, `maxFiles`, `reorderable`, `onProcess`, `options`

**Props incorrectly used by tools:**
- `children` (React node) - used to embed custom UI elements inside the layout
- `loading` (boolean) - used to show loading state
- `result` (React node) - used to display results

**Affected files:**
- `src/tools/pdf/PdfOcrTool.tsx:95,131` - uses `children`, `loading`, `result`
- `src/tools/pdf/RepairPdfTool.tsx:33` - uses `loading`
- `src/tools/text/MarkdownTool.tsx:117` - uses `children`
- `src/tools/image/BackgroundRemoverTool.tsx:70` - uses `children`

**Root Cause:** Either the `BaseToolLayout` component should be enhanced to support these common props, or all tool components must be refactored to use the intended pattern (i.e., `options` for static configuration and `context.setResult()` for dynamic results). The presence of `loading` also suggests that the component's internal `status` state is not being used correctly by some tools.

#### 3. Duplicate Variable Declaration
- `src/tools/file/DuplicateFinderTool.tsx:74` and `169` - `Cannot redeclare block-scoped variable 'handleScan'`

The file contains two distinct `const handleScan` functions. One appears to be a legacy UI handler, the other conforms to the `onProcess` signature. This is a syntax error that prevents compilation.

#### 4. Incorrect Hook Usage
- `src/tools/pdf/RepairPdfTool.tsx:18-21` - `Expected 0-1 arguments, but got 2.`

```tsx
const outputDirLabel = useState(
  () => preferences.defaultOutputDir || 'Not set yet',
  [preferences.defaultOutputDir]
)[0]
```

`useState` does not accept a dependency array; the correct hook is `useMemo`.

#### 5. PDF Library API Mismatch
- `electron/main/tools/pdf.ts:3` - `Module '"pdf-lib"' has no exported member 'EncryptOptions'`
- `electron/main/tools/pdf.ts:349` - `'encrypt' does not exist in type 'SaveOptions'`

The pdf-lib library has changed its encryption API. The correct approach is to call `doc.encrypt({ ... })` before `doc.save()`, and `EncryptOptions` is not a separately exported type.

#### 6. Third-Party Library Type Mismatches
- `src/tools/pdf/PdfOcrTool.tsx:45` - `createWorker` logger parameter type error; tesseract.js API likely changed.
- `src/tools/pdf/PdfOcrTool.tsx:66` - `canvas.toDataURL` quality parameter expects `number`, but `{ quality: number }` was provided; this may be outdated TypeScript definitions for Canvas API.

---

## Build Output

```
npm run build
> docflow-pro@0.1.0 build
> tsc && vite build && electron-builder

[TypeScript errors as listed above]
```

**Result:** Build fails at the `tsc` step. No Vite build or electron-builder execution occurs.

---

## Development Server Test

```
npm run dev
> vite
```

Vite starts and begins building:

```
VITE v5.4.21 ready in 363 ms
➜ Local: http://localhost:5173/
```

However, the process encounters an immediate module resolution error:

```
Error: The following dependencies are imported but could not be resolved:
  marked (imported by /data/workspace/repo/src/tools/text/MarkdownTool.tsx)
```

Electron then attempts to launch but fails due to the absence of a display server (`$DISPLAY` not set), which is expected in a headless environment. The Vite dev server does not reach a stable running state because of the missing module.

---

## Detailed File Issues

| File | Line(s) | Issue | Severity |
|------|---------|-------|----------|
| `electron/main/tools/pdf.ts` | 3 | Invalid import `EncryptOptions` | Critical |
| `electron/main/tools/pdf.ts` | 349 | Invalid `encrypt` option in `doc.save()` | Critical |
| `src/tools/file/DuplicateFinderTool.tsx` | 74, 169 | Duplicate `handleScan` declaration | Critical |
| `src/tools/image/BackgroundRemoverTool.tsx` | 70 | `children` prop not in BaseToolLayoutProps | High |
| `src/tools/pdf/PdfOcrTool.tsx` | 2 | Missing `pdfjs-dist` module | Critical |
| `src/tools/pdf/PdfOcrTool.tsx` | 45, 66 | Tesseract/Canvas type mismatches | High |
| `src/tools/pdf/PdfOcrTool.tsx` | 95,131 | Invalid props: `children`, `loading`, `result` | High |
| `src/tools/pdf/RepairPdfTool.tsx` | 18-21 | `useState` misuse (deps array) | High |
| `src/tools/pdf/RepairPdfTool.tsx` | 33 | Invalid prop: `loading` | High |
| `src/tools/text/MarkdownTool.tsx` | 2 | Missing `marked` module | Critical |
| `src/tools/text/MarkdownTool.tsx` | 3 | Missing `dompurify` module (implicit) | Critical |
| `src/tools/text/MarkdownTool.tsx` | 117 | Invalid prop: `children` | High |

---

## Recommendations

### Immediate Actions (To Unblock Build)

1. **Add missing dependencies** to `package.json`:
   ```json
   "dependencies": {
     "marked": "^...",
     "dompurify": "^...",
     "pdfjs-dist": "^..."
   }
   ```
   Then run `npm install`.

2. **Fix RepairPdfTool.tsx** - Replace the erroneous `useState` with `useMemo`:
   ```tsx
   const outputDirLabel = useMemo(
     () => preferences.defaultOutputDir || 'Not set yet',
     [preferences.defaultOutputDir]
   )
   ```

3. **Resolve DuplicateFinderTool duplication** - Remove the legacy `handleScan` (lines 74-136) or rename one of the functions. The `onProcess` handler (starting at line 169) should be the one passed to `BaseToolLayout`.

### Structural Improvements (Required for Long-Term Health)

4. **Decide on BaseToolLayout contract**:
   - **Option A (Conservative):** Update `BaseToolLayoutProps` to include `children?: ReactNode`, `loading?: boolean`, `result?: ReactNode`. Then render `{children}` inside the layout and handle `loading` appropriately (e.g., disable process button, show spinner). This is the smallest change that will make current tools compile.
   - **Option B (Refactor):** Remove usage of `children`, `loading`, and `result` from all tool components. Ensure each tool uses only `options` for configuration UI and sets results via `context.setResult()` inside `onProcess`. This aligns with the original `BaseToolLayout` design but requires rewriting several tools.

   Given the number of affected tools (at least 4), **Option A is recommended for faster unblocking**, with a note that Option B would be cleaner but more labor-intensive.

5. **Update PDF encryption** in `electron/main/tools/pdf.ts`:
   - Remove `EncryptOptions` import.
   - Use `doc.encrypt({ userPassword, ownerPassword, permissions })` before `doc.save()`.
   - Adjust `permissions` object to match current pdf-lib API (permissions map may need updates).

6. **Review tesseract.js integration** in `PdfOcrTool.tsx`. The logger and Canvas API type errors may require updating type declarations or adjusting code to match the current library versions.

7. **Add type definitions** for newly added packages if needed (e.g., `@types/marked`, `@types/dompurify`).

---

## Conclusion

The DocFlow Pro application is **not technically healthy** and cannot be built or run in its present state. The codebase exhibits signs of incomplete refactoring, outdated library usage, and missing dependencies. A focused effort to address the critical compilation blockers and align tool components with the layout component would be necessary to establish a working baseline.

---

**Prepared by:** Automated Baseline Assessment (Hermes Coder)
**Next Steps:** Implement the Immediate Actions and re-run assessment.