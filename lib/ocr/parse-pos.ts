import type { PosOcrResult, PosLine } from './ocr-service'

const FALLBACK: PosOcrResult = { lines: [], raw_text: '', status: 'unreadable' }
const VALID_GRADES = new Set(['95', '93', 'D10', 'D50'])

function parseNullableFloat(s: string): number | null {
  const t = s.trim()
  if (t.toUpperCase() === 'NULL') return null
  const n = parseFloat(t.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

/**
 * Pure function: parses Anthropic's structured text response from a fuel POS
 * Z-report photo. Expected format per line: "GRADE | LITRES_SOLD | REVENUE_ZAR"
 * (grade codes: 95, 93, D10, D50). Values may be NULL. Returns FALLBACK for
 * UNREADABLE or completely unparseable responses.
 */
export function parsePosText(text: string): PosOcrResult {
  const trimmed = text?.trim() ?? ''
  if (!trimmed || trimmed.toUpperCase() === 'UNREADABLE') return FALLBACK

  const lines: PosLine[] = []

  for (const raw of trimmed.split('\n')) {
    const parts = raw.split('|')
    if (parts.length < 3) continue

    const [gradePart, litresPart, revenuePart] = parts.map((p) => p.trim())
    const grade_id = gradePart.toUpperCase()
    if (!VALID_GRADES.has(grade_id)) continue

    const litres_sold = parseNullableFloat(litresPart)
    const revenue_zar = parseNullableFloat(revenuePart)
    lines.push({ grade_id, litres_sold, revenue_zar })
  }

  if (lines.length === 0) return { ...FALLBACK, raw_text: trimmed }

  const hasIncomplete = lines.some((l) => l.litres_sold === null || l.revenue_zar === null)
  const status = hasIncomplete ? 'needs_review' : 'auto'

  return { lines, raw_text: trimmed, status }
}
