import { describe, it, expect } from 'vitest'
import { validateUpload } from '../lib/upload-validation'

function makeFile(type: string, sizeBytes: number): File {
  return new File([new ArrayBuffer(sizeBytes)], 'photo.jpg', { type })
}

describe('validateUpload', () => {
  it('tracer bullet: valid JPEG under 5 MB → null', () => {
    const file = makeFile('image/jpeg', 1024)
    expect(validateUpload(file)).toBeNull()
  })

  it.each([
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ])('%s → null', (type) => {
    expect(validateUpload(makeFile(type, 1024))).toBeNull()
  })

  it('disallowed type (application/pdf) → error', () => {
    const result = validateUpload(makeFile('application/pdf', 1024))
    expect(result).not.toBeNull()
    expect(result!.error).toBeTruthy()
  })

  it('empty MIME type → error', () => {
    const result = validateUpload(makeFile('', 1024))
    expect(result).not.toBeNull()
    expect(result!.error).toBeTruthy()
  })

  it('file at exactly 5 MB → null (boundary: accepted)', () => {
    const MAX = 5 * 1024 * 1024
    expect(validateUpload(makeFile('image/jpeg', MAX))).toBeNull()
  })

  it('file at 5 MB + 1 byte → error (boundary: rejected)', () => {
    const OVER = 5 * 1024 * 1024 + 1
    const result = validateUpload(makeFile('image/jpeg', OVER))
    expect(result).not.toBeNull()
    expect(result!.error).toBeTruthy()
  })
})
