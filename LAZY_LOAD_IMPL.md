import { lazy } from 'react'
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

// ... existing icon imports ...

// Example of refactored tool definitions using React.lazy
export const tools: ToolDefinition[] = [
  {
    id: 'gif-creator',
    name: 'GIF Creator',
    description: 'Convert image sequences into animated GIFs.',
    categoryId: 'video',
    icon: Image,
    component: lazy(() => import('@/tools/video/GifCreatorTool').then(m => ({ default: m.GifCreatorTool }))),
  },
  {
    id: 'pdf-redact',
    name: 'PDF Redaction',
    description: 'Permanently remove sensitive content from PDF pages.',
    categoryId: 'pdf',
    icon: Ban,
    component: lazy(() => import('@/tools/pdf/PdfRedactionTool').then(m => ({ default: m.PdfRedactionTool }))),
  },
  {
    id: 'image-resize',
    name: 'Batch Resize',
    description: 'Resize images by width, height, or percent.',
    categoryId: 'image',
    icon: ImageUp,
    component: lazy(() => import('@/tools/image/ImageResizeTool').then(m => ({ default: m.ImageResizeTool }))),
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Validate, pretty-print, and minify JSON data.',
    categoryId: 'text',
    icon: Braces,
    component: lazy(() => import('@/tools/text/JsonFormatterTool').then(m => ({ default: m.JsonFormatterTool }))),
  },
  {
    id: 'password-generator',
    name: 'Password Generator',
    description: 'Generate secure random passwords.',
    categoryId: 'security',
    icon: KeyRound,
    component: lazy(() => import('@/tools/security/PasswordGeneratorTool').then(m => ({ default: m.PasswordGeneratorTool }))),
  },
  // ... rest of the tools array, refactored similarly ...
]

// Implementation note: 
// 1. Ensure the UI consuming these tools wraps them in React.Suspense
// 2. React.lazy requires a default export or a promise that resolves to an object with a default property.
// 3. The .then(m => ({ default: m.NamedExport })) pattern is used for named exports.