import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'

export type ChecksumPayload = {
  inputPaths: string[]
  algorithm: 'md5' | 'sha1' | 'sha256'
}

export async function checksumFiles({ inputPaths, algorithm }: ChecksumPayload) {
  if (!inputPaths.length) throw new Error('No files provided.')

  const items = []

  for (const filePath of inputPaths) {
    const buffer = await fs.readFile(filePath)
    const md5 = createHash('md5').update(buffer).digest('hex')
    const sha1 = createHash('sha1').update(buffer).digest('hex')
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    items.push({ path: filePath, md5, sha1, sha256 })
  }

  return { algorithm, items }
}
