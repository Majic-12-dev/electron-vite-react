import { useState, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'

type BackgroundRemoverToolProps = {
  tool: ToolDefinition
}

export function BackgroundRemoverTool({ tool }: BackgroundRemoverToolProps) {
  const [image, setImage] = useState<string | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      setImage(e.target?.result as string)
      processImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const processImage = (src: string) => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      const c = canvasRef.current
      if (!c) return
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, c.width, c.height)
      const data = imageData.data
      
      // Get background color from the top-left pixel
      const r = data[0]
      const g = data[1]
      const b = data[2]

      // Simple threshold removal
      const threshold = 40
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i] - r) < threshold &&
            Math.abs(data[i + 1] - g) < threshold &&
            Math.abs(data[i + 2] - b) < threshold) {
          data[i + 3] = 0 // set alpha to 0
        }
      }
      ctx.putImageData(imageData, 0, 0)
      setCanvas(c)
    }
  }

  const download = () => {
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'no-background.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
            <div className="text-xs font-semibold uppercase text-muted">Upload Image</div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
            />
            {image && <Button onClick={download} className="w-full">Download PNG</Button>}
        </div>
      }
    >
        <div className="p-4 bg-gray-100 rounded-lg">
            <canvas ref={canvasRef} className="max-w-full" />
        </div>
    </BaseToolLayout>
  )
}
