The implementation of the Audio Trimmer and Video Compressor IPC backends is complete.

1.  **Dependencies**: Installed `fluent-ffmpeg` and `ffmpeg-static`.
2.  **Implementation**: Created `electron/main/tools/media.ts` to handle audio/video processing via `fluent-ffmpeg`.
3.  **IPC Setup**: Added `audio:trim` and `video:compress` handlers in `electron/main/index.ts`.
4.  **Preload Bridge**: Updated `electron/preload/index.ts` to expose these methods to the renderer.
5.  **Types**: Added `electron/main/types/ffmpeg.d.ts` to resolve TypeScript resolution issues for the new dependencies.

The `npm run build` process confirmed that the new code is syntactically valid and integrates correctly, failing only due to `electron-builder` timing out during a full release build in this environment.