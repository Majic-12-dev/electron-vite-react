# Microsoft Store packaging checklist (DocFlow Pro)

This project already outputs a Windows NSIS installer + portable EXE via `npm run build:win`.
For Store submission you have two paths:

1) Submit traditional installer (EXE/MSI) to the Store.
2) Submit an MSIX/AppX package for deeper Windows integration.

Use the notes below to prepare either route.

## Store account + submission
- You need an active Partner Center developer account.
- The Store submission flow asks for pricing/availability, properties, age ratings, packages, and store listing assets.

## Option A: EXE/MSI submission (fastest)
- Use the NSIS output in `release/<version>/`.
- Provide the installer to Partner Center in the Packages section.

## Option B: MSIX/AppX submission (recommended)
- MSIX/AppX packages must be signed with a certificate.
- For Store submission, Microsoft re-signs packages once uploaded.
- Recommended upload format is `.msixupload`/`.appxupload`.

## Project scripts
- `npm run build:win` -> NSIS + portable
- `npm run build:appx` -> AppX (requires Windows SDK)

## App identity + signing
When you reserve your app name in Partner Center, you'll receive identity values
(Publisher / IdentityName / PackageFamilyName). Use those for MSIX/AppX signing.
You can start with a local signing cert for testing, then swap to the Store identity.

## Assets to prepare
- App icon(s) in required sizes
- Store listing: screenshots, description, privacy policy URL, support URL
