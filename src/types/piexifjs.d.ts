declare module 'piexifjs' {
  export const ImageIFD: Record<string, number>
  export function load(imgData: string): any
  export function dump(exifObj: any): string
  export function insert(exifBytes: string, imgData: string): string
}
