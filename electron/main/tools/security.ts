import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'stream/promises'

export type ChecksumPayload = {
  inputPaths: string[]
  algorithm: 'md5' | 'sha1' | 'sha256'
}

export type SecurityProcessPayload = {
  mode: 'encrypt' | 'decrypt'
  file: string
  password: string
  output: string
}

export async function checksumFiles({ inputPaths, algorithm }: ChecksumPayload) {
  if (!inputPaths.length) throw new Error('No files provided.')

  const items = []

  for (const filePath of inputPaths) {
    const hash = createHash(algorithm)
    const stream = createReadStream(filePath)
    try {
      for await (const chunk of stream) {
        hash.update(chunk)
      }
      items.push({ path: filePath, [algorithm]: hash.digest('hex') })
    } catch (err) {
      // Ensure stream cleanup on error
      stream.destroy()
      throw err
    }
  }

  return { algorithm, items }
}

export async function processSecurity({ mode, file, password, output }: SecurityProcessPayload) {
  if (mode === 'encrypt') {
    const salt = randomBytes(16)
    const iv = randomBytes(12)
    const key = scryptSync(password, salt, 32)
    const cipher = createCipheriv('aes-256-gcm', key, iv)

    const inputStream = createReadStream(file)
    const outputStream = createWriteStream(output)

    try {
      // Write header (salt + iv) before streaming data
      outputStream.write(Buffer.concat([salt, iv]))
      // Stream file through cipher into output
      await pipeline(inputStream, cipher, outputStream)
      // Append auth tag after ciphertext (new streaming-friendly format)
      const tag = cipher.getAuthTag()
      await fs.appendFile(output, tag)
      return { success: true, path: output }
    } catch (err) {
      // Ensure partial file is removed
      await fs.unlink(output).catch(() => {})
      throw err
    }
  } else {
    // Decrypt with auto-detection of format:
    // Legacy: salt(16) + iv(12) + tag(16) + ciphertext
    // New:    salt(16) + iv(12) + ciphertext + tag(16)
    const stats = await fs.stat(file)
    if (stats.size < 44) throw new Error('File too small to be valid encrypted data.')

    const header = Buffer.alloc(44)
    const headerFd = await fs.open(file, 'r')
    await headerFd.read(header, 0, 44, 0)
    await headerFd.close()

    const salt = header.subarray(0, 16)
    const iv = header.subarray(16, 28)
    const key = scryptSync(password, salt, 32)

    // Helper to attempt decryption with given tag and ciphertext range
    async function attemptDecrypt(tag: Buffer, cipherStart: number, cipherEnd: number | undefined): Promise<boolean> {
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(tag)

        const inStream = createReadStream(file, { start: cipherStart, end: cipherEnd })
        const outStream = createWriteStream(output)

        await pipeline(inStream, decipher, outStream)
        return true
      } catch {
        await fs.unlink(output).catch(() => {})
        return false
      }
    }

    // Special case: empty plaintext (ciphertext length 0) -> file size exactly 44
    if (stats.size === 44) {
      const oldTag = header.subarray(28, 44)
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(oldTag)
      try {
        await new Promise<void>((resolve, reject) => {
          decipher.on('error', reject)
          decipher.end()
          decipher.on('finish', resolve)
        })
        await fs.writeFile(output, '')
        return { success: true, path: output }
      } catch {
        throw new Error('Decryption failed: invalid password or corrupted file.')
      }
    }

    // Try legacy format: tag in header, ciphertext from offset 44 to EOF
    const oldTag = header.subarray(28, 44)
    if (await attemptDecrypt(oldTag, 44, undefined)) {
      return { success: true, path: output }
    }

    // Try new streaming format: tag at EOF, ciphertext from offset 28 to size-16
    const tail = Buffer.alloc(16)
    const tailFd = await fs.open(file, 'r')
    await tailFd.read(tail, 0, 16, stats.size - 16)
    await tailFd.close()
    const newCipherStart = 28
    const newCipherEnd = stats.size - 16 - 1 // inclusive end for createReadStream
    if (await attemptDecrypt(tail, newCipherStart, newCipherEnd)) {
      return { success: true, path: output }
    }

    throw new Error('Decryption failed: invalid password or corrupted file.')
  }
}
