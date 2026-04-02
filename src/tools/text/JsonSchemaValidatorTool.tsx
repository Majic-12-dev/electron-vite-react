import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import Ajv from 'ajv'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { CheckCircle, XCircle, Copy, FileJson } from 'lucide-react'

type JsonSchemaValidatorToolProps = {
  tool: ToolDefinition
}

export function JsonSchemaValidatorTool({ tool }: JsonSchemaValidatorToolProps) {
  const [jsonData, setJsonData] = useState('')
  const [schemaData, setSchemaData] = useState('')
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors?: { instancePath: string; message: string }[]
  } | null>(null)

  const validate = useCallback(() => {
    try {
      const data = JSON.parse(jsonData)
      const schema = JSON.parse(schemaData)

      const ajv = new Ajv({ allErrors: true })
      const validate = ajv.compile(schema)
      const valid = validate(data)

      if (valid) {
        setValidationResult({ valid: true })
      } else {
        const errors = (validate.errors || []).map((e: any) => ({
          instancePath: e.instancePath || '(root)',
          message: e.message || 'Unknown error',
        }))
        setValidationResult({ valid: false, errors })
      }
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [{ instancePath: 'parse', message: err instanceof Error ? err.message : 'Invalid JSON' }],
      })
    }
  }, [jsonData, schemaData])

  const handleProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (v: number) => void
        setResult: (r: ReactNode | null) => void
        setError: (m: string | null) => void
      },
    ) => {
      try {
        context.setProgress(10)
        for (const file of files) {
          const text = await file.file.text()
          if (file.name.includes('schema')) {
            setSchemaData(text)
          } else {
            setJsonData(text)
          }
        }
        context.setProgress(100)
        context.setResult(null)
      } catch (err) {
        context.setError(err instanceof Error ? err.message : 'Failed to load files.')
      }
    },
    [],
  )

  const copyErrors = () => {
    if (validationResult?.errors) {
      const text = validationResult.errors.map((e) => `${e.instancePath}: ${e.message}`).join('\n')
      navigator.clipboard.writeText(text)
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={handleProcess}
      accept=".json"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-foreground">JSON Data</label>
            <textarea
              className="w-full h-32 rounded border border-border bg-base p-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-accent"
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder='{"name": "John", "age": 30}'
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">JSON Schema</label>
            <textarea
              className="w-full h-32 rounded border border-border bg-base p-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-accent"
              value={schemaData}
              onChange={(e) => setSchemaData(e.target.value)}
              placeholder='{"type": "object", "properties": {"name": {"type": "string"}}}'
            />
          </div>
        </div>

        <Button onClick={validate} disabled={!jsonData.trim() || !schemaData.trim()}>
          Validate
        </Button>

        {validationResult && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              {validationResult.valid ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="text-sm font-medium">
                {validationResult.valid ? 'Schema Valid' : `${validationResult.errors?.length || 0} Error(s) Found`}
              </span>
              {!validationResult.valid && (
                <Button variant="ghost" size="sm" onClick={copyErrors} className="ml-auto gap-1 text-xs">
                  <Copy className="h-3 w-3" /> Copy Errors
                </Button>
              )}
            </div>
            {validationResult.errors && validationResult.errors.length > 0 && (
              <div className="space-y-2">
                {validationResult.errors.map((err, i) => (
                  <div key={i} className="p-2 rounded bg-destructive/10 text-xs font-mono">
                    <span className="text-destructive">{err.instancePath}</span>
                    <br />
                    <span className="text-muted">{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {!validationResult && (
          <div className="text-center py-8">
            <FileJson className="h-10 w-10 mx-auto text-muted opacity-40" />
            <p className="text-sm text-muted mt-2">Enter JSON data and a schema to validate.</p>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
