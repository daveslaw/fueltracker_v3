import type { NozzlePosLine } from './ocr/parse-nozzle-pos'

export const RATE_TOLERANCE_ZAR = 0.05

export type PumpMeta = {
  id: string
  label: string
}

export type MatchResult = {
  matched: Array<{ pump: PumpMeta; line: NozzlePosLine }>
  unmatched: NozzlePosLine[]
}

/**
 * Matches OCR nozzle lines to pumps by comparing nozzle_number against
 * parseInt(pump.label). Returns matched pairs and unmatched nozzle lines.
 * Pumps with no corresponding nozzle line appear in neither array.
 */
export function matchNozzlesToPumps(
  nozzleLines: NozzlePosLine[],
  pumps: PumpMeta[],
): MatchResult {
  const pumpByNozzle = new Map(pumps.map(p => [parseInt(p.label.replace(/\D/g, ''), 10), p]))
  const matched: MatchResult['matched'] = []
  const unmatched: NozzlePosLine[] = []

  for (const line of nozzleLines) {
    const pump = pumpByNozzle.get(line.nozzle_number)
    if (pump) matched.push({ pump, line })
    else unmatched.push(line)
  }

  return { matched, unmatched }
}

/**
 * Returns true if the extracted rate differs from the configured price by more
 * than RATE_TOLERANCE_ZAR. Returns false for null extracted rates (cannot check).
 */
export function isRateMismatch(
  extractedRate: number | null,
  configuredPrice: number,
): boolean {
  if (extractedRate === null) return false
  return Math.abs(extractedRate - configuredPrice) > RATE_TOLERANCE_ZAR
}
