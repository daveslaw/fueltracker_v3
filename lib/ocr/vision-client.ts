import Anthropic from '@anthropic-ai/sdk'
import { buildPosOcrResult } from './ocr-service'
import type { OcrResult, PosOcrResult, RawVisionResponse } from './ocr-service'

const anthropic = new Anthropic()

export async function extractMeterReading(imageBase64: string): Promise<OcrResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[OCR] ANTHROPIC_API_KEY not set — falling back to manual entry')
    return { value: null, confidence: 0, status: 'unreadable' }
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          },
          {
            type: 'text',
            text: 'This is a photo of a fuel pump dispenser. List every number you can read in the image, one per line, digits only (no units, no labels). If you cannot read any numbers at all, return UNREADABLE.',
          },
        ],
      }],
    })

    const text = (message.content[0] as { type: 'text'; text: string }).text.trim()

    if (!text || text.toUpperCase() === 'UNREADABLE') {
      return { value: null, confidence: 0, status: 'unreadable' }
    }

    const numbers = [...text.matchAll(/\d+(?:\.\d+)?/g)]
      .map((m) => parseFloat(m[0]))
      .filter((n) => !isNaN(n))

    if (!numbers.length) return { value: null, confidence: 0, status: 'unreadable' }

    // Prefer whole-number integers >= 1000 (totalizer pattern).
    // Falls back to any number >= 1000, then largest overall.
    const integers = numbers.filter((n) => n >= 1000 && Number.isInteger(n))
    const overThreshold = numbers.filter((n) => n >= 1000)
    const candidates = integers.length > 0 ? integers : overThreshold
    const value = candidates.length > 0 ? Math.max(...candidates) : Math.max(...numbers)

    return { value, confidence: 0.95, status: 'auto' }
  } catch (err) {
    console.error('[OCR] Anthropic API error:', err)
    return { value: null, confidence: 0, status: 'unreadable' }
  }
}

/**
 * Calls Google Cloud Vision API on a POS Z-report image.
 * Returns structured sales lines per fuel grade — never throws.
 */
export async function extractPosLines(imageBase64: string): Promise<PosOcrResult> {
  const FALLBACK: PosOcrResult = { lines: [], raw_text: '', status: 'unreadable' }
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) {
    console.warn('[OCR] GOOGLE_CLOUD_VISION_API_KEY not set — falling back to manual entry')
    return FALLBACK
  }

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      }
    )

    if (!res.ok) {
      console.error(`[OCR] Vision API HTTP ${res.status}`)
      return FALLBACK
    }

    const raw = (await res.json()) as RawVisionResponse
    return buildPosOcrResult(raw)
  } catch (err) {
    console.error('[OCR] Vision API error:', err)
    return FALLBACK
  }
}
