export type OcrStatus = 'auto' | 'needs_review' | 'manual_override' | 'unreadable'

export type OcrResult = {
  value: number | null
  confidence: number
  status: OcrStatus
}

export type RawVisionResponse = {
  responses?: Array<{
    textAnnotations?: Array<{ description: string; confidence?: number }>
    fullTextAnnotation?: {
      pages: Array<{ blocks: Array<{ confidence: number }> }>
    }
    error?: { message: string }
  }>
} | null

const CONFIDENCE_THRESHOLD = 0.8

// ── buildOcrResult ────────────────────────────────────────────────────────────

/**
 * Pure function: converts a raw Google Cloud Vision API response into a
 * structured OCR result. Never throws — always returns a usable result.
 */
export function buildOcrResult(raw: RawVisionResponse): OcrResult {
  const FALLBACK: OcrResult = { value: null, confidence: 0, status: 'unreadable' }

  try {
    if (!raw?.responses?.[0]) return FALLBACK

    const response = raw.responses[0]
    if (response.error) return FALLBACK

    const annotations = response.textAnnotations ?? []
    if (!annotations.length) return FALLBACK

    // textAnnotations[0].description is the full text block
    const fullText = annotations[0].description ?? ''

    // Extract all decimal/integer numbers from the text
    const numbers = [...fullText.matchAll(/\d+(?:\.\d+)?/g)]
      .map((m) => parseFloat(m[0]))
      .filter((n) => !isNaN(n))

    if (!numbers.length) return FALLBACK

    // Pick the largest number — most likely the cumulative meter reading
    const value = Math.max(...numbers)

    // Confidence: use the first block's confidence if available
    const confidence =
      response.fullTextAnnotation?.pages?.[0]?.blocks?.[0]?.confidence ?? 0

    const status: OcrStatus =
      confidence >= CONFIDENCE_THRESHOLD ? 'auto' : 'needs_review'

    return { value, confidence, status }
  } catch {
    return FALLBACK
  }
}
