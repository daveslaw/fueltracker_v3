import { buildOcrResult, buildPosOcrResult } from './ocr-service'
import type { OcrResult, PosOcrResult, RawVisionResponse } from './ocr-service'

/**
 * Calls Google Cloud Vision API with the given image (base64 or URL).
 * Returns a structured OcrResult — never throws.
 */
export async function extractMeterReading(imageBase64: string): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) {
    console.warn('[OCR] GOOGLE_CLOUD_VISION_API_KEY not set — falling back to manual entry')
    return { value: null, confidence: 0, status: 'unreadable' }
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
            features: [{ type: 'TEXT_DETECTION', maxResults: 10 }],
          }],
        }),
        signal: AbortSignal.timeout(10_000), // 10 s timeout
      }
    )

    if (!res.ok) {
      console.error(`[OCR] Vision API HTTP ${res.status}`)
      return { value: null, confidence: 0, status: 'unreadable' }
    }

    const raw = (await res.json()) as RawVisionResponse
    return buildOcrResult(raw)
  } catch (err) {
    console.error('[OCR] Vision API error:', err)
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
            // DOCUMENT_TEXT_DETECTION preserves layout — better for Z-report tables
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
