import AdmZip from 'adm-zip'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from '../utils/fs'

export type ProcessArchivePayload = {
  mode: 'zip' | 'unzip'
  sources: string[]
  outputPath: string
}

export async function processArchive({ mode, sources, outputPath }: ProcessArchivePayload) {
  if (!sources.length) throw new Error('No files provided.')
  
  if (mode === 'zip') {
    const zip = new AdmZip()
    for (const source of sources) {
      const stats = await fs.stat(source)
      if (stats.isDirectory()) {
        zip.addLocalFolder(source, path.basename(source))
      } else {
        zip.addLocalFile(source)
      }
    }
    
    // Ensure output path ends with .zip
    let finalOutputPath = outputPath
    if (!finalOutputPath.toLowerCase().endsWith('.zip')) {
      finalOutputPath += '.zip'
    }
    
    await ensureDir(path.dirname(finalOutputPath))
    zip.writeZip(finalOutputPath)
    return { outputPath: finalOutputPath, count: sources.length }
  } else {
    // Unzip mode
    if (sources.length !== 1) throw new Error('Only one zip file can be unzipped at a time.')
    const source = sources[0]
    
    await ensureDir(outputPath)
    const zip = new AdmZip(source)
    zip.extractAllTo(outputPath, true /* overwrite */)
    
    return { outputPath, count: 1 }
  }
}
