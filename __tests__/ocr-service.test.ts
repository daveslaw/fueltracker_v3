import { describe, it, expect } from 'vitest'
import { buildOcrResult } from '@/lib/ocr/ocr-service'
import type { RawVisionResponse } from '@/lib/ocr/ocr-service'

const HIGH_CONF = 0.95
const LOW_CONF  = 0.55
const THRESHOLD = 0.8   // must match implementation

// ── helpers to build mock Vision API responses ────────────────────────────────

function visionOk(text: string, confidence: number): RawVisionResponse {
  return {
    responses: [{
      textAnnotations: [{ description: text }],
      fullTextAnnotation: {
        pages: [{ blocks: [{ confidence }] }],
      },
    }],
  }
}

function visionError(): RawVisionResponse {
  return { responses: [{ error: { message: 'API quota exceeded' } }] }
}

// ── buildOcrResult ────────────────────────────────────────────────────────────

describe('buildOcrResult', () => {
  // Tracer bullet
  it('clean high-confidence response → value extracted, status auto', () => {
    const result = buildOcrResult(visionOk('12345.67', HIGH_CONF))
    expect(result.value).toBeCloseTo(12345.67)
    expect(result.confidence).toBe(HIGH_CONF)
    expect(result.status).toBe('auto')
  })

  it('low-confidence response → value extracted, status needs_review', () => {
    const result = buildOcrResult(visionOk('5000', LOW_CONF))
    expect(result.value).toBe(5000)
    expect(result.status).toBe('needs_review')
  })

  it('exactly at threshold → auto', () => {
    const result = buildOcrResult(visionOk('999', THRESHOLD))
    expect(result.status).toBe('auto')
  })

  it('API error response → graceful fallback, value null, status unreadable', () => {
    const result = buildOcrResult(visionError())
    expect(result.value).toBeNull()
    expect(result.status).toBe('unreadable')
  })

  it('null response (network failure) → graceful fallback', () => {
    const result = buildOcrResult(null)
    expect(result.value).toBeNull()
    expect(result.status).toBe('unreadable')
  })

  it('no text annotations → unreadable', () => {
    const result = buildOcrResult({ responses: [{ textAnnotations: [] }] })
    expect(result.value).toBeNull()
    expect(result.status).toBe('unreadable')
  })

  it('text with no numeric content → unreadable', () => {
    const result = buildOcrResult(visionOk('UNLEADED', HIGH_CONF))
    expect(result.value).toBeNull()
    expect(result.status).toBe('unreadable')
  })

  it('text with mixed content → extracts the largest numeric value', () => {
    // Pump meters often have surrounding text like "LTR 98765.43 TOTAL"
    const result = buildOcrResult(visionOk('LTR\n98765.43\nTOTAL', HIGH_CONF))
    expect(result.value).toBeCloseTo(98765.43)
    expect(result.status).toBe('auto')
  })

  it('multiple numbers → picks the largest (most likely to be a cumulative meter)', () => {
    const result = buildOcrResult(visionOk('3\n54321.00\n12', HIGH_CONF))
    expect(result.value).toBeCloseTo(54321.0)
  })
})
