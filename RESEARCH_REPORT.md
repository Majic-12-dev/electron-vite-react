# RESEARCH_REPORT.md

This report outlines corrected implementations for critical technical issues in the DocFlow Pro codebase, ensuring compatibility with current library versions (2025).

---

## 1. pdf-lib Encryption API Correction

The previous implementation attempted to pass an `encrypt` key to `doc.save()`. In the current version of `pdf-lib`, encryption settings must be passed directly into the `save()` method, and the permissions must be mapped to the library's internal constant flags.

**Correct Usage:**

```typescript
// Replace the current encryption block in electron/main/tools/pdf.ts
import { PDFDocument, Permissions } from 'pdf-lib'

// ...
const encryptOptions = {
  userPassword: userPassword || undefined,
  ownerPassword: ownerPassword || undefined,
  permissions: {
    printing: permissions.print ? 'printAllowed' : 'notAllowed',
    modifying: permissions.modify ? 'modifyingAllowed' : 'notAllowed',
    copying: permissions.copy ? 'copyingAllowed' : 'notAllowed',
    annotating: permissions.annotate ? 'annotatingAllowed' : 'notAllowed',
    // ...
  }
}

const encryptedBytes = await doc.save(encryptOptions)
await fs.writeFile(outputPath, encryptedBytes)
```
*Note: Verify your specific `pdf-lib` version against the official documentation for the exact permission property names (e.g., `printing`, `modifying`).*

---

## 2. Tesseract.js v7 API Implementation

In recent versions, `createWorker` has moved to a more standardized options-object pattern.

**Correct Implementation:**

```typescript
// src/tools/pdf/PdfOcrTool.tsx

const worker = await createWorker('eng', 1, {
  logger: (m: any) => {
    if (m.status === 'recognizing text') {
      setProgress(Math.round(m.progress * 100));
      setStatus(`Recognizing... ${Math.round(m.progress * 100)}%`);
    }
  },
});

// Quality parameter for Canvas:
// toDataURL takes type as first arg, quality as second (0.0 to 1.0)
const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
```

---

## 3. Marked and DOMPurify Usage

For robust Markdown to HTML conversion, ensure that `marked` is correctly invoked and then sanitized immediately.

```typescript
// src/tools/text/MarkdownTool.tsx
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Ensure marked is invoked as a function
const rawHtml = marked.parse(markdownText);
const sanitizedHtml = DOMPurify.sanitize(rawHtml);
```
*Tip: `marked.parse()` is the preferred modern way to convert Markdown to HTML.*

---

## 4. pdfjs-dist Import and Rendering

Modern `pdfjs-dist` requires careful handling of worker setup, especially in bundlers like Vite or Webpack.

**Correct Import:**

```typescript
// src/tools/pdf/PdfOcrTool.tsx
import * as pdfjsLib from 'pdfjs-dist';

// Use a CDN for the worker to avoid complex bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
```

---

## 5. BaseToolLayout Design: Compound Component Pattern

The current `BaseToolLayout` is rigid. Adopting a compound component pattern allows for greater customization while maintaining the internal state logic (file queue, processing, status).

**Recommended Prop Interface:**

```typescript
interface BaseToolLayoutProps {
  title: string;
  description?: string;
  children: ReactNode; // Main tool interface
  sidebar?: ReactNode; // Replaces 'options'
  footer?: ReactNode;  // For custom actions
  status: 'idle' | 'processing' | 'done' | 'error';
  onProcess: () => void;
  // ... other props
}
```

**Compound Component Structure:**
```tsx
<BaseToolLayout title="OCR Tool" onProcess={handleProcess}>
  <BaseToolLayout.Header>Subtitle</BaseToolLayout.Header>
  <BaseToolLayout.Body>
     {/* Main content */}
  </BaseToolLayout.Body>
  <BaseToolLayout.Sidebar>
     {/* Options */}
  </BaseToolLayout.Sidebar>
  <BaseToolLayout.Footer>
     {/* Custom Buttons */}
  </BaseToolLayout.Footer>
</BaseToolLayout>
```
*This pattern separates concerns: the layout manages the "shell," while the tool component manages its specific interface elements.*