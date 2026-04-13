import { describe, it, expect } from 'vitest'
import type { ShiftBaselinesRepository, BaselineRow } from '@/lib/shift-baselines'

// ── In-memory fake ─────────────────────────────────────────────────────────────
// Tests the interface contract without touching Supabase.

function makeInMemoryRepo(): ShiftBaselinesRepository & { _rows: BaselineRow[] } {
  const rows: BaselineRow[] = []

  return {
    _rows: rows,

    async upsertPumpBaseline(stationId, pumpId, value) {
      const idx = rows.findIndex(r => r.station_id === stationId && r.pump_id === pumpId)
      const row: BaselineRow = { station_id: stationId, pump_id: pumpId, tank_id: null, reading_type: 'meter', value }
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      return {}
    },

    async upsertTankBaseline(stationId, tankId, value) {
      const idx = rows.findIndex(r => r.station_id === stationId && r.tank_id === tankId)
      const row: BaselineRow = { station_id: stationId, pump_id: null, tank_id: tankId, reading_type: 'dip', value }
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      return {}
    },

    async getBaselines(stationId) {
      return rows.filter(r => r.station_id === stationId)
    },
  }
}

// ── upsertPumpBaseline ────────────────────────────────────────────────────────

describe('upsertPumpBaseline', () => {
  it('tracer bullet: stores a meter reading for a pump', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertPumpBaseline('station-1', 'pump-1', 52000)

    const baselines = await repo.getBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0]).toMatchObject({
      pump_id:      'pump-1',
      tank_id:      null,
      reading_type: 'meter',
      value:        52000,
    })
  })

  it('overwrites an existing baseline for the same pump', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertPumpBaseline('station-1', 'pump-1', 50000)
    await repo.upsertPumpBaseline('station-1', 'pump-1', 52000)

    const baselines = await repo.getBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0].value).toBe(52000)
  })

  it('stores separate baselines for different pumps', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertPumpBaseline('station-1', 'pump-1', 50000)
    await repo.upsertPumpBaseline('station-1', 'pump-2', 30000)

    const baselines = await repo.getBaselines('station-1')
    expect(baselines).toHaveLength(2)
  })
})

// ── upsertTankBaseline ────────────────────────────────────────────────────────

describe('upsertTankBaseline', () => {
  it('stores a dip reading for a tank', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertTankBaseline('station-1', 'tank-1', 8000)

    const baselines = await repo.getBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0]).toMatchObject({
      pump_id:      null,
      tank_id:      'tank-1',
      reading_type: 'dip',
      value:        8000,
    })
  })

  it('overwrites an existing baseline for the same tank', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertTankBaseline('station-1', 'tank-1', 10000)
    await repo.upsertTankBaseline('station-1', 'tank-1', 8000)

    const baselines = await repo.getBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0].value).toBe(8000)
  })
})

// ── getBaselines ──────────────────────────────────────────────────────────────

describe('getBaselines', () => {
  it('returns empty array when no baselines set for station', async () => {
    const repo = makeInMemoryRepo()
    expect(await repo.getBaselines('station-1')).toEqual([])
  })

  it('returns only baselines for the requested station', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertPumpBaseline('station-1', 'pump-1', 50000)
    await repo.upsertPumpBaseline('station-2', 'pump-9', 99000)

    const baselines = await repo.getBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0].pump_id).toBe('pump-1')
  })

  it('returns both pump and tank baselines for a station', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertPumpBaseline('station-1', 'pump-1', 50000)
    await repo.upsertTankBaseline('station-1', 'tank-1', 8000)

    const baselines = await repo.getBaselines('station-1')
    expect(baselines).toHaveLength(2)
    expect(baselines.find(b => b.reading_type === 'meter')?.value).toBe(50000)
    expect(baselines.find(b => b.reading_type === 'dip')?.value).toBe(8000)
  })
})
