import { describe, it, expect } from 'vitest'
import { buildPosOcrResult } from '@/lib/ocr/ocr-service'
import type { RawVisionResponse } from '@/lib/ocr/ocr-service'

const HIGH_CONF = 0.95
const LOW_CONF  = 0.55

function visionText(text: string, confidence: number): RawVisionResponse {
  return {
    responses: [{
      textAnnotations: [{ description: text }],
      fullTextAnnotation: {
        pages: [{ blocks: [{ confidence }] }],
      },
    }],
  }
}

// ── buildPosOcrResult ─────────────────────────────────────────────────────────

describe('buildPosOcrResult', () => {
  // Tracer bullet — clean Z-report with all four grades
  it('clean Z-report → extracts all four grade lines, status auto', () => {
    const text = [
      'PETROL 95 UNLEAD   1234.56 L   45678.90',
      'PETROL 93 UNLEAD    987.65 L   34567.89',
      'DIESEL 10PPM       2345.67 L   89012.34',
      'DIESEL 50PPM       1111.11 L   44444.44',
    ].join('\n')

    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    expect(result.status).toBe('auto')
    expect(result.lines).toHaveLength(4)

    const g95 = result.lines.find((l) => l.grade_id === '95')
    expect(g95?.litres_sold).toBeCloseTo(1234.56)
    expect(g95?.revenue_zar).toBeCloseTo(45678.90)

    const g93 = result.lines.find((l) => l.grade_id === '93')
    expect(g93?.litres_sold).toBeCloseTo(987.65)
    expect(g93?.revenue_zar).toBeCloseTo(34567.89)

    const gD10 = result.lines.find((l) => l.grade_id === 'D10')
    expect(gD10?.litres_sold).toBeCloseTo(2345.67)
    expect(gD10?.revenue_zar).toBeCloseTo(89012.34)

    const gD50 = result.lines.find((l) => l.grade_id === 'D50')
    expect(gD50?.litres_sold).toBeCloseTo(1111.11)
    expect(gD50?.revenue_zar).toBeCloseTo(44444.44)
  })

  it('only grades present at station → returns only those lines', () => {
    // Station with only 95 and D50
    const text = [
      'PETROL 95   500.00   18750.00',
      'DIESEL 50   800.00   29600.00',
    ].join('\n')

    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    expect(result.lines.map((l) => l.grade_id).sort()).toEqual(['95', 'D50'])
  })

  it('low-confidence scan → extracts values but status needs_review', () => {
    const text = 'PETROL 95   500.00   18750.00'
    const result = buildPosOcrResult(visionText(text, LOW_CONF))
    expect(result.status).toBe('needs_review')
    const g95 = result.lines.find((l) => l.grade_id === '95')
    expect(g95?.litres_sold).toBeCloseTo(500.00)
    expect(g95?.revenue_zar).toBeCloseTo(18750.00)
  })

  it('grade present but only one number on line → litres_sold set, revenue_zar null', () => {
    const text = 'PETROL 95   500.00'
    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    const g95 = result.lines.find((l) => l.grade_id === '95')
    expect(g95?.litres_sold).toBeCloseTo(500.00)
    expect(g95?.revenue_zar).toBeNull()
    expect(result.status).toBe('needs_review')
  })

  it('no grade keywords found → empty lines, status unreadable', () => {
    const text = 'TOTAL SALES: 1234\nCASH: 5678'
    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    expect(result.lines).toHaveLength(0)
    expect(result.status).toBe('unreadable')
  })

  it('null response → unreadable', () => {
    const result = buildPosOcrResult(null)
    expect(result.lines).toHaveLength(0)
    expect(result.status).toBe('unreadable')
    expect(result.raw_text).toBe('')
  })

  it('API error → unreadable', () => {
    const result = buildPosOcrResult({
      responses: [{ error: { message: 'quota exceeded' } }],
    })
    expect(result.status).toBe('unreadable')
    expect(result.lines).toHaveLength(0)
  })

  it('raw_text is preserved in result', () => {
    const text = 'PETROL 95   500.00   18750.00'
    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    expect(result.raw_text).toBe(text)
  })

  it('grade keywords are case-insensitive', () => {
    const text = 'petrol 95   250.00   9375.00'
    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    const g95 = result.lines.find((l) => l.grade_id === '95')
    expect(g95?.litres_sold).toBeCloseTo(250.00)
  })

  it('D10 matched by "10ppm" keyword', () => {
    const text = 'DIESEL 10PPM   1500.00   55500.00'
    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    const gD10 = result.lines.find((l) => l.grade_id === 'D10')
    expect(gD10?.litres_sold).toBeCloseTo(1500.00)
    expect(gD10?.revenue_zar).toBeCloseTo(55500.00)
  })

  it('D50 matched by "50ppm" keyword', () => {
    const text = 'DIESEL 50PPM   2000.00   74000.00'
    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    const gD50 = result.lines.find((l) => l.grade_id === 'D50')
    expect(gD50?.litres_sold).toBeCloseTo(2000.00)
    expect(gD50?.revenue_zar).toBeCloseTo(74000.00)
  })

  it('revenue uses the larger of two numbers on the line', () => {
    // litres < revenue always in practice
    const text = 'PETROL 95   750.25   27759.25'
    const result = buildPosOcrResult(visionText(text, HIGH_CONF))
    const g95 = result.lines.find((l) => l.grade_id === '95')
    expect(g95?.litres_sold).toBeCloseTo(750.25)
    expect(g95?.revenue_zar).toBeCloseTo(27759.25)
  })
})
