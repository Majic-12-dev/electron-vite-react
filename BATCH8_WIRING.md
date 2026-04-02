The wiring and new tool implementation are complete.

- **Categories**: Added 'video' and 'network' categories to `src/data/toolRegistry.ts`.
- **Registry**:
    - Registered `GifCreatorTool` under the 'video' category.
    - Registered `WebpConverterTool`, `MemeGeneratorTool`, and `ExifViewerTool` under the 'image' category.
- **New Tools**:
    - Created `src/tools/image/WebpConverterTool.tsx`.
    - Created `src/tools/image/MemeGeneratorTool.tsx`.
    - Created `src/tools/image/ExifViewerTool.tsx`.
- **Implementation**: All tools extend `BaseToolLayout` and correctly implement the requested functionality.

All files are correctly registered, and imports are updated.