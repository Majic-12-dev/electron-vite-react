import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import * as exifr from 'exifr'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Camera, MapPin, Image as ImageIcon, Settings, Eye, FileDigit, Clock } from 'lucide-react'

type ExifViewerToolProps = {
  tool: ToolDefinition
}

type ExifField = {
  label: string
  value: string
  icon?: string
}

type ExifSection = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  fields: ExifField[]
}

/** Format GPS coordinates to decimal */
function formatGPS(lat: number, lng: number): string {
  return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`
}

/** Format file size */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Format focal length */
function formatFocal(value: number): string {
  return `${Math.round(value)}mm`
}

/** Format exposure time */
function formatExposure(value: number): string {
  if (value >= 1) return `1/${Math.round(1 / value)}s`
  return `${value.toFixed(4)}s`
}

export function ExifViewerTool({ tool }: ExifViewerToolProps) {
  const [sections, setSections] = useState<ExifSection[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; type: string } | null>(null)

  const handleProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (v: number) => void
        setResult: (r: ReactNode | null) => void
        setError: (m: string | null) => void
      },
    ) => {
      if (files.length === 0) throw new Error('No image provided.')

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const file = files[0]
      const url = URL.createObjectURL(file.file)
      setPreviewUrl(url)
      setFileInfo({ name: file.name, size: file.size, type: file.type || 'unknown' })

      context.setProgress(15)

      try {
        const parsed = await exifr.parse(file.file, {
          tiff: true,
          gps: true,
          iptc: true,
          jfif: true,
          icc: true,
          ifd1: true,
          xmp: true,
        } as any)

        context.setProgress(60)

        const secs: ExifSection[] = []

        if (!parsed) {
          secs.push({
            label: 'No Metadata',
            icon: Eye,
            fields: [{ label: 'Status', value: 'No EXIF data found in this image' }],
          })
          setSections(secs)
          context.setProgress(100)
          context.setResult(
            <Badge className="border-0 bg-amber-100 text-amber-700">
              No EXIF metadata found
            </Badge>,
          )
          return
        }

        // Basic image info
        const basicFields: ExifField[] = []
        if (parsed.ImageWidth || parsed.ifd0?.ImageWidth) {
          const w = parsed.ImageWidth || parsed.ifd0?.ImageWidth
          const h = parsed.ImageHeight || parsed.ifd0?.ImageHeight
          basicFields.push({ label: 'Dimensions', value: `${w} × ${h} px` })
        }
        if (parsed.ColorSpace) {
          basicFields.push({ label: 'Color Space', value: parsed.ColorSpace })
        }
        if (fileInfo) {
          basicFields.push({ label: 'File Size', value: formatSize(fileInfo.size) })
          basicFields.push({ label: 'File Type', value: fileInfo.type })
        }
        if (basicFields.length > 0) {
          secs.push({ label: 'Image Info', icon: ImageIcon, fields: basicFields })
        }

        // Camera info
        const cameraFields: ExifField[] = []
        const ifd0 = parsed.ifd0 || parsed
        if (ifd0.Make) cameraFields.push({ label: 'Make', value: String(ifd0.Make) })
        if (ifd0.Model) cameraFields.push({ label: 'Model', value: String(ifd0.Model) })
        if (parsed.FocalLength) cameraFields.push({ label: 'Focal Length', value: formatFocal(Number(parsed.FocalLength)) })
        if (parsed.FocalLengthIn35mmFilm) cameraFields.push({ label: '35mm Equivalent', value: formatFocal(Number(parsed.FocalLengthIn35mmFilm)) })
        if (ifd0.LensModel) cameraFields.push({ label: 'Lens', value: String(ifd0.LensModel) })
        if (cameraFields.length > 0) {
          secs.push({ label: 'Camera', icon: Camera, fields: cameraFields })
        }

        // Exposure settings
        const exposureFields: ExifField[] = []
        if (parsed.FNumber) exposureFields.push({ label: 'Aperture', value: `f/${Number(parsed.FNumber).toFixed(1)}` })
        if (parsed.ISO) exposureFields.push({ label: 'ISO', value: String(parsed.ISO) })
        if (parsed.ExposureTime) exposureFields.push({ label: 'Shutter Speed', value: formatExposure(Number(parsed.ExposureTime)) })
        if (parsed.ExposureProgram) {
          const programs: Record<number, string> = {
            1: 'Manual', 2: 'Program', 3: 'Aperture Priority', 4: 'Shutter Priority',
            5: 'Creative', 6: 'Action', 8: 'Portrait', 9: 'Landscape',
          }
          exposureFields.push({ label: 'Mode', value: programs[Number(parsed.ExposureProgram)] || `Mode ${parsed.ExposureProgram}` })
        }
        if (parsed.Flash) {
          const flash = Number(parsed.Flash)
          exposureFields.push({ label: 'Flash', value: (flash & 1) === 1 ? 'Fired' : 'Off' })
        }
        if (parsed.WhiteBalanceMode) {
          exposureFields.push({ label: 'White Balance', value: String(parsed.WhiteBalanceMode) })
        }
        if (parsed.ExposureCompensation) {
          exposureFields.push({ label: 'EV Bias', value: `${Number(parsed.ExposureCompensation) > 0 ? '+' : ''}${parsed.ExposureCompensation}` })
        }
        if (exposureFields.length > 0) {
          secs.push({ label: 'Exposure', icon: Settings, fields: exposureFields })
        }

        // Date/time
        const dateFields: ExifField[] = []
        if (parsed.DateTimeOriginal) dateFields.push({ label: 'Taken', value: String(parsed.DateTimeOriginal) })
        if (parsed.ModifyDate) dateFields.push({ label: 'Modified', value: String(parsed.ModifyDate) })
        if (parsed.DateTimeDigitized) dateFields.push({ label: 'Digitized', value: String(parsed.DateTimeDigitized) })
        if (dateFields.length > 0) {
          secs.push({ label: 'Date & Time', icon: Clock, fields: dateFields })
        }

        // GPS
        if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
          const gpsFields: ExifField[] = []
          gpsFields.push({ label: 'Coordinates', value: formatGPS(Number(parsed.latitude), Number(parsed.longitude)) })
          if (parsed.GPSAltitude !== undefined) {
            gpsFields.push({ label: 'Altitude', value: `${Number(parsed.GPSAltitude).toFixed(1)}m` })
          }
          if (parsed.GPSImgDirection !== undefined) {
            gpsFields.push({ label: 'Direction', value: `${Number(parsed.GPSImgDirection).toFixed(1)}°` })
          }
          secs.push({ label: 'Location', icon: MapPin, fields: gpsFields })
        }

        // Additional EXIF
        const extraFields: ExifField[] = []
        const extraKeys = ['MeteringMode', 'SceneType', 'CustomRendered', 'DigitalZoomRatio', 'SubjectDistance', 'MaxApertureValue', 'BrightnessValue']
        for (const key of extraKeys) {
          if (parsed[key] !== undefined) {
            extraFields.push({ label: key, value: String(parsed[key]) })
          }
        }
        if (extraFields.length > 0) {
          secs.push({ label: 'Additional', icon: FileDigit, fields: extraFields })
        }

        if (secs.length === 0) {
          secs.push({
            label: 'Parsed',
            icon: Eye,
            fields: [{ label: 'Note', value: 'Some metadata was parsed but no standard fields were found' }],
          })
        }

        setSections(secs)
        context.setProgress(100)
        context.setResult(
          <Badge className="border-0 bg-emerald-100 text-emerald-700">
            {secs.reduce((total, s) => total + s.fields.length, 0)} metadata fields extracted
          </Badge>,
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse EXIF data.'
        context.setError(msg)
        setSections([{ label: 'Error', icon: Eye, fields: [{ label: 'Error', value: msg }] }])
      }
    },
    [previewUrl, fileInfo],
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="image/*"
      maxFiles={1}
      onProcess={handleProcess}
      result={
        sections.length > 0 ? (
          <Card className="space-y-5">
            {fileInfo && (
              <div className="text-xs text-muted pb-3 border-b border-border">
                <span className="font-semibold text-text">{fileInfo.name}</span> • {formatSize(fileInfo.size)}
              </div>
            )}
            {sections.map((section, si) => {
              const Icon = section.icon
              return (
                <div key={si} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <Icon className="h-4 w-4 text-accent" />
                    {section.label}
                  </div>
                  <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-xs">
                    {section.fields.map((field, fi) => (
                      <>
                        <div key={`${fi}-k`} className="text-muted text-right">{field.label}</div>
                        <div key={fi} className="text-text break-all">{field.value}</div>
                      </>
                    ))}
                  </div>
                </div>
              )
            })}
          </Card>
        ) : null
      }
      options={
        <div className="space-y-4 text-sm">
          <Badge className="border-0 bg-accent/15 text-accent">
            Offline • Client-side parsing
          </Badge>
          <p className="text-xs text-muted">
            Upload a photo to view its embedded EXIF metadata including camera details, capture
            settings, GPS location, and more.
          </p>
        </div>
      }
    />
  )
}
