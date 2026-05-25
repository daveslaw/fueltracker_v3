import { describe, it, expect } from 'vitest'
import { buildCsvFilename, reportRowsToCsv, formatDeliveriesCSV, formatDailyReconciliationCsv } from '../lib/csv-export'
import type { DeliveryReportRow } from '../lib/delivery-report'
import type { DailyReconciliationPumpRow } from '../lib/csv-export'

// ── buildCsvFilename ──────────────────────────────────────────────────────

describe('buildCsvFilename', () => {
  it('lowercases station name and replaces spaces with underscores', () => {
    const name = buildCsvFilename('daily', 'Elegant Amaglug', '2025-03-15')
    expect(name).toBe('elegant_amaglug_daily_2025-03-15.csv')
  })

  it('includes report type and date range in filename', () => {
    const name = buildCsvFilename('monthly', 'Speedway', '2025-03')
    expect(name).toBe('speedway_monthly_2025-03.csv')
  })
})

// ── reportRowsToCsv ───────────────────────────────────────────────────────

describe('reportRowsToCsv', () => {
  it('renders header row and data rows separated by newlines', () => {
    const csv = reportRowsToCsv(
      ['Date', 'Grade', 'Litres'],
      [['2025-03-01', '95', 2000]],
    )
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Date,Grade,Litres')
    expect(lines[1]).toBe('2025-03-01,95,2000')
  })

  it('quotes values that contain commas', () => {
    const csv = reportRowsToCsv(
      ['Station'],
      [['Elegant, Amaglug']],
    )
    expect(csv).toContain('"Elegant, Amaglug"')
  })

  it('quotes values that contain double-quotes and escapes them', () => {
    const csv = reportRowsToCsv(
      ['Note'],
      [['He said "yes"']],
    )
    expect(csv).toContain('"He said ""yes"""')
  })
})

// ── formatDeliveriesCSV ───────────────────────────────────────────────────────

const deliveryRow = (overrides: Partial<DeliveryReportRow> = {}): DeliveryReportRow => ({
  id: 'del-1',
  deliveredAt: '2026-05-01T08:00:00Z',
  stationId: 'station-1',
  stationName: 'Elegant Amaglug',
  tankLabel: 'Tank 1',
  fuelGrade: '95',
  litresReceived: 5000,
  deliveryNoteNumber: 'DN-001',
  driverName: 'John Smith',
  recordedByName: 'Jane Supervisor',
  deliveryNoteUrl: 'https://storage.example.com/note.jpg',
  ...overrides,
})

describe('formatDeliveriesCSV', () => {
  it('tracer bullet: produces a header row and one data row for a single delivery', () => {
    const csv = formatDeliveriesCSV([deliveryRow()])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('header row contains all expected column names in order', () => {
    const csv = formatDeliveriesCSV([deliveryRow()])
    const header = csv.split('\n')[0]
    expect(header).toBe('Date & Time,Station,Tank,Grade,Litres Received,Delivery Note #,Driver,Recorded By,Photo URL')
  })

  it('data row maps all fields correctly', () => {
    const csv = formatDeliveriesCSV([deliveryRow()])
    const dataLine = csv.split('\n')[1]
    expect(dataLine).toContain('2026-05-01T08:00:00Z')
    expect(dataLine).toContain('Elegant Amaglug')
    expect(dataLine).toContain('Tank 1')
    expect(dataLine).toContain('95')
    expect(dataLine).toContain('5000')
    expect(dataLine).toContain('DN-001')
    expect(dataLine).toContain('John Smith')
    expect(dataLine).toContain('Jane Supervisor')
    expect(dataLine).toContain('https://storage.example.com/note.jpg')
  })

  it('outputs a dash for rows where driverName is the normalised dash value', () => {
    const csv = formatDeliveriesCSV([deliveryRow({ driverName: '—' })])
    expect(csv).toContain('—')
  })

  it('outputs an empty string when deliveryNoteUrl is null', () => {
    const csv = formatDeliveriesCSV([deliveryRow({ deliveryNoteUrl: null })])
    const dataLine = csv.split('\n')[1]
    const cols = dataLine.split(',')
    expect(cols[cols.length - 1]).toBe('')
  })

  it('litresReceived is formatted as a plain number, not scientific notation', () => {
    const csv = formatDeliveriesCSV([deliveryRow({ litresReceived: 100000 })])
    expect(csv).toContain('100000')
    expect(csv).not.toContain('e+')
  })

  it('produces one data row per delivery', () => {
    const csv = formatDeliveriesCSV([deliveryRow({ id: 'del-1' }), deliveryRow({ id: 'del-2' })])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
  })
})

// ── formatDailyReconciliationCsv ──────────────────────────────────────────────

const pumpRow = (overrides: Partial<DailyReconciliationPumpRow> = {}): DailyReconciliationPumpRow => ({
  date:                 '2026-05-01',
  period:               'morning',
  pump_label:           'Pump 1',
  fuel_grade:           '95',
  meter_delta_litres:   2000,
  pos_litres_sold:      2000,
  variance_litres:      0,
  pos_revenue_zar:      34000,
  expected_revenue_zar: 34000,
  variance_zar:         0,
  ...overrides,
})

describe('formatDailyReconciliationCsv', () => {
  it('tracer bullet: produces a header row and one data row for a single pump line', () => {
    const csv = formatDailyReconciliationCsv([pumpRow()])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('header row contains pump_label and fuel_grade columns', () => {
    const csv = formatDailyReconciliationCsv([pumpRow()])
    const header = csv.split('\n')[0]
    expect(header).toContain('Pump')
    expect(header).toContain('Grade')
  })

  it('data row includes pump label and grade', () => {
    const csv = formatDailyReconciliationCsv([pumpRow({ pump_label: 'Pump 3', fuel_grade: 'D50' })])
    const data = csv.split('\n')[1]
    expect(data).toContain('Pump 3')
    expect(data).toContain('D50')
  })

  it('data row includes variance figures', () => {
    const csv = formatDailyReconciliationCsv([pumpRow({ variance_litres: -20, variance_zar: -340 })])
    const data = csv.split('\n')[1]
    expect(data).toContain('-20')
    expect(data).toContain('-340')
  })

  it('produces one data row per pump line', () => {
    const csv = formatDailyReconciliationCsv([pumpRow(), pumpRow({ pump_label: 'Pump 2' })])
    expect(csv.split('\n')).toHaveLength(3)
  })
})
