import { describe, it, expect } from 'vitest'
import { computePriceChangeImpact } from '@/lib/owner-reports'
import type { PriceChangeBoundary } from '@/lib/owner-reports'

// A price change boundary is a point in the month where cost price changed
// for a specific grade at a station. The closing dip at that shift boundary
// is the inventory that experiences the price change.

function makeBoundary(overrides: Partial<PriceChangeBoundary> = {}): PriceChangeBoundary {
  return {
    station_id:       'station-1',
    fuel_grade_id:    '95',
    closing_dip_litres: 20000,
    old_cost_per_litre: 14.00,
    new_cost_per_litre: 15.00,
    ...overrides,
  }
}

// ── computePriceChangeImpact ──────────────────────────────────────────────────

describe('computePriceChangeImpact', () => {
  it('tracer bullet: positive price change yields a gain', () => {
    // closing_dip × (new_cost - old_cost) = 20000 × 1.00 = 20000
    const rows = computePriceChangeImpact([makeBoundary()])
    expect(rows[0].impact_zar).toBeCloseTo(20000, 2)
  })

  it('negative price change (cost reduction) yields a loss', () => {
    // 15000 × (13.00 - 14.50) = 15000 × -1.50 = -22500
    const rows = computePriceChangeImpact([
      makeBoundary({ closing_dip_litres: 15000, old_cost_per_litre: 14.50, new_cost_per_litre: 13.00 }),
    ])
    expect(rows[0].impact_zar).toBeCloseTo(-22500, 2)
  })

  it('no price change in month → empty result', () => {
    expect(computePriceChangeImpact([])).toEqual([])
  })

  it('zero closing dip → zero impact regardless of price change', () => {
    const rows = computePriceChangeImpact([makeBoundary({ closing_dip_litres: 0 })])
    expect(rows[0].impact_zar).toBe(0)
  })

  it('handles multiple boundaries across grades and stations independently', () => {
    const boundaries: PriceChangeBoundary[] = [
      makeBoundary({ station_id: 'station-1', fuel_grade_id: '95',  closing_dip_litres: 10000, old_cost_per_litre: 14.00, new_cost_per_litre: 15.00 }),
      makeBoundary({ station_id: 'station-1', fuel_grade_id: 'D50', closing_dip_litres:  5000, old_cost_per_litre: 16.00, new_cost_per_litre: 17.50 }),
      makeBoundary({ station_id: 'station-2', fuel_grade_id: '95',  closing_dip_litres: 20000, old_cost_per_litre: 14.00, new_cost_per_litre: 14.50 }),
    ]
    const rows = computePriceChangeImpact(boundaries)
    expect(rows).toHaveLength(3)

    const find = (sid: string, grade: string) =>
      rows.find(r => r.station_id === sid && r.fuel_grade_id === grade)!

    expect(find('station-1', '95').impact_zar).toBeCloseTo(10000, 2)
    expect(find('station-1', 'D50').impact_zar).toBeCloseTo(7500, 2)
    expect(find('station-2', '95').impact_zar).toBeCloseTo(10000, 2)
  })

  it('passes through station_id and fuel_grade_id on each result row', () => {
    const rows = computePriceChangeImpact([makeBoundary({ station_id: 'station-A', fuel_grade_id: 'D10' })])
    expect(rows[0].station_id).toBe('station-A')
    expect(rows[0].fuel_grade_id).toBe('D10')
  })
})
