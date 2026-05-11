import type { OcrResult } from './ocr-service'

const FALLBACK: OcrResult = { value: null, confidence: 0, status: 'unreadable' }

export function parseMeterText(text: string): OcrResult {
  const trimmed = text?.trim() ?? ''
  if (!trimmed || trimmed.toUpperCase() === 'UNREADABLE') return FALLBACK

  const numbers = [...trimmed.matchAll(/\d+(?:\.\d+)?/g)]
    .map((m) => parseFloat(m[0]))
    .filter((n) => !isNaN(n))

  if (!numbers.length) return FALLBACK

  // Prefer whole-number integers >= 1000 (totalizer pattern).
  // Falls back to any number >= 1000, then largest overall.
  const integers = numbers.filter((n) => n >= 1000 && Number.isInteger(n))
  const overThreshold = numbers.filter((n) => n >= 1000)
  const candidates = integers.length > 0 ? integers : overThreshold
  const value = candidates.length > 0 ? Math.max(...candidates) : Math.max(...numbers)

  return { value, confidence: 0.95, status: 'auto' }
}
