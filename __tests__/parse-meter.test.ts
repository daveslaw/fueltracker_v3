import { describe, it, expect } from 'vitest'
import { parseMeterText } from '@/lib/ocr/parse-meter'

describe('parseMeterText', () => {
  it('UNREADABLE sentinel → unreadable result', () => {
    expect(parseMeterText('UNREADABLE')).toEqual({ value: null, confidence: 0, status: 'unreadable' })
  })

  it('empty string → unreadable', () => {
    expect(parseMeterText('')).toEqual({ value: null, confidence: 0, status: 'unreadable' })
  })

  it('single integer >= 1000 → selected as totalizer, status auto', () => {
    const result = parseMeterText('12345')
    expect(result.value).toBe(12345)
    expect(result.confidence).toBe(0.95)
    expect(result.status).toBe('auto')
  })

  it('pump label + transaction + totalizer → picks largest integer >= 1000', () => {
    // label "5", transaction "23.57 L", totalizer "50017"
    const result = parseMeterText('5\n23.57\n50017')
    expect(result.value).toBe(50017)
  })

  it('no integer >= 1000 but decimal >= 1000 → picks that decimal', () => {
    const result = parseMeterText('5\n1234.56')
    expect(result.value).toBeCloseTo(1234.56)
  })

  it('no number >= 1000 → falls back to largest overall', () => {
    const result = parseMeterText('5\n23.57')
    expect(result.value).toBeCloseTo(23.57)
  })

  it('multiple integers >= 1000 → picks the largest', () => {
    const result = parseMeterText('1000\n54321\n2000')
    expect(result.value).toBe(54321)
  })
})
