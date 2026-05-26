import { describe, it, expect } from 'vitest'
import { matchNozzlesToPumps, isRateMismatch, RATE_TOLERANCE_ZAR } from '@/lib/pos-capture'
import type { NozzlePosLine } from '@/lib/ocr/parse-nozzle-pos'

function makeLine(nozzle_number: number, overrides: Partial<NozzlePosLine> = {}): NozzlePosLine {
  return {
    nozzle_number,
    litres_sold: 100,
    revenue_zar: 2684,
    extracted_rate: 26.84,
    ...overrides,
  }
}

// ── matchNozzlesToPumps ───────────────────────────────────────────────────────

describe('matchNozzlesToPumps', () => {
  it('nozzle number matches pump with same numeric label', () => {
    const pumps = [{ id: 'p1', label: '1' }]
    const { matched, unmatched } = matchNozzlesToPumps([makeLine(1)], pumps)
    expect(matched).toHaveLength(1)
    expect(matched[0].pump.id).toBe('p1')
    expect(matched[0].line.nozzle_number).toBe(1)
    expect(unmatched).toHaveLength(0)
  })

  it('nozzle with no matching pump goes to unmatched', () => {
    const pumps = [{ id: 'p1', label: '1' }]
    const { matched, unmatched } = matchNozzlesToPumps([makeLine(3)], pumps)
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
    expect(unmatched[0].nozzle_number).toBe(3)
  })

  it('non-contiguous nozzle numbers produce no errors and match correctly', () => {
    const pumps = [{ id: 'p1', label: '1' }, { id: 'p3', label: '3' }]
    const lines = [makeLine(1), makeLine(3)]
    const { matched, unmatched } = matchNozzlesToPumps(lines, pumps)
    expect(matched).toHaveLength(2)
    expect(unmatched).toHaveLength(0)
    expect(matched.map(m => m.pump.id)).toEqual(['p1', 'p3'])
  })

  it('pump with no nozzle line appears in neither matched nor unmatched', () => {
    const pumps = [{ id: 'p1', label: '1' }, { id: 'p2', label: '2' }]
    const { matched, unmatched } = matchNozzlesToPumps([makeLine(1)], pumps)
    expect(matched).toHaveLength(1)
    expect(unmatched).toHaveLength(0)
    expect(matched[0].pump.id).toBe('p1')
  })

  it('empty nozzle lines returns empty matched and unmatched', () => {
    const pumps = [{ id: 'p1', label: '1' }]
    const { matched, unmatched } = matchNozzlesToPumps([], pumps)
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(0)
  })

  it('matches using parseInt so pump label "02" matches nozzle 2', () => {
    const pumps = [{ id: 'p2', label: '02' }]
    const { matched } = matchNozzlesToPumps([makeLine(2)], pumps)
    expect(matched).toHaveLength(1)
    expect(matched[0].pump.id).toBe('p2')
  })

  it('"Pump 1" style label matches nozzle 1', () => {
    const pumps = [{ id: 'p1', label: 'Pump 1' }]
    const { matched, unmatched } = matchNozzlesToPumps([makeLine(1)], pumps)
    expect(matched).toHaveLength(1)
    expect(matched[0].pump.id).toBe('p1')
    expect(unmatched).toHaveLength(0)
  })

  it('"Pump 10" style label matches nozzle 10', () => {
    const pumps = [{ id: 'p10', label: 'Pump 10' }]
    const { matched, unmatched } = matchNozzlesToPumps([makeLine(10)], pumps)
    expect(matched).toHaveLength(1)
    expect(matched[0].pump.id).toBe('p10')
    expect(unmatched).toHaveLength(0)
  })

  it('all "Pump N" labels — matches all nozzles, none unmatched', () => {
    const pumps = [
      { id: 'p1', label: 'Pump 1' },
      { id: 'p2', label: 'Pump 2' },
      { id: 'p3', label: 'Pump 3' },
    ]
    const lines = [makeLine(1), makeLine(2), makeLine(3)]
    const { matched, unmatched } = matchNozzlesToPumps(lines, pumps)
    expect(matched).toHaveLength(3)
    expect(unmatched).toHaveLength(0)
    expect(matched.map(m => m.pump.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('"Pump N" label — nozzle with no matching pump still goes to unmatched', () => {
    const pumps = [{ id: 'p1', label: 'Pump 1' }]
    const { matched, unmatched } = matchNozzlesToPumps([makeLine(5)], pumps)
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
    expect(unmatched[0].nozzle_number).toBe(5)
  })
})

// ── isRateMismatch ────────────────────────────────────────────────────────────

describe('isRateMismatch', () => {
  it('difference exceeding RATE_TOLERANCE_ZAR is a mismatch', () => {
    expect(isRateMismatch(26.84, 26.84 + RATE_TOLERANCE_ZAR + 0.01)).toBe(true)
  })

  it('difference within tolerance is not a mismatch', () => {
    expect(isRateMismatch(26.84, 26.84 + RATE_TOLERANCE_ZAR - 0.001)).toBe(false)
  })

  it('exact match is not a mismatch', () => {
    expect(isRateMismatch(26.84, 26.84)).toBe(false)
  })

  it('null extracted rate is never a mismatch (cannot check)', () => {
    expect(isRateMismatch(null, 26.84)).toBe(false)
  })
})
