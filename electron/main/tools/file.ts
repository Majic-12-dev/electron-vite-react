import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from '../utils/fs'

export type BulkRenamePayload = {
  outputDir: string
  items: { sourcePath: string; targetName: string }[]
}

export async function bulkRename({ outputDir, items }: BulkRenamePayload) {
  if (!items.length) throw new Error('No files provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const item of items) {
    const safeName = sanitizeFileName(item.targetName)
    const targetPath = await uniquePath(path.join(outputDir, safeName))
    await fs.copyFile(item.sourcePath, targetPath)
    outputs.push(targetPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim()
}

async function uniquePath(targetPath: string) {
  const parsed = path.parse(targetPath)
  let attempt = 0
  let candidate = targetPath
  while (true) {
    try {
      await fs.access(candidate)
      attempt += 1
      candidate = path.join(parsed.dir, `${parsed.name}(${attempt})${parsed.ext}`)
    } catch {
      return candidate
    }
  }
}
