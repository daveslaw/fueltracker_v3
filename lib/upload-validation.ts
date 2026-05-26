export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024

export const UPLOAD_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

export function validateUpload(file: File): { error: string } | null {
  if (!UPLOAD_ALLOWED_TYPES.includes(file.type)) {
    return { error: `File type not allowed. Accepted: JPEG, PNG, WebP, HEIC.` }
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return { error: `File too large. Maximum size is 5 MB.` }
  }
  return null
}
