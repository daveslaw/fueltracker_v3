import { describe, it, expect } from 'vitest'
import { buildInventorySnapshot } from '@/lib/owner-reports'
import type { InventorySnapshotInput } from '@/lib/owner-reports'

function makeInput(overrides: Partial<InventorySnapshotInput> = {}): InventorySnapshotInput {
  return {
    station_id:         'station-1',
    fuel_grade_id:      '95',
    closing_dip_litres: 15000,
    cost_per_litre:     14.00,
    ...overrides,
  }
}

// ── buildInventorySnapshot ────────────────────────────────────────────────────

describe('buildInventorySnapshot', () => {
  it('tracer bullet: computes total_value as litres × cost_per_litre', () => {
    const rows = buildInventorySnapshot([makeInput({ closing_dip_litres: 15000, cost_per_litre: 14.00 })])
    expect(rows[0].total_value_zar).toBeCloseTo(210000, 2)
  })

  it('passes through litres and cost_per_litre unchanged', () => {
    const rows = buildInventorySnapshot([makeInput({ closing_dip_litres: 8500, cost_per_litre: 16.50 })])
    expect(rows[0].litres).toBe(8500)
    expect(rows[0].cost_per_litre).toBe(16.50)
  })

  it('returns empty array for empty input', () => {
    expect(buildInventorySnapshot([])).toEqual([])
  })

  it('handles station with zero litres', () => {
    const rows = buildInventorySnapshot([makeInput({ closing_dip_litres: 0, cost_per_litre: 14.00 })])
    expect(rows[0].total_value_zar).toBe(0)
  })

  it('handles multiple grades at multiple stations independently', () => {
    const inputs: InventorySnapshotInput[] = [
      makeInput({ station_id: 'station-1', fuel_grade_id: '95',  closing_dip_litres: 10000, cost_per_litre: 14.00 }),
      makeInput({ station_id: 'station-1', fuel_grade_id: 'D50', closing_dip_litres:  5000, cost_per_litre: 16.00 }),
      makeInput({ station_id: 'station-2', fuel_grade_id: '95',  closing_dip_litres: 20000, cost_per_litre: 14.00 }),
    ]
    const rows = buildInventorySnapshot(inputs)
    expect(rows).toHaveLength(3)

    const find = (sid: string, grade: string) =>
      rows.find(r => r.station_id === sid && r.fuel_grade_id === grade)!

    expect(find('station-1', '95').total_value_zar).toBeCloseTo(140000, 2)
    expect(find('station-1', 'D50').total_value_zar).toBeCloseTo(80000, 2)
    expect(find('station-2', '95').total_value_zar).toBeCloseTo(280000, 2)
  })
})
