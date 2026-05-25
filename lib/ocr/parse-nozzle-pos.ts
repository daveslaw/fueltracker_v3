export type NozzlePosLine = {
  nozzle_number: number
  litres_sold: number | null
  revenue_zar: number | null
  extracted_rate: number | null
}

export type NozzlePosOcrResult = {
  lines: NozzlePosLine[]
  raw_text: string
  status: 'auto' | 'needs_review' | 'unreadable'
}

const FALLBACK: NozzlePosOcrResult = { lines: [], raw_text: '', status: 'unreadable' }

function parseNullableFloat(s: string): number | null {
  const t = s.trim().replace(/,/g, '')
  if (t.toUpperCase() === 'NULL') return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}

/**
 * Pure function: parses Anthropic's structured text response from a nozzle-level
 * POS Z-report photo. Expected format per line: "NOZZLE | RATE | LITRES | REVENUE"
 * Returns FALLBACK for UNREADABLE or completely unparseable responses.
 */
export function parseNozzlePosText(text: string): NozzlePosOcrResult {
  const trimmed = text?.trim() ?? ''
  if (!trimmed || trimmed.toUpperCase() === 'UNREADABLE') return FALLBACK

  const lines: NozzlePosLine[] = []

  for (const raw of trimmed.split('\n')) {
    const parts = raw.split('|').map((p) => p.trim())
    if (parts.length < 3) continue

    const nozzle_number = parseInt(parts[0], 10)
    if (isNaN(nozzle_number)) continue

    if (parts.length >= 4) {
      lines.push({
        nozzle_number,
        extracted_rate: parseNullableFloat(parts[1]),
        litres_sold: parseNullableFloat(parts[2]),
        revenue_zar: parseNullableFloat(parts[3]),
      })
    } else {
      lines.push({
        nozzle_number,
        extracted_rate: null,
        litres_sold: parseNullableFloat(parts[1]),
        revenue_zar: parseNullableFloat(parts[2]),
      })
    }
  }

  lines.sort((a, b) => a.nozzle_number - b.nozzle_number)

  if (lines.length === 0) return { ...FALLBACK, raw_text: trimmed }

  const hasIncomplete = lines.some((l) => l.litres_sold === null || l.revenue_zar === null)
  const status = hasIncomplete ? 'needs_review' : 'auto'

  return { lines, raw_text: trimmed, status }
}
