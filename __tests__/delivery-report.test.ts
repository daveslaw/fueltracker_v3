import { describe, it, expect } from 'vitest'
import { getDeliveryReport } from '../lib/delivery-report'

// Chainable Supabase mock — every method returns `this`, `order` resolves the promise
function makeDb(rows: object[], error?: object) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'gte', 'lte', 'eq', 'neq', 'is']
  methods.forEach(m => { chain[m] = () => chain })
  chain['order'] = () => Promise.resolve({ data: rows, error: error ?? null })
  return { from: () => chain } as any
}

const row = (overrides: Partial<RawRow> = {}): RawRow => ({
  id: 'del-1',
  litres_received: 5000,
  delivery_note_number: 'DN-001',
  driver_name: 'John Smith',
  delivery_note_url: 'https://storage.example.com/note.jpg',
  delivered_at: '2026-05-01T08:00:00Z',
  station_id: 'station-1',
  stations: { id: 'station-1', name: 'Elegant Amaglug' },
  tanks: { id: 'tank-1', label: 'Tank 1', fuel_grade_id: '95' },
  user_profiles: { email: 'jane@example.com' },
  ...overrides,
})

type RawRow = {
  id: string
  litres_received: number
  delivery_note_number: string
  driver_name: string | null
  delivery_note_url: string | null
  delivered_at: string
  station_id: string
  stations: { id: string; name: string }
  tanks: { id: string; label: string; fuel_grade_id: string }
  user_profiles: { email: string }
}

const params = {
  fromDate: '2026-05-01',
  toDate: '2026-05-31',
  page: 1,
  pageSize: 30,
}

// ── tracer bullet ──────────────────────────────────────────────────────────────

describe('getDeliveryReport', () => {
  it('tracer bullet: returns a mapped row for a single DB result', async () => {
    const db = makeDb([row()])
    const result = await getDeliveryReport(db, params)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe('del-1')
    expect(result.rows[0].stationName).toBe('Elegant Amaglug')
    expect(result.rows[0].fuelGrade).toBe('95')
    expect(result.rows[0].litresReceived).toBe(5000)
    expect(result.rows[0].deliveryNoteNumber).toBe('DN-001')
    expect(result.rows[0].driverName).toBe('John Smith')
    expect(result.rows[0].recordedByName).toBe('jane@example.com')
    expect(result.rows[0].deliveryNoteUrl).toBe('https://storage.example.com/note.jpg')
  })

  // ── pagination ──────────────────────────────────────────────────────────────

  it('returns only the requested page slice', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({ id: `del-${i + 1}`, delivered_at: `2026-05-0${5 - i}T08:00:00Z` }),
    )
    const db = makeDb(rows)
    const result = await getDeliveryReport(db, { ...params, page: 2, pageSize: 2 })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].id).toBe('del-3')
    expect(result.rows[1].id).toBe('del-4')
  })

  it('returns an empty rows array when page is beyond total', async () => {
    const db = makeDb([row()])
    const result = await getDeliveryReport(db, { ...params, page: 2, pageSize: 30 })

    expect(result.rows).toHaveLength(0)
  })

  // ── totals ──────────────────────────────────────────────────────────────────

  it('totalCount reflects the full set, not just the current page', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ id: `del-${i + 1}` }))
    const db = makeDb(rows)
    const result = await getDeliveryReport(db, { ...params, page: 1, pageSize: 2 })

    expect(result.totalCount).toBe(5)
  })

  it('totalLitres sums the full set across all pages', async () => {
    const rows = [
      row({ id: 'del-1', litres_received: 3000 }),
      row({ id: 'del-2', litres_received: 2000 }),
      row({ id: 'del-3', litres_received: 1000 }),
    ]
    const db = makeDb(rows)
    const result = await getDeliveryReport(db, { ...params, page: 1, pageSize: 2 })

    expect(result.totalLitres).toBe(6000)
  })

  it('totalPages is computed correctly', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => row({ id: `del-${i + 1}` }))
    const db = makeDb(rows)
    const result = await getDeliveryReport(db, { ...params, page: 1, pageSize: 3 })

    expect(result.totalPages).toBe(3)
  })

  // ── per-station subtotals ────────────────────────────────────────────────────

  it('computes per-station subtotals across all matching rows', async () => {
    const rows = [
      row({ id: 'del-1', station_id: 'station-1', litres_received: 4000, stations: { id: 'station-1', name: 'Elegant Amaglug' } }),
      row({ id: 'del-2', station_id: 'station-2', litres_received: 6000, stations: { id: 'station-2', name: 'Speedway' } }),
      row({ id: 'del-3', station_id: 'station-1', litres_received: 2000, stations: { id: 'station-1', name: 'Elegant Amaglug' } }),
    ]
    const db = makeDb(rows)
    const result = await getDeliveryReport(db, params)

    expect(result.stationSubtotals['station-1']).toEqual({ stationName: 'Elegant Amaglug', litres: 6000 })
    expect(result.stationSubtotals['station-2']).toEqual({ stationName: 'Speedway', litres: 6000 })
  })

  // ── null driver name ────────────────────────────────────────────────────────

  it('normalises null driver_name to a dash', async () => {
    const db = makeDb([row({ driver_name: null })])
    const result = await getDeliveryReport(db, params)

    expect(result.rows[0].driverName).toBe('—')
  })

  // ── error handling ──────────────────────────────────────────────────────────

  it('throws when the DB returns an error', async () => {
    const db = makeDb([], { message: 'connection refused', code: '08000' })
    await expect(getDeliveryReport(db, params)).rejects.toThrow()
  })
})
