# Changelog

All notable changes to DocFlow Pro will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **QR Code Generator** (`qr:generate`): Tool in `src/tools/productivity/QrCodeGeneratorTool.tsx` — generates QR codes from user text with download support and input validation.
- **Password Generator** (`password:generate`): Tool in `src/tools/security/PasswordGeneratorTool.tsx` — generates random passwords with customizable length and character set options.
- **Text Diff** (`text:diff`): Tool in `src/tools/text/TextDiffTool.tsx` — compares two text inputs line-by-line and word-by-word, displaying additions, removals, and unchanged lines.
- **JSON Formatter** (`json:format`): Tool in `src/tools/text/JsonFormatterTool.tsx` — parses, validates, and formats JSON input with indentation control and copy-to-clipboard.

### Fixed
- **Password Generator security**: Replaced `Math.random()` with `crypto.getRandomValues()` to ensure cryptographically secure password generation.

---

## [0.1.0] - 2026-04-02

### Fixed
- **Build pipeline**: Resolved TypeScript compilation errors (type casting).
- **Vite config**: Added `@napi-rs/canvas` to rollup external dependencies for Electron main process bundling.
- **Dependencies**: Added `@napi-rs/canvas` to package.json for PDF-to-images rendering.

### Added
- **PDF Unlock** (`pdf:unlock`): IPC handler in `electron/main/index.ts` and `unlockPdf` function in `electron/main/tools/pdf.ts` — removes PDF restrictions when the user provides a known password.

---
