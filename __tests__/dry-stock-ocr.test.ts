import { describe, it, expect } from 'vitest'
import { parseDryStockOcrResponse } from '@/lib/ocr/dry-stock-ocr'

// ── parseDryStockOcrResponse ──────────────────────────────────────────────────

describe('parseDryStockOcrResponse', () => {
  it('tracer bullet: parses well-formed pipe-delimited lines', () => {
    const text = [
      'Coke 500ml | 24 | 336.00',
      'Water 500ml | 12 | 108.00',
    ].join('\n')

    const result = parseDryStockOcrResponse(text)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ rawName: 'Coke 500ml', unitsSold: 24, revenueZar: 336.00 })
    expect(result[1]).toMatchObject({ rawName: 'Water 500ml', unitsSold: 12, revenueZar: 108.00 })
  })

  it('handles decimal unit and revenue values', () => {
    const text = 'Chips 100g | 5.5 | 55.50'
    const result = parseDryStockOcrResponse(text)
    expect(result[0]).toMatchObject({ rawName: 'Chips 100g', unitsSold: 5.5, revenueZar: 55.50 })
  })

  it('returns null for units when marked NULL', () => {
    const text = 'Mystery Item | NULL | 99.00'
    const result = parseDryStockOcrResponse(text)
    expect(result[0].unitsSold).toBeNull()
    expect(result[0].revenueZar).toBe(99.00)
  })

  it('returns null for revenue when marked NULL', () => {
    const text = 'Mystery Item | 10 | NULL'
    const result = parseDryStockOcrResponse(text)
    expect(result[0].unitsSold).toBe(10)
    expect(result[0].revenueZar).toBeNull()
  })

  it('returns empty array for UNREADABLE response', () => {
    expect(parseDryStockOcrResponse('UNREADABLE')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseDryStockOcrResponse('')).toEqual([])
  })

  it('skips malformed lines that lack two pipe separators', () => {
    const text = [
      'Coke 500ml | 24 | 336.00',
      'this line has no pipes',
      'Water 500ml | 12 | 108.00',
    ].join('\n')

    const result = parseDryStockOcrResponse(text)
    expect(result).toHaveLength(2)
    expect(result[0].rawName).toBe('Coke 500ml')
    expect(result[1].rawName).toBe('Water 500ml')
  })

  it('trims whitespace from names and values', () => {
    const text = '  Coke 500ml  |  24  |  336.00  '
    const result = parseDryStockOcrResponse(text)
    expect(result[0].rawName).toBe('Coke 500ml')
    expect(result[0].unitsSold).toBe(24)
  })

  it('returns empty array for partial response with only header-like content', () => {
    expect(parseDryStockOcrResponse('PRODUCT | UNITS | REVENUE')).toEqual([])
  })

  it('handles a single product line', () => {
    const text = 'Red Bull 250ml | 6 | 180.00'
    const result = parseDryStockOcrResponse(text)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ rawName: 'Red Bull 250ml', unitsSold: 6, revenueZar: 180.00 })
  })
})
