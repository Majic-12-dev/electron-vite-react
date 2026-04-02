Feature plan written to `/data/workspace/repo/FEATURE_PLAN_CYCLE3.md`.

**Summary of the 5 proposed features:**

| # | Tool ID | Name | Category | New Deps |
|---|---------|------|----------|----------|
| 1 | `pdf-extract-images` | PDF Image Extractor | `pdf` | None (uses pdf-lib + pdfjs-dist + sharp) |
| 2 | `image-collage` | Image Collage Maker | `image` | None (uses sharp + @dnd-kit) |
| 3 | `pdf-reorder` | PDF Page Reorder | `pdf` | None (uses pdf-lib + @dnd-kit) |
| 4 | `base64-tool` | Base64 Encode/Decode | `productivity` | None (pure JS, renderer-only) |
| 5 | `xml-formatter` | XML Formatter/Validator | `text` | `fast-xml-parser` ^5.0.0 (optional) |

**Key decisions:**
- 4 of 5 tools need zero new dependencies
- All features work fully offline, no cloud APIs
- Base64 tool runs entirely in the renderer for speed (no IPC for text workflows)
- PDF Image Extractor is distinct from existing PDF-to-Images: it extracts embedded image XObjects from the PDF at original resolution, not page rasterizations
- Implementation plans include exact file paths for components, IPC handlers, preload bridge, and toolRegistry entries
- All plans follow existing patterns: `BaseToolLayout`, proper error throwing, output folder management, no `alert()`