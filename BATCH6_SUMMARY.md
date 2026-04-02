# Batch 6: Text Tool Additions

## Tools Created

### 1. Markdown Preview
- **Path:** `src/tools/text/MarkdownPreviewTool.tsx`
- **Category:** Text
- **Icon:** `FileUp` (lucide-react)
- **Description:** Live Markdown preview with HTML export, formatting, and syntax reference.
- **Features:**
  - Built-in Lightweight markdown-to-HTML parser handles
  - Headers, bold/italic/strikethrough, code blocks, links, images, lists, blockquotes, and horizontal rules.
  - Syntax reference panel in the Options sidebar.
  - Copy HTML output to clipboard.
  - Character/line count display.
  - Example Markdown templates (Basic, Table).
- **Client-side:** ✅ Yes, no external dependencies.
- **Uses BaseToolLayout:** Yes.
- **Uses `{ tool: ToolDefinition }` props:** Yes.
- **Input:**
  - Markdown textarea.
- **Process Button:** Copy HTML (via `onProcess`).
- **Output:** Live preview panel, HTML output.

### 2. HTML Entity Encoder / Decoder
- **Path:** `src/tools/text/HtmlEntityTool.tsx`
- **Category:** Text
- **Icon:** `FileType2` (lucide-react)
- **Description:** Encode and decode HTML entities with support for named, decimal, and hex formats.
- **Features:**
  - Encode mode: Converts special characters to HTML entities (always encodes `<`, `>`, `&` + option for named/symbol entities.
  - Decode mode: Named (`&amp;`), decimal (`&#123;`), and hex (`&#xAB;`) entities.
  - Named-only option checkbox for lightweight encoding.
  - Copy output to clipboard.
  - Character count display.
- **Client-side:** ✅ Yes, pure JS implementation.
- **Uses BaseToolLayout:** Yes.
- **Uses `{ tool: ToolDefinition }` props:** Yes.
- **Input:** Textarea for input text.
- **Process Button:** Convert (`onProcess`).
- **Output:** Encoded/decoded output panel.

### 3. Text Statistics
- **Path:** `src/tools/text/TextStatisticsTool.tsx`
- **Category:** Text
- **Icon:** `BarChart3` (lucide-react)
- **Description:** Comprehensive text analysis including readability scores, word frequency, and time estimates.
- **Features:**
  - Character, word, sentence, paragraph counts.
  - Flesch Reading Ease score (0-100) with color-coded classification.
  - Flesch-Kincaid Grade Level.
  - Lexical Diversity percentage (unique words / total words).
  - Average syllables per word, average word length, average sentence length.
  - Estimated reading time (238 WPM) and speaking time (150 WPM).
  - Top 8 frequent words (excluding common stop words).
  - Full text report copyable to clipboard.
- **Client-side:** Yes, pure JS implementation.
- **Uses BaseToolLayout:** Yes.
- **Uses `{ tool: ToolDefinition }` props:** Yes.
- **Input:** Textarea for input text.
- **Process Button:** Copy Full Report (`onProcess`).
- **Output:** Quick stats cards, readability analysis panel, time estimates, top words cloud.

### 4. Cipher Encoder / Decoder
- **Path:** `src/tools/text/CipherTool.tsx`
- **Category:** Text
- **Icon:** `ShieldCheck` (lucide-react)
- **Description:** Encrypt and decrypt text using Caesar, ROT13, Vigenère, and Atbash ciphers.
- **Features:**
  - **Caesar cipher:** Adjustable shift slider (1-25 positions).
  - **ROT13:** Symmetric shift by 13 (special case of Caesar).
  - **Vigenère cipher:** Polyalphabetic cipher with custom key input.
  - **Atbash cipher:** Reverse alphabet substitution.
  - Encrypt/Decrypt mode toggle.
  - Copy output to clipboard.
  - Copy output to clipboard.
  - Output displayed in monospace panel.
  - All ciphers are client-side, no network calls.
- **Client-side:** ✅ Yes, pure JS implementation.
- **Uses BaseToolLayout:** Yes.
- **Uses `{ tool: ToolDefinition }` props:** Yes.
- **Input:** Textarea for input.
- **Process Button:** Encrypt/Decrypt (`onProcess`).
- **Output:** Encrypted/decrypted output in monospace panel.

### 5. Text to Speech
- **Path:** `src/tools/text/TextToSpeechTool.tsx`
- **Category:** Text
- **Icon:** `Volume2` (lucide-react)
- **Description:** Convert text to speech with configurable voice, speed, pitch, and volume using the browser API.
- **Features:**
  - Voice selection grouped by language from `window.speechSynthesis.getVoices()`.
  - Speed control: 0.5x to 2.0x with increment/decrement buttons.
  - Pitch control: 0 to 2 slider.
  - Volume control: 0% to 100% slider.
  - Play / Pause / Resume / Stop controls.
  - Sample texts (Greeting, Long Paragraph, News Style) for quick testing.
  - Current settings display toggle.
  - Word/character count display.
- **Client-side:** Yes, uses native `SpeechSynthesis` API.
- **Uses BaseToolLayout:** No API key needed.
- **Uses BaseToolLayout:** Yes.
- **Uses `{ tool: ToolDefinition }` props:** Yes.
- **Input:** Textarea for text to speak.
- **Process Button:** Play (`onProcess`).
- **Output:** Audio playback via browser SpeechSynthesis API, status indicator with settings display.

### 6. Text to Speech
- **Path:** `src/tools/text/TextToSpeechTool.tsx`
- **Category:** Text
- **Icon:** `Volume2` (lucide-react)
- **Description:** Convert text to speech with configurable voice, speed, pitch, and volume using the browser API.
- **Features:**
  - Voice selection grouped by language from `window.speechSynthesis.getVoices()`.
  - Speed control: 0.5x to 2.0x with increment/decrement buttons.
  - Pitch control: 0 to 2 slider.
  - Volume control: 0% to 100% slider.
  - Play / Pause / Resume / Stop controls.
  - Sample texts (Greeting, Long Paragraph, News Style) for quick testing.
  - Current settings display toggle.
  - Word/character count display.
- **Client-side:** ✅ Yes, uses native `SpeechSynthesis` API.
- **Uses BaseToolLayout:** Yes.
- **Uses `{ tool: ToolDefinition }` props:** Yes.
- **Input:** Textarea for text to speak.
- **Process Button:** Play (`onProcess`).
- **Output:** Audio playback via browser SpeechSynthesis API, status indicator with settings display.

## Registry Updates

All 5 tools registered in `/src/data/toolRegistry` toolRegistry.ts`:
- Imports for `FileUp`, `FileType2`, `BarChart3`, `ShieldCheck`, `Volume2`.
- Imports for all 5 tool components.
- Tool definitions added to `tools` array with unique IDs: `markdown-preview`, `html-entity`, `text-statistics`, `cipher`, `text-to-speech`.

## Verification

- ✅ All 5 `.tsx` files compile cleanly: `npx tsc --noEmit` passes.
- ✅ No `alert()` calls in any tool.
- ✅ No `window.crypto.randomUUID()`.
- ✅ No `window.api` calls.
- ✅ All client-side only.
- ✅ Each tool uses `{ tool: ToolDefinition }` props.
- ✅ Each component uses `BaseToolLayout` with `title` and `description`.
- ✅ Each tool has at least an input field, a process button, and output area.
- ✅ All lucide-react icons imported from `lucide-react`.
