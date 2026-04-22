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

// ── POS Z-report types ────────────────────────────────────────────────────────

export type PosLine = {
  grade_id: string        // '95' | '93' | 'D10' | 'D50'
  litres_sold: number | null
  revenue_zar: number | null
}

export type PosOcrResult = {
  lines: PosLine[]
  raw_text: string
  status: 'auto' | 'needs_review' | 'unreadable'
}

// Grade keyword mapping: each entry lists lowercased substrings that identify
// that grade in a POS Z-report printout.
const GRADE_KEYWORDS: Array<{ grade_id: string; keywords: string[] }> = [
  { grade_id: '95',  keywords: ['petrol 95', 'unlead 95', '95 unl', ' 95 '] },
  { grade_id: '93',  keywords: ['petrol 93', 'unlead 93', '93 unl', ' 93 '] },
  { grade_id: 'D10', keywords: ['diesel 10', '10ppm', 'd10', 'die 10'] },
  { grade_id: 'D50', keywords: ['diesel 50', '50ppm', 'd50', 'die 50'] },
]

// ── buildPosOcrResult ─────────────────────────────────────────────────────────

/**
 * Pure function: parses a raw Google Cloud Vision response from a POS Z-report
 * photo into structured sales lines per fuel grade. Never throws.
 */
export function buildPosOcrResult(raw: RawVisionResponse): PosOcrResult {
  const FALLBACK: PosOcrResult = { lines: [], raw_text: '', status: 'unreadable' }

  try {
    if (!raw?.responses?.[0]) return FALLBACK

    const response = raw.responses[0]
    if (response.error) return FALLBACK

    const annotations = response.textAnnotations ?? []
    if (!annotations.length) return FALLBACK

    const raw_text = annotations[0].description ?? ''
    if (!raw_text.trim()) return FALLBACK

    const confidence =
      response.fullTextAnnotation?.pages?.[0]?.blocks?.[0]?.confidence ?? 0

    const textLower = raw_text.toLowerCase()
    const lines: PosLine[] = []

    for (const { grade_id, keywords } of GRADE_KEYWORDS) {
      // Find the line that contains a keyword for this grade
      const textLines = raw_text.split('\n')
      const matchedLine = textLines.find((line) => {
        const l = line.toLowerCase()
        return keywords.some((kw) => l.includes(kw))
      })

      if (!matchedLine) continue

      // Find where the keyword ends in the line so we only extract numbers
      // from the data section (avoids picking up the grade code, e.g. 95, 93)
      const lineLower = matchedLine.toLowerCase()
      let keywordEnd = 0
      for (const kw of keywords) {
        const idx = lineLower.indexOf(kw)
        if (idx >= 0) keywordEnd = Math.max(keywordEnd, idx + kw.length)
      }
      const dataSection = matchedLine.slice(keywordEnd)

      const nums = [...dataSection.matchAll(/\d+(?:\.\d+)?/g)]
        .map((m) => parseFloat(m[0]))
        .filter((n) => !isNaN(n))

      if (nums.length === 0) continue

      // Two numbers on line: smaller = litres_sold, larger = revenue_zar
      // (selling price × litres always makes revenue the larger value)
      const litres_sold = nums.length >= 1 ? Math.min(...nums) : null
      const revenue_zar = nums.length >= 2 ? Math.max(...nums) : null

      lines.push({ grade_id, litres_sold, revenue_zar })
    }

    if (lines.length === 0) return { ...FALLBACK, raw_text }

    const hasIncomplete = lines.some(
      (l) => l.litres_sold === null || l.revenue_zar === null
    )
    const status =
      hasIncomplete || confidence < CONFIDENCE_THRESHOLD ? 'needs_review' : 'auto'

    return { lines, raw_text, status }
  } catch {
    return FALLBACK
  }
}

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

    // Totalizer readings are always >= 1,000 L and typically whole numbers.
    // Prefer whole-number candidates in that range first to avoid picking up
    // small transaction amounts (e.g. 23.57 L) or pump label stickers (e.g. 5).
    const integers = numbers.filter((n) => n >= 1000 && Number.isInteger(n))
    const overThreshold = numbers.filter((n) => n >= 1000)
    const candidates = integers.length > 0 ? integers : overThreshold
    const value = candidates.length > 0 ? Math.max(...candidates) : Math.max(...numbers)

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
