export interface ValidityWindow {
  valid_from: string
  valid_to:   string | null
}

/** Returns the first row whose validity window contains `asOf`, or null. */
export function selectActiveAt<T extends ValidityWindow>(rows: T[], asOf: string): T | null {
  const asOfMs = new Date(asOf).getTime()
  return rows.find(r => {
    const fromMs = new Date(r.valid_from).getTime()
    const toMs   = r.valid_to ? new Date(r.valid_to).getTime() : null
    return fromMs <= asOfMs && (toMs === null || toMs > asOfMs)
  }) ?? null
}

/** Returns true if any row has valid_from strictly between startedAt and submittedAt. */
export function hasChangeInWindow(
  rows:        Pick<ValidityWindow, 'valid_from'>[],
  startedAt:   string,
  submittedAt: string,
): boolean {
  const startMs  = new Date(startedAt).getTime()
  const submitMs = new Date(submittedAt).getTime()
  return rows.some(r => {
    const fromMs = new Date(r.valid_from).getTime()
    return fromMs > startMs && fromMs < submitMs
  })
}

/** Returns true if newRow overlaps any row in existing (valid_to is exclusive). */
export function hasRangeOverlap(
  existing: Pick<ValidityWindow, 'valid_from' | 'valid_to'>[],
  newRow:   Pick<ValidityWindow, 'valid_from' | 'valid_to'>,
): boolean {
  const newFromMs = new Date(newRow.valid_from).getTime()
  const newToMs   = newRow.valid_to ? new Date(newRow.valid_to).getTime() : null
  return existing.some(e => {
    const eFromMs = new Date(e.valid_from).getTime()
    const eToMs   = e.valid_to ? new Date(e.valid_to).getTime() : null
    if (eToMs !== null && eToMs <= newFromMs) return false
    if (newToMs !== null && newToMs <= eFromMs) return false
    return true
  })
}
