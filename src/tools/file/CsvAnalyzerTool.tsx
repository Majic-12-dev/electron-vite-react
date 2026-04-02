import { useCallback, useMemo, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FileSearch, Download, Filter, XCircle, Copy, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

type ToolProps = { tool: ToolDefinition }
type SortDirection = 'asc' | 'desc' | null

interface ColumnStats {
  name: string
  type: 'numeric' | 'string'
  min?: number
  max?: number
  avg?: number
  nulls: number
  uniques: number
}

function parseCSVLine(line: string, delimiter = ','): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === delimiter) { result.push(current.trim()); current = '' }
      else { current += ch }
    }
  }
  result.push(current.trim())
  return result
}

function toCSVLine(values: string[]): string {
  return values.map(v => (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v).join(',')
}

function detectColumnType(values: string[]): 'numeric' | 'string' {
  const nonEmpty = values.filter(v => v !== '' && v != null)
  let hasNum = 0
  for (const v of nonEmpty) {
    if (v !== '-' && v !== 'NaN' && !isNaN(Number(v))) hasNum++
  }
  // Require at least 50% non-empty values to be numeric
  const threshold = nonEmpty.length * 0.5
  return hasNum >= Math.max(1, threshold) && nonEmpty.length > 0 ? 'numeric' : 'string'
}

function computeColumnStats(headers: string[], rows: string[][]): ColumnStats[] {
  return headers.map((name, colIdx) => {
    const values = rows.map(r => r[colIdx] ?? '')
    const nonEmpty = values.filter(v => v !== '')
    const numericVals = nonEmpty.map(Number).filter(n => !isNaN(n))
    const isNumeric = detectColumnType(values)
    return {
      name,
      type: isNumeric,
      min: isNumeric && numericVals.length ? Math.min(...numericVals) : undefined,
      max: isNumeric && numericVals.length ? Math.max(...numericVals) : undefined,
      avg: isNumeric && numericVals.length ? +(numericVals.reduce((a, b) => a + b, 0) / numericVals.length).toFixed(2) : undefined,
      nulls: values.length - nonEmpty.length,
      uniques: new Set(nonEmpty).size,
    }
  })
}

export function CsvAnalyzerTool({ tool }: ToolProps) {
  const [rawData, setRawData] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [error, setError] = useState<string | null>(null)
  const [filterValue, setFilterValue] = useState('')
  const [filterColumn, setFilterColumn] = useState<string>('all')
  const [sortCol, setSortCol] = useState<number>(-1)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [previewStart, setPreviewStart] = useState(0)
  const PREVIEW_SIZE = 50

  const handleFile = useCallback((text: string) => {
    setError(null)
    try {
      const text2 = text.replace(/^\uFEFF/, '') // strip BOM
      const lines = text2.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { setError('CSV must have at least a header row and one data row.'); return }
      const hdrs = parseCSVLine(lines[0])
      const dataRows = lines.slice(1).map(l => parseCSVLine(l)).filter(r => r.some(c => c !== ''))
      const maxCols = Math.max(hdrs.length, ...dataRows.map(r => r.length))
      const padded = hdrs.map(() => '')
      hdrs.push(...Array.from({ length: maxCols - hdrs.length }, (_, i) => `Column ${hdrs.length + i}`))
      // Already covered by splice above for hdrs

      // Ensure all rows same length as headers
      const normalized = dataRows.map(r => {
        const copy = [...r]
        while (copy.length < maxCols) copy.push('')
        return copy.slice(0, maxCols)
      })

      // Normalize headers too
      const normHeaders = hdrs.length < maxCols ? [...hdrs, ...Array.from({ length: maxCols - hdrs.length }, (_, i) => `Column ${i}`)] : hdrs

      setHeaders(normHeaders)
      setRows(normalized)
      setRawData(text2)
      setFilterColumn('all')
      setFilterValue('')
      setSortCol(-1)
      setSortDir(null)
      setPreviewStart(0)
    } catch {
      setError('Failed to parse CSV file.')
    }
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Check file size limit 50K rows approximate - max ~50MB
    if (file.size > 50 * 1024 * 1024) { setError('File too large. Maximum size is 50MB.'); return }
    const reader = new FileReader()
    reader.onload = (ev) => { if (ev.target?.result) handleFile(ev.target.result as string) }
    reader.onerror = () => setError('Failed to read file.')
    reader.readAsText(file)
  }, [handleFile])

  const stats: ColumnStats[] = useMemo(() => computeColumnStats(headers, rows), [headers, rows])

  const filteredRows = useMemo(() => {
    let result = [...rows]
    if (filterValue) {
      const lower = filterValue.toLowerCase()
      if (filterColumn === 'all') {
        result = result.filter(r => r.some(c => c.toLowerCase().includes(lower)))
      } else {
        const colIdx = parseInt(filterColumn, 10)
        result = result.filter(r => (r[colIdx] ?? '').toLowerCase().includes(lower))
      }
    }
    if (sortCol >= 0 && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1
      const isNumeric = stats[sortCol]?.type === 'numeric'
      result.sort((a, b) => {
        const va = a[sortCol] ?? ''
        const vb = b[sortCol] ?? ''
        if (isNumeric) return dir * (Number(va) - Number(vb))
        return dir * va.localeCompare(vb)
      })
    }
    return result
  }, [rows, filterValue, filterColumn, sortCol, sortDir, stats])

  const visibleRows = filteredRows.slice(previewStart, previewStart + PREVIEW_SIZE)
  const totalFiltered = filteredRows.length

  const handleExport = useCallback(() => {
    let csvContent = toCSVLine(headers) + '\n'
    for (const row of filteredRows) csvContent += toCSVLine(row) + '\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'filtered_data.csv'; a.click()
    URL.revokeObjectURL(url)
  }, [filteredRows, headers])

  const handleSort = useCallback((colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc')
      if (sortDir === 'desc') { setSortCol(-1); setSortDir(null) }
    } else {
      setSortCol(colIdx); setSortDir('asc')
    }
  }, [sortCol, sortDir])

  const hasData = headers.length > 0

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div>
            <label className='block text-xs font-semibold uppercase text-muted mb-2'>Upload CSV</label>
            <input type='file' accept='.csv,text/csv' onChange={handleFileUpload} className='hidden' ref={(input) => {
              if (input) {
                // Create a label-like button for the hidden input
                const label = document.createElement('label');
              }
            }} />
            <label htmlFor='csv-upload' className='w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-base/70 px-3 py-2.5 text-sm font-medium cursor-pointer hover:border-accent transition'>
              <FileSearch className='h-4 w-4 text-muted' />
              Choose CSV File
            </label>
            <input id='csv-upload' type='file' accept='.csv,text/csv' onChange={handleFileUpload} className='hidden' />
          </div>

          {hasData && (
            <>
              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase text-muted'>Filter</label>
                <select value={filterColumn} onChange={e => setFilterColumn(e.target.value)} className='w-full rounded-lg border border-border bg-base/70 px-2 py-1.5 text-sm focus:border-accent focus:outline-none'>
                  <option value='all'>All Columns</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
                <div className='relative'>
                  <Filter className='absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted' />
                  <input value={filterValue} onChange={e => { setFilterValue(e.target.value); setPreviewStart(0) }}
                    placeholder='Search...'
                    className='w-full rounded-lg border border-border bg-base/70 pl-8 pr-8 py-2 text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none' />
                  {filterValue && (
                    <button type='button' onClick={() => setFilterValue('')} className='absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text'>
                      <XCircle className='h-4 w-4' />
                    </button>
                  )}
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase text-muted'>Column Stats — click to sort</label>
                <div className='space-y-1'>
                  {stats.map((s, i) => {
                    const activeSort = sortCol === i
                    return (
                      <button key={i} onClick={() => handleSort(i)} className='w-full rounded-lg bg-base/60 px-2 py-1.5 text-xs text-left hover:bg-base/90 transition flex items-center gap-1'>
                        <span className='flex-1 truncate font-medium'>{s.name}</span>
                        <span>{activeSort ? sortDir === 'asc' ? <ArrowUp className='h-3 w-3' /> : <ArrowDown className='h-3 w-3' /> : <ArrowUpDown className='h-3 w-3 text-muted' />}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>

              <Button onClick={handleExport} disabled={totalFiltered === 0} className='w-full'>
                <Download className='mr-2 h-4 w-4' />
                Export ({totalFiltered.toLocaleString()} rows)
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className='space-y-4'>
        {error && (
          <Card className='flex items-start gap-3 border border-red-500/50 bg-red-500/10'>
            <XCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-red-400' />
            <div className='text-sm text-red-200'>{error}</div>
          </Card>
        )}

        {hasData && (
          <>
            {/* Overview Stats */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              <Card className='text-center p-3'>
                <div className='text-lg font-bold text-accent'>{rows.length.toLocaleString()}</div>
                <div className='text-[10px] uppercase text-muted'>Rows</div>
              </Card>
              <Card className='text-center p-3'>
                <div className='text-lg font-bold text-accent'>{headers.length}</div>
                <div className='text-[10px] uppercase text-muted'>Columns</div>
              </Card>
              <Card className='text-center p-3'>
                <div className='text-lg font-bold text-accent'>{totalFiltered.toLocaleString()}</div>
                <div className='text-[10px] uppercase text-muted'>Filtered</div>
              </Card>
              <Card className='text-center p-3'>
                <div className='text-lg font-bold text-accent'>{rawData ? (rawData.length / 1024).toFixed(1) : '0'}KB</div>
                <div className='text-[10px] uppercase text-muted'>Size</div>
              </Card>
            </div>

            {/* Per-Column Stats */}
            <Card className='divide-y divide-border'>
              <div className='flex items-center justify-between py-2 px-3'>
                <span className='text-xs font-semibold uppercase text-muted'>Column Statistics</span>
              </div>
              {stats.map(s => (
                <div key={s.name} className='flex items-center justify-between py-2 px-3 text-xs'>
                  <span className='font-medium truncate flex-1'>{s.name} <Badge className='ml-1 px-1 py-0 text-[9px]'>{s.type}</Badge></span>
                  <div className='flex gap-3 text-muted tabular-nums'>
                    {s.min !== undefined && <span>min {typeof s.min === 'number' ? s.min.toLocaleString() : s.min}</span>}
                    {s.max !== undefined && <span>max {typeof s.max === 'number' ? s.max.toLocaleString() : s.max}</span>}
                    {s.avg !== undefined && <span>avg {s.avg}</span>}
                  </div>
                </div>
              ))}
            </Card>

            {/* Data Table */}
            <Card className='overflow-hidden'>
              <div className='text-xs font-semibold uppercase text-muted px-3 py-2'>
                Data Preview ({previewStart + 1}–{Math.min(previewStart + PREVIEW_SIZE, totalFiltered)} of {totalFiltered.toLocaleString()})
              </div>
              <div className='overflow-auto max-h-[400px] text-xs'>
                <table className='w-full table-auto'>
                  <thead className='sticky top-0 bg-base'>
                    <tr>
                      <th className='px-2 py-1.5 border-b border-border text-left font-semibold text-muted w-10'>#</th>
                      {headers.map((h, i) => {
                        const activeSort = sortCol === i
                        return (
                          <th key={i} className='px-2 py-1.5 border-b border-border text-left text-xs font-semibold text-muted max-w-[200px] truncate cursor-pointer hover:text-text' onClick={() => handleSort(i)}>
                            <span className='flex items-center gap-1'>{h}{activeSort ? sortDir === 'asc' ? <ArrowUp className='h-3 w-3' /> : <ArrowDown className='h-3 w-3' /> : null}</span>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>{visibleRows.map((row, ri) => (
                    <tr key={ri + previewStart} className={ri % 2 === 0 ? 'bg-base/40' : 'bg-base/20'}>
                      <td className='px-2 py-1 border-b border-border text-muted'>{previewStart + ri + 1}</td>
                      {row.map((cell, ci) => <td key={ci} className='px-2 py-1 border-b border-border max-w-[200px] truncate'>{cell || <em>—</em>}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {totalFiltered > PREVIEW_SIZE && (
                <div className='flex items-center justify-between px-3 py-2 border-t border-border'>
                  <Button variant='ghost' onClick={() => setPreviewStart(Math.max(0, previewStart - PREVIEW_SIZE))} disabled={previewStart === 0} className='text-[10px]'>
                    Previous
                  </Button>
                  <span className='text-[10px] text-muted'>{Math.floor(previewStart / PREVIEW_SIZE) + 1} / {Math.ceil(totalFiltered / PREVIEW_SIZE)} pages</span>
                  <Button variant='ghost' onClick={() => setPreviewStart(previewStart + PREVIEW_SIZE)} disabled={previewStart + PREVIEW_SIZE >= totalFiltered} className='text-[10px]'>
                    Next
                  </Button>
                </div>
              )}
            </Card>
          </>
        )}

        {!hasData && !error && (
          <Card className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
            <div className='flex justify-center mb-2'><FileSearch className='h-6 w-6 text-accent' /></div>
            <p>Upload a CSV file to explore columns, rows, statistics, and filtering.</p>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
