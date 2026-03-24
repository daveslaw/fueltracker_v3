import { describe, it, expect } from 'vitest'
import { buildCsvFilename, reportRowsToCsv } from '../lib/csv-export'

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
