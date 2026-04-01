import { useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'

type EmptyFolderToolProps = {
  tool: ToolDefinition
}

export function EmptyFolderTool({ tool }: EmptyFolderToolProps) {
  const [directories, setDirectories] = useState<string[]>([])
  const [recursive, setRecursive] = useState(true)

  const handleAddDirectory = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected && !directories.includes(selected)) {
      setDirectories([...directories, selected])
    }
  }

  const handleRemoveDirectory = (dir: string) => {
    setDirectories(directories.filter((d) => d !== dir))
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async (_, context) => {
        if (!window.api?.deleteEmptyFolders) {
          throw new Error('The empty folder deletion engine is not available in this build.')
        }

        if (directories.length === 0) {
          throw new Error('Please add at least one directory to scan.')
        }

        context.setProgress(20)
        const result = await window.api.deleteEmptyFolders({
          paths: directories,
          recursive,
        })

        context.setProgress(100)

        const lines = (
          <>
            <div>Scanned {directories.length} root director{directories.length === 1 ? 'y' : 'ies'}</div>
            <div className="text-accent">Deleted {result.totalDeleted} empty folder{result.totalDeleted === 1 ? '' : 's'}</div>
            {result.totalRemainingEmpty > 0 && (
              <div className="text-muted">
                Found {result.remainingEmpty.length} other empty folder{result.remainingEmpty.length === 1 ? '' : 's'} (unscanned or protected)
              </div>
            )}
          </>
        )

        context.setResult(
          <Card className="space-y-3 border-border bg-base/60 p-4">
            <h3 className="text-sm font-semibold text-text">Operation Complete</h3>
            <div className="space-y-2 text-sm text-muted">{lines}</div>
            {result.deleted.length > 0 && (
              <div className="pt-2">
                <Button variant="secondary" onClick={() => window.api.revealInFolder(result.deleted[0])}>
                  Show First Deleted Folder
                </Button>
              </div>
            )}
          </Card>
        )
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Directories to Scan</div>
            <div className="space-y-2">
              {directories.map((dir) => (
                <div key={dir} className="flex items-center justify-between rounded-lg border border-border bg-base/60 px-3 py-2 text-xs">
                  <span className="truncate font-mono text-text">{dir}</span>
                  <Button variant="ghost" onClick={() => handleRemoveDirectory(dir)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={handleAddDirectory}>
              Add Directory
            </Button>
            {directories.length === 0 && (
              <p className="text-xs text-muted">No directories added yet.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Options</div>
            <Switch
              checked={recursive}
              onChange={(event) => setRecursive(event.target.checked)}
              label="Delete recursively (include subdirectories)"
            />
            <p className="text-xs text-muted">
              When enabled, scans all subdirectories and deletes empty folders bottom-up. When disabled, only checks the selected folders themselves.
            </p>
          </div>

          <Badge className="border-0 bg-accent/15 text-accent">Safe: only deletes empty folders</Badge>
        </div>
      }
    />
  )
}
