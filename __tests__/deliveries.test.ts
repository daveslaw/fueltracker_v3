import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getShiftPeriod, validateDeliveryInput, createDelivery } from '../lib/deliveries'

describe('getShiftPeriod', () => {
  it('returns morning for a timestamp before 12:00 UTC', () => {
    expect(getShiftPeriod('2026-03-23T06:00:00Z')).toBe('morning')
  })

  it('returns evening for a timestamp at or after 12:00 UTC', () => {
    expect(getShiftPeriod('2026-03-23T12:00:00Z')).toBe('evening')
  })

  it('returns morning for 00:00 UTC (midnight)', () => {
    expect(getShiftPeriod('2026-03-23T00:00:00Z')).toBe('morning')
  })

  it('returns morning for 11:59 UTC', () => {
    expect(getShiftPeriod('2026-03-23T11:59:59Z')).toBe('morning')
  })

  it('returns evening for 23:59 UTC', () => {
    expect(getShiftPeriod('2026-03-23T23:59:59Z')).toBe('evening')
  })
})

describe('validateDeliveryInput', () => {
  const valid = {
    tankId:             'tank-1',
    litresReceived:     5000,
    deliveryNoteUrl:    'https://storage.example.com/receipt.jpg',
    deliveryNoteNumber: 'DN-2026-001',
  }

  it('tracer bullet: valid inputs return { valid: true }', () => {
    expect(validateDeliveryInput(valid)).toEqual({ valid: true })
  })

  it('litresReceived of 0 is invalid', () => {
    const result = validateDeliveryInput({ ...valid, litresReceived: 0 })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('negative litresReceived is invalid', () => {
    const result = validateDeliveryInput({ ...valid, litresReceived: -1 })
    expect(result.valid).toBe(false)
  })

  it('empty tankId is invalid', () => {
    const result = validateDeliveryInput({ ...valid, tankId: '' })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('whitespace-only tankId is invalid', () => {
    const result = validateDeliveryInput({ ...valid, tankId: '   ' })
    expect(result.valid).toBe(false)
  })

  it('empty deliveryNoteUrl is invalid', () => {
    const result = validateDeliveryInput({ ...valid, deliveryNoteUrl: '' })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('whitespace-only deliveryNoteUrl is invalid', () => {
    const result = validateDeliveryInput({ ...valid, deliveryNoteUrl: '   ' })
    expect(result.valid).toBe(false)
  })

  it('empty deliveryNoteNumber is invalid', () => {
    const result = validateDeliveryInput({ ...valid, deliveryNoteNumber: '' })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('whitespace-only deliveryNoteNumber is invalid', () => {
    const result = validateDeliveryInput({ ...valid, deliveryNoteNumber: '   ' })
    expect(result.valid).toBe(false)
  })

  it('omitting driverName is still valid', () => {
    const { ...withoutDriver } = valid
    expect(validateDeliveryInput(withoutDriver)).toEqual({ valid: true })
  })
})

// ── createDelivery — duplicate guard ──────────────────────────────────────────

describe('createDelivery — duplicate note number', () => {
  it('returns a user-readable error when the DB reports a unique constraint violation', async () => {
    const db = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { message: 'duplicate key value violates unique constraint', code: '23505' },
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient

    const result = await createDelivery(db, {
      stationId:          'station-1',
      tankId:             'tank-1',
      litresReceived:     5000,
      deliveryNoteUrl:    'https://storage.example.com/receipt.jpg',
      deliveryNoteNumber: 'DN-2026-001',
      driverName:         null,
      recordedBy:         'user-1',
    })

    expect(result.error).toBe('Delivery note number already recorded for this station')
  })
})
