# Changelog

All notable changes to DocFlow Pro will be documented in this file.

## [Unreleased]

### 🆕 New Tools (6)

#### PDF Category
- **PDF Redaction Tool** — Permanently black out sensitive regions in PDFs with visual selection and page navigation.
- **PDF Form Filler Tool** — Detect, display, and fill PDF form fields (text, checkbox, radio, dropdown) client-side.

#### Productivity Category
- **Barcode Generator** — Generate QR, Code 128, EAN-13, and UPC-A barcodes using `bwip-js` with configurable settings.

#### Image Category
- **Image Metadata Editor** — View and edit EXIF, IPTC, and GPS metadata in images using `exifr` + `piexifjs`.

#### Text Category
- **HTML Sanitizer** — Strip dangerous HTML tags/attributes, minify, beautify, and extract text/links/images.
- **JSON Schema Validator** — Validate JSON data against JSON Schema (draft 4/6/7/2019-12) using AJV with detailed error reporting.

### 🐛 Bug Fixes

| Fix | Description |
|-----|-------------|
| `image:watermark` IPC gap | Added missing import + IPC handler in `electron/main/index.ts` |
| `PdfAnnotatorTool.tsx` | Fixed incomplete file (truncated at line 186) — rewrote entire component |
| `ArchiveExtractTool.tsx` | Fixed `ReadableStream` type error and removed invalid `Badge` variant prop |
| `JwtInspectorTool.tsx` | Fixed `exp` cast from `unknown` — added proper type narrowing |
| Duplicate imports | Removed duplicate `lucide-react` imports in `Database`, `NotebookPen`, `BarcodeGeneratorTool`, `ImageOcrTool` |
| `BaseToolLayout` prop misuse | Migrated all tools from deprecated `tool` prop to explicit `title`/`description` props |
| `Badge` variant prop | Replaced unsupported `variant` prop with `className` styling across 4 files |
| `bwip-js` import pattern | Fixed import to `import bwipjs from 'bwip-js'` and destructured `toCanvas` |
| `piexifjs` type declarations | Added `declare module 'piexifjs'` to satisfy TypeScript |
| Duplicate `PdfRedactTool.tsx` | Removed orphaned file in favor of `PdfRedactionTool.tsx` |
| Memory leaks (Critic review) | Added 5-minute auto-revoke timers for Blob URLs in 3 tools |

### 📦 New Dependencies

| Package | Purpose |
|---------|---------|
| `bwip-js` | Barcode generation (QR, Code128, EAN, UPC) |
| `exifr` | EXIF/IPTC/GPS metadata parsing |
| `piexifjs` | JPEG EXIF metadata editing |
| `ajv` | JSON Schema validation |
| `@types/piexifjs` (custom) | TypeScript type declarations for piexifjs |

### 🔧 Internal Changes

- Enforced consistent `BaseToolLayout` usage: `title={name} description={desc} onProcess={handler}`
- Removed all `alert()` calls from codebase — use UI error cards and status messages instead
- Total tool registry count: **110+ tools** across 7 categories
- Pre-commit verification: `npx tsc --noEmit` and `npm run build` both pass cleanly
- Added critic review workflow for new feature validation
