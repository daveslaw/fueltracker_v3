import { buildOcrResult, buildPosOcrResult } from './ocr-service'
import type { OcrResult, PosOcrResult, RawVisionResponse } from './ocr-service'

/**
 * Calls Google Cloud Vision API with the given image (base64 or URL).
 * Returns a structured OcrResult — never throws.
 */
async function callVisionApi(
  imageBase64: string,
  apiKey: string,
  featureType: 'DOCUMENT_TEXT_DETECTION' | 'TEXT_DETECTION'
): Promise<RawVisionResponse | null> {
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: featureType, maxResults: 10 }],
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    }
  )
  if (!res.ok) {
    console.error(`[OCR] Vision API HTTP ${res.status} (${featureType})`)
    return null
  }
  return res.json() as Promise<RawVisionResponse>
}

export async function extractMeterReading(imageBase64: string): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) {
    console.warn('[OCR] GOOGLE_CLOUD_VISION_API_KEY not set — falling back to manual entry')
    return { value: null, confidence: 0, status: 'unreadable' }
  }

  try {
    // Primary: DOCUMENT_TEXT_DETECTION handles dark/low-contrast displays better
    const raw = await callVisionApi(imageBase64, apiKey, 'DOCUMENT_TEXT_DETECTION')
    const result = raw ? buildOcrResult(raw) : null

    if (result && result.value !== null) return result

    // Fallback: TEXT_DETECTION uses a different model — try if primary found nothing
    console.warn('[OCR] DOCUMENT_TEXT_DETECTION found no value, retrying with TEXT_DETECTION')
    const raw2 = await callVisionApi(imageBase64, apiKey, 'TEXT_DETECTION')
    return raw2 ? buildOcrResult(raw2) : { value: null, confidence: 0, status: 'unreadable' }
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
