import { describe, it, expect } from 'vitest'
import { parseNozzlePosText } from '@/lib/ocr/parse-nozzle-pos'

describe('parseNozzlePosText', () => {
  it('UNREADABLE sentinel → unreadable fallback', () => {
    expect(parseNozzlePosText('UNREADABLE')).toEqual({ lines: [], raw_text: '', status: 'unreadable' })
  })

  it('empty string → unreadable', () => {
    expect(parseNozzlePosText('')).toEqual({ lines: [], raw_text: '', status: 'unreadable' })
  })

  it('single nozzle line with rate → extracts all fields, status auto', () => {
    const result = parseNozzlePosText('1 | 26.84 | 34.310 | 920.98')
    expect(result.status).toBe('auto')
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toEqual({
      nozzle_number: 1,
      extracted_rate: 26.84,
      litres_sold: 34.31,
      revenue_zar: 920.98,
    })
  })

  it('multiple nozzle lines → all extracted', () => {
    const text = [
      '1 | 26.84 | 34.310 | 920.98',
      '2 | 34.39 | 32.540 | 1119.05',
      '3 | 26.84 | 49.180 | 1320.00',
    ].join('\n')
    const result = parseNozzlePosText(text)
    expect(result.status).toBe('auto')
    expect(result.lines).toHaveLength(3)
    expect(result.lines[1].nozzle_number).toBe(2)
    expect(result.lines[1].extracted_rate).toBeCloseTo(34.39)
  })

  it('revenue with comma formatting → parsed correctly', () => {
    const result = parseNozzlePosText('2 | 34.39 | 32.540 | 1,119.05')
    expect(result.lines[0].revenue_zar).toBeCloseTo(1119.05)
  })

  it('non-contiguous nozzle numbers → no error, correct lines returned', () => {
    const text = ['1 | 26.84 | 34.310 | 920.98', '3 | 26.84 | 49.180 | 1320.00'].join('\n')
    const result = parseNozzlePosText(text)
    expect(result.status).toBe('auto')
    expect(result.lines).toHaveLength(2)
    expect(result.lines.map((l) => l.nozzle_number)).toEqual([1, 3])
  })

  it('NULL litres → status needs_review', () => {
    const result = parseNozzlePosText('1 | 26.84 | NULL | 920.98')
    expect(result.lines[0].litres_sold).toBeNull()
    expect(result.status).toBe('needs_review')
  })

  it('NULL revenue → status needs_review', () => {
    const result = parseNozzlePosText('1 | 26.84 | 34.310 | NULL')
    expect(result.lines[0].revenue_zar).toBeNull()
    expect(result.status).toBe('needs_review')
  })

  it('lines without enough pipe-separated values are skipped', () => {
    const text = ['bad line', '1 | 26.84 | 34.310 | 920.98'].join('\n')
    const result = parseNozzlePosText(text)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].nozzle_number).toBe(1)
  })

  it('lines sorted numerically — not lexicographically', () => {
    const text = [
      '10 | 26.84 | 111.000 | 2980.00',
      '2 | 34.39 | 32.540 | 1119.05',
      '1 | 26.84 | 34.310 | 920.98',
    ].join('\n')
    const result = parseNozzlePosText(text)
    expect(result.lines.map((l) => l.nozzle_number)).toEqual([1, 2, 10])
  })

  it('line without rate (3 parts) → extracted_rate is null', () => {
    const result = parseNozzlePosText('1 | 34.310 | 920.98')
    expect(result.lines[0].extracted_rate).toBeNull()
    expect(result.lines[0].litres_sold).toBeCloseTo(34.31)
    expect(result.lines[0].revenue_zar).toBeCloseTo(920.98)
  })

  it('no parseable lines → unreadable with raw_text preserved', () => {
    const result = parseNozzlePosText('not a nozzle line at all')
    expect(result.status).toBe('unreadable')
    expect(result.raw_text).toBe('not a nozzle line at all')
    expect(result.lines).toHaveLength(0)
  })
})
