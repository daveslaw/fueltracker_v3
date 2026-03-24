import { describe, it, expect } from 'vitest'
import {
  buildTankTrendSeries,
  applyDateRangePreset,
  buildDeliveryMarkers,
} from '../lib/tank-trends'

// --- fixtures ---
const dip = (tank_id: string, shift_date: string, litres: number) => ({ tank_id, shift_date, litres })
const tank = (id: string, label: string, capacity_litres: number) => ({ id, label, capacity_litres })
const delivery = (tank_id: string, litres_received: number, delivered_at: string) => ({ tank_id, litres_received, delivered_at })

// ── buildTankTrendSeries ──────────────────────────────────────────────────

describe('buildTankTrendSeries', () => {
  it('returns one series per tank with points spanning the full date range', () => {
    const result = buildTankTrendSeries(
      [dip('T1', '2025-03-17', 8000), dip('T1', '2025-03-18', 7500)],
      [tank('T1', 'Tank 1 (95)', 30000)],
      '2025-03-17', '2025-03-18',
    )
    expect(result).toHaveLength(1)
    expect(result[0].tankId).toBe('T1')
    expect(result[0].capacityLitres).toBe(30000)
    expect(result[0].points).toHaveLength(2)
    expect(result[0].points[0]).toEqual({ date: '2025-03-17', litres: 8000 })
    expect(result[0].points[1]).toEqual({ date: '2025-03-18', litres: 7500 })
  })

  it('inserts null for dates with no dip reading', () => {
    const result = buildTankTrendSeries(
      [dip('T1', '2025-03-17', 8000)],
      [tank('T1', 'Tank 1', 30000)],
      '2025-03-17', '2025-03-19',  // 3 days, only first has data
    )
    expect(result[0].points).toHaveLength(3)
    expect(result[0].points[0].litres).toBe(8000)
    expect(result[0].points[1].litres).toBeNull()
    expect(result[0].points[2].litres).toBeNull()
  })

  it('returns a separate series for each tank', () => {
    const result = buildTankTrendSeries(
      [dip('T1', '2025-03-17', 8000), dip('T2', '2025-03-17', 5000)],
      [tank('T1', 'Tank 1', 30000), tank('T2', 'Tank 2', 20000)],
      '2025-03-17', '2025-03-17',
    )
    expect(result).toHaveLength(2)
    expect(result.map(s => s.tankId)).toEqual(['T1', 'T2'])
    expect(result[0].points[0].litres).toBe(8000)
    expect(result[1].points[0].litres).toBe(5000)
  })
})

// ── applyDateRangePreset ──────────────────────────────────────────────────

describe('applyDateRangePreset', () => {
  it('7d preset returns last 7 days inclusive (from = today − 6)', () => {
    const result = applyDateRangePreset('7d', '2025-03-23')
    expect(result.from).toBe('2025-03-17')
    expect(result.to).toBe('2025-03-23')
  })

  it('30d preset returns last 30 days inclusive (from = today − 29)', () => {
    const result = applyDateRangePreset('30d', '2025-03-23')
    expect(result.from).toBe('2025-02-22')
    expect(result.to).toBe('2025-03-23')
  })

  it('custom preset passes through the provided from/to', () => {
    const result = applyDateRangePreset('custom', '2025-03-23', '2025-01-01', '2025-03-01')
    expect(result.from).toBe('2025-01-01')
    expect(result.to).toBe('2025-03-01')
  })
})

// ── buildDeliveryMarkers ──────────────────────────────────────────────────

describe('buildDeliveryMarkers', () => {
  it('filters deliveries to the given date range and sorts by date', () => {
    const result = buildDeliveryMarkers(
      [
        delivery('T1', 5000, '2025-03-15T09:00:00Z'),  // before range
        delivery('T1', 8000, '2025-03-18T10:00:00Z'),
        delivery('T2', 3000, '2025-03-17T14:00:00Z'),
        delivery('T1', 2000, '2025-03-25T08:00:00Z'),  // after range
      ],
      '2025-03-17', '2025-03-20',
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2025-03-17', tankId: 'T2', litresReceived: 3000 })
    expect(result[1]).toEqual({ date: '2025-03-18', tankId: 'T1', litresReceived: 8000 })
  })

  it('returns empty array when no deliveries fall in range', () => {
    const result = buildDeliveryMarkers(
      [delivery('T1', 5000, '2025-03-10T09:00:00Z')],
      '2025-03-17', '2025-03-20',
    )
    expect(result).toHaveLength(0)
  })
})
