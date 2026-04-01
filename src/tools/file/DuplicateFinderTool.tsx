import { useState, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'

type DuplicateFinderToolProps = {
  tool: ToolDefinition
}

type FileEntry = {
  file: File
  path: string
  size: number
  hash?: string
}

type DuplicateGroup = {
  hash: string
  files: FileEntry[]
}

export function DuplicateFinderTool({ tool }: DuplicateFinderToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string>('')

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir]
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    const newEntries: FileEntry[] = []
    for (const file of Array.from(selectedFiles)) {
      newEntries.push({
        file,
        path: file.name,
        size: file.size,
      })
    }
    setFiles((prev) => [...prev, ...newEntries])
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setDuplicates([])
  }

  // Simple hash using Web Crypto API
  const hashFile = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleDeleteDuplicates = async () => {
    if (!window.api?.processSecurity) {
      alert('File deletion is not available in this build.')
      return
    }

    const totalDuplicates = duplicates.reduce((sum, group) => sum + group.files.length - 1, 0)
    if (totalDuplicates === 0) {
      alert('No duplicates to delete.')
      return
    }

    const confirmed = confirm(`Delete ${totalDuplicates} duplicate file(s)? This action cannot be undone.`)
    if (!confirmed) return

    // For each duplicate group, keep the first and delete the rest
    const toDelete: { sourcePath: string; targetName: string }[] = []
    for (const group of duplicates) {
      const filesToDelete = group.files.slice(1)
      for (const entry of filesToDelete) {
        if (entry.path) {
          // Just pass empty targetName, will delete in the main process
          toDelete.push({ sourcePath: entry.path, targetName: '' })
        }
      }
    }

    // We should really have a delete endpoint, but for now let's just warn
    alert('Bulk delete not implemented. Please manually delete duplicates.')
  }

  const handleScan = async (scannedFiles: ToolFile[], context: { setProgress: (value: number) => void; setResult: (result: ReactNode) => void; setError: (message: string | null) => void }) => {
    // Use the scannedFiles from BaseToolLayout instead of component state
    if (scannedFiles.length === 0) {
      context.setError('Please select files to scan for duplicates.')
      return
    }

    setProgress(0)
    setDuplicates([])

    try {
      // Convert ToolFile to FileEntry
      const fileEntries: FileEntry[] = scannedFiles.map(f => ({
        file: f.file,
        path: f.path || f.name,
        size: f.size,
      }))

      // Group by size first (fast filter)
      const bySize = fileEntries.reduce<Map<number, FileEntry[]>>((acc, entry) => {
        const list = acc.get(entry.size) || []
        list.push(entry)
        acc.set(entry.size, list)
        return acc
      }, new Map())

      // Only hash files with same size (>1)
      const candidateGroups = Array.from(bySize.values()).filter((group) => group.length > 1)

      context.setProgress(10)

      // Hash each candidate
      const hashedGroups: DuplicateGroup[] = []
      let processed = 0
      const total = candidateGroups.reduce((sum, group) => sum + group.length, 0)

      for (const group of candidateGroups) {
        const hashPromises = group.map(async (entry) => {
          const hash = await hashFile(entry.file)
          return { ...entry, hash }
        })
        const hashedEntries = await Promise.all(hashPromises)
        hashedGroups.push({ hash: hashedEntries[0].hash!, files: hashedEntries })
        processed += group.length
        context.setProgress(10 + Math.round((processed / total) * 80))
      }

      // Group by hash
      const byHash = hashedGroups.reduce<Map<string, FileEntry[]>>((acc, group) => {
        const existing = acc.get(group.hash) || []
        acc.set(group.hash, [...existing, ...group.files])
        return acc
      }, new Map())

      const duplicateGroups: DuplicateGroup[] = []
      for (const [hash, entries] of byHash.entries()) {
        if (entries.length > 1) {
          duplicateGroups.push({ hash, files: entries })
        }
      }

      setDuplicates(duplicateGroups)
      context.setProgress(100)

      // Set result
      if (duplicateGroups.length > 0) {
        context.setResult(
          <Card className="space-y-3 border-border bg-base/60 p-4">
            <h3 className="text-sm font-semibold text-text">
              Found {duplicateGroups.length} duplicate group(s)
            </h3>
            <div className="space-y-3">
              {duplicateGroups.map((group, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-base/40 p-3">
                  <div className="text-xs font-mono text-muted mb-2">
                    Hash: {group.hash.substring(0, 16)}...
                  </div>
                  <div className="space-y-1">
                    {group.files.map((file, fidx) => (
                      <div key={fidx} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-text truncate">{file.path}</span>
                        <span className="text-muted">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Button variant="secondary" onClick={handleDeleteDuplicates}>
                Delete Duplicates (Keep First)
              </Button>
            </div>
          </Card>,
        )
      } else {
        context.setResult(
          <Badge className="border-0 bg-accent/15 text-accent">No duplicates found.</Badge>
        )
      }
    } catch (error) {
      console.error('Error scanning duplicates:', error)
      context.setError(error instanceof Error ? error.message : 'Failed to scan files.')
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={handleScan}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Select Files</div>
            <input
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted">
                Selected Files ({files.length})
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-base/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted">File Name</th>
                      <th className="px-3 py-2 text-right font-medium text-muted">Size</th>
                      <th className="px-3 py-2 text-center font-medium text-muted">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((entry, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-text truncate" title={entry.path}>
                          {entry.path}
                        </td>
                        <td className="px-3 py-2 text-right text-muted">
                          {formatBytes(entry.size)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            variant="ghost"
                            onClick={() => removeFile(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" onClick={clearFiles} className="w-full text-xs">
                Clear All
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted">
            <span>⚠️ Scanning may take a while for large files.</span>
          </div>
        </div>
      }
    />
  )
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
