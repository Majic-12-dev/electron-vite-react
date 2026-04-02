# Feature Report: QR Code Generator + Password Generator

## Summary

Two new tools have been added to DocFlow Pro:
- **QR Code Generator** (`qr-code-generator`) - Productivity category
- **Password Generator** (`password-generator`) - Security category

Both are frontend-only tools with no IPC requirements

## Files Created

### `src/tools/productivity/QrCodeGeneratorTool.tsx`
- Uses `BaseToolLayout` with QR input textarea in `options` panel and QR result displayed via `result` prop
- Generates QR codes using the `qrcode` npm package via `QRCodeLib.toDataURL()`
- PNG download via programmatically created `<a>` element
- Quick example buttons (URL, plain text, phone number) for convenience
- Error handling for empty input and overly-long payloads

### `src/tools/security/PasswordGeneratorTool.tsx`
- Uses `BaseToolLayout` with length slider (8-64) and character set toggles (uppercase, lowercase, numbers, symbols) in `options` panel
- Password displayed in result area with monospace styling
- Copy-to-clipboard with visual confirmation state (`CheckCircle` icon)
- Regenerate button for quick re-generation
- Entropy estimate displayed in bits
- Password generation uses `Math.random()` with Fisher-Yates shuffle; ensures at least one character from each selected charset
- Clipboard copy uses `navigator.clipboard.writeText` with fallback to `document.execCommand('copy')`

## Files Modified

### `src/data/toolRegistry.ts`
- Added imports for `QrCode` and `KeyRound` from `lucide-react`
- Added imports for `QrCodeGeneratorTool` and `PasswordGeneratorTool`
- Two new entries in the `tools` array:
  - `{ id: 'qr-code-generator', name: 'QR Code Generator', description: 'Generate QR codes from text or URLs.', categoryId: 'productivity', icon: QrCode }`
  - `{ id: 'password-generator', name: 'Password Generator', description: 'Generate secure random passwords.', categoryId: 'security', icon: KeyRound }`

## Dependencies Added

- `qrcode` ^1.5.4 - QR code generation
- `@types/qrcode` ^1.5.5 - TypeScript type definitions

## Verification

- `npx tsc --noEmit` passes with zero errors
- No `alert()` calls in either tool
- Both tools follow the existing `BaseToolLayout` pattern used throughout the codebase
- All existing tool registrations unchanged