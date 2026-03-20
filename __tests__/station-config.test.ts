import { describe, it, expect } from 'vitest'
import { buildStationTree, validateStation, validateTank, validatePump } from '@/lib/station-config'

// ── Types ────────────────────────────────────────────────────────────────────

const GRADE_IDS = ['95', '93', 'D10', 'D50'] as const

// ── buildStationTree ─────────────────────────────────────────────────────────

describe('buildStationTree', () => {
  it('tracer bullet: single station with one tank and one pump', () => {
    const stations = [{ id: 's1', name: 'Alpha', address: null }]
    const tanks = [{ id: 't1', station_id: 's1', label: 'Tank 1', fuel_grade_id: '95', capacity_litres: 10000 }]
    const pumps = [{ id: 'p1', station_id: 's1', tank_id: 't1', label: 'Pump 1' }]

    const tree = buildStationTree(stations, tanks, pumps)

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('Alpha')
    expect(tree[0].tanks).toHaveLength(1)
    expect(tree[0].tanks[0].pumps).toHaveLength(1)
    expect(tree[0].tanks[0].pumps[0].label).toBe('Pump 1')
  })

  it('station with no tanks returns empty tanks array', () => {
    const stations = [{ id: 's1', name: 'Empty', address: null }]
    const tree = buildStationTree(stations, [], [])
    expect(tree[0].tanks).toEqual([])
  })

  it('tank with no pumps returns empty pumps array', () => {
    const stations = [{ id: 's1', name: 'A', address: null }]
    const tanks = [{ id: 't1', station_id: 's1', label: 'T1', fuel_grade_id: 'D50', capacity_litres: 5000 }]
    const tree = buildStationTree(stations, tanks, [])
    expect(tree[0].tanks[0].pumps).toEqual([])
  })

  it('pumps are attached to the correct tank, not cross-contaminated', () => {
    const stations = [{ id: 's1', name: 'A', address: null }]
    const tanks = [
      { id: 't1', station_id: 's1', label: 'T1', fuel_grade_id: '95',  capacity_litres: 10000 },
      { id: 't2', station_id: 's1', label: 'T2', fuel_grade_id: 'D10', capacity_litres: 10000 },
    ]
    const pumps = [
      { id: 'p1', station_id: 's1', tank_id: 't1', label: 'Pump 1' },
      { id: 'p2', station_id: 's1', tank_id: 't2', label: 'Pump 2' },
    ]
    const tree = buildStationTree(stations, tanks, pumps)
    expect(tree[0].tanks[0].pumps.map((p) => p.id)).toEqual(['p1'])
    expect(tree[0].tanks[1].pumps.map((p) => p.id)).toEqual(['p2'])
  })

  it('multiple stations are independent', () => {
    const stations = [
      { id: 's1', name: 'Alpha', address: null },
      { id: 's2', name: 'Beta',  address: null },
    ]
    const tanks = [
      { id: 't1', station_id: 's1', label: 'T1', fuel_grade_id: '95', capacity_litres: 10000 },
      { id: 't2', station_id: 's2', label: 'T2', fuel_grade_id: '93', capacity_litres: 10000 },
    ]
    const tree = buildStationTree(stations, tanks, [])
    expect(tree[0].tanks).toHaveLength(1)
    expect(tree[1].tanks).toHaveLength(1)
    expect(tree[0].tanks[0].id).toBe('t1')
    expect(tree[1].tanks[0].id).toBe('t2')
  })
})

// ── validateStation ──────────────────────────────────────────────────────────

describe('validateStation', () => {
  it('valid station returns null', () => {
    expect(validateStation({ name: 'Elegant Amaglug' })).toBeNull()
  })

  it('empty name returns error', () => {
    expect(validateStation({ name: '' })).toMatch(/name/)
  })

  it('whitespace-only name returns error', () => {
    expect(validateStation({ name: '   ' })).toMatch(/name/)
  })
})

// ── validateTank ─────────────────────────────────────────────────────────────

describe('validateTank', () => {
  it('valid tank returns null', () => {
    expect(validateTank({ label: 'Tank 1', fuel_grade_id: '95', capacity_litres: 10000 })).toBeNull()
  })

  it('empty label returns error', () => {
    expect(validateTank({ label: '', fuel_grade_id: '95', capacity_litres: 10000 })).toMatch(/label/)
  })

  it('unknown fuel grade returns error', () => {
    expect(validateTank({ label: 'T1', fuel_grade_id: 'E10', capacity_litres: 10000 })).toMatch(/grade/)
  })

  it('zero capacity returns error', () => {
    expect(validateTank({ label: 'T1', fuel_grade_id: '95', capacity_litres: 0 })).toMatch(/capacity/)
  })

  it('negative capacity returns error', () => {
    expect(validateTank({ label: 'T1', fuel_grade_id: '95', capacity_litres: -500 })).toMatch(/capacity/)
  })
})

// ── validatePump ─────────────────────────────────────────────────────────────

describe('validatePump', () => {
  it('valid pump returns null', () => {
    expect(validatePump({ label: 'Pump 1', tank_id: 'some-uuid' })).toBeNull()
  })

  it('empty label returns error', () => {
    expect(validatePump({ label: '', tank_id: 'some-uuid' })).toMatch(/label/)
  })

  it('missing tank_id returns error', () => {
    expect(validatePump({ label: 'Pump 1', tank_id: '' })).toMatch(/tank/)
  })
})
