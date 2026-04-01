import { promises as fs } from 'node:fs'

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}
