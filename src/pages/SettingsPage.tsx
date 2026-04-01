import { useMemo } from 'react'
import { FolderOpen, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/useAppStore'

export function SettingsPage() {
  const { preferences, setDarkMode, setDefaultOutputDir } = useAppStore()

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not configured',
    [preferences.defaultOutputDir],
  )

  const handleSelectFolder = async () => {
    if (!window.api?.selectOutputDir) return
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const handleRevealFolder = () => {
    if (preferences.defaultOutputDir && window.api?.revealInFolder) {
      window.api.revealInFolder(preferences.defaultOutputDir)
    }
  }

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <h1 className='text-2xl font-semibold text-text'>Settings</h1>
        <p className='text-sm text-muted'>Customize your workspace and default behaviors.</p>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        <Card className='space-y-4'>
          <h2 className='text-sm font-semibold text-text'>Appearance</h2>
          <Switch
            checked={preferences.darkMode}
            onChange={(event) => setDarkMode(event.target.checked)}
            label='Dark mode'
          />
        </Card>

        <Card className='space-y-4'>
          <h2 className='text-sm font-semibold text-text'>Default Output Folder</h2>
          <div className='rounded-xl border border-border bg-base/60 px-3 py-3 text-xs text-muted'>
            {outputDirLabel}
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='secondary' onClick={handleSelectFolder}>
              <FolderOpen className='h-4 w-4' />
              Choose Folder
            </Button>
            <Button variant='outline' onClick={handleRevealFolder} disabled={!preferences.defaultOutputDir}>
              Reveal in Explorer
            </Button>
          </div>
        </Card>

        <Card className='space-y-4'>
          <h2 className='text-sm font-semibold text-text'>Updates</h2>
          <p className='text-sm text-muted'>
            Manual update check keeps the app offline by default.
          </p>
          <Button variant='outline'>
            <RefreshCcw className='h-4 w-4' />
            Check for updates
          </Button>
        </Card>
      </div>
    </div>
  )
}
