import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getToolById } from '@/data/toolRegistry'
import { useAppStore } from '@/store/useAppStore'

export function ToolPage() {
  const { toolId } = useParams()
  const addRecentTool = useAppStore((state) => state.addRecentTool)
  const tool = toolId ? getToolById(toolId) : null

  useEffect(() => {
    if (tool?.id) addRecentTool(tool.id)
  }, [tool?.id, addRecentTool])

  if (!tool) {
    return (
      <div className='rounded-2xl border border-border bg-panel/60 p-6 text-sm text-muted'>
        Tool not found. Choose another one from the sidebar.
      </div>
    )
  }

  const ToolComponent = tool.component

  return (
    <ErrorBoundary>
      <ToolComponent tool={tool} />
    </ErrorBoundary>
  )
}
