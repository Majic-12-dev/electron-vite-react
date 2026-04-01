import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'

type PlaceholderToolProps = {
  tool: ToolDefinition
}

export function PlaceholderTool({ tool }: PlaceholderToolProps) {
  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async (_, context) => {
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>In progress</Badge>
            <div className='mt-3 text-sm text-muted'>
              This tool is queued for development. The pipeline is ready, and processing logic
              will be added next.
            </div>
          </>,
        )
      }}
      options={
        <div className='space-y-3 text-xs text-muted'>
          <p>Implementation is pending. Settings will appear here.</p>
          <p>
            The shared tool layout is active so you can verify file queueing and flow without
            waiting on the backend logic.
          </p>
        </div>
      }
    />
  )
}
