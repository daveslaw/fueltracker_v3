import { describe, it, expect } from 'vitest'
import { parsePosText } from '@/lib/ocr/parse-pos'

describe('parsePosText', () => {
  it('UNREADABLE sentinel → unreadable fallback', () => {
    expect(parsePosText('UNREADABLE')).toEqual({ lines: [], raw_text: '', status: 'unreadable' })
  })

  it('empty string → unreadable', () => {
    expect(parsePosText('')).toEqual({ lines: [], raw_text: '', status: 'unreadable' })
  })

  it('single grade line → extracts grade, litres, revenue, status auto', () => {
    const result = parsePosText('95 | 500.50 | 18750.00')
    expect(result.status).toBe('auto')
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toEqual({ grade_id: '95', litres_sold: 500.5, revenue_zar: 18750 })
  })

  it('four grade lines → all extracted', () => {
    const text = [
      '95 | 1234.56 | 45678.90',
      '93 | 987.65 | 34567.89',
      'D10 | 2345.67 | 89012.34',
      'D50 | 1111.11 | 44444.44',
    ].join('\n')
    const result = parsePosText(text)
    expect(result.status).toBe('auto')
    expect(result.lines).toHaveLength(4)
    expect(result.lines.find((l) => l.grade_id === 'D50')?.revenue_zar).toBeCloseTo(44444.44)
  })

  it('NULL revenue → line included, status needs_review', () => {
    const result = parsePosText('95 | 500.50 | NULL')
    expect(result.lines[0].litres_sold).toBeCloseTo(500.5)
    expect(result.lines[0].revenue_zar).toBeNull()
    expect(result.status).toBe('needs_review')
  })

  it('NULL litres → line included, status needs_review', () => {
    const result = parsePosText('D50 | NULL | 29600.00')
    expect(result.lines[0].litres_sold).toBeNull()
    expect(result.lines[0].revenue_zar).toBeCloseTo(29600)
    expect(result.status).toBe('needs_review')
  })

  it('unknown grade code → line skipped', () => {
    const text = 'PREMIUM | 500 | 18000\n95 | 100 | 3750'
    const result = parsePosText(text)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].grade_id).toBe('95')
  })

  it('grade codes are case-insensitive', () => {
    const result = parsePosText('d50 | 800.00 | 29600.00')
    expect(result.lines[0].grade_id).toBe('D50')
    expect(result.lines[0].litres_sold).toBeCloseTo(800)
  })
})
