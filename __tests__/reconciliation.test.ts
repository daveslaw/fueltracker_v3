import { describe, it, expect } from 'vitest'
import { computeReconciliation } from '../lib/reconciliation'
import type { ReconciliationInputs } from '../lib/reconciliation'

// Minimal fixture builders
const tank = (id: string, fuel_grade_id: string) => ({ id, fuel_grade_id })
const pump = (id: string, tank_id: string) => ({ id, tank_id })
const openDip = (tank_id: string, litres: number) => ({ tank_id, litres })
const closeDip = (tank_id: string, litres: number) => ({ tank_id, litres })
const delivery = (tank_id: string, litres_received: number) => ({ tank_id, litres_received })
const reading = (pump_id: string, opening_reading: number, closing_reading: number) => ({
  pump_id, opening_reading, closing_reading,
})
const posLine = (fuel_grade_id: string, litres_sold: number, revenue_zar: number) => ({
  fuel_grade_id, litres_sold, revenue_zar,
})
const price = (fuel_grade_id: string, price_per_litre: number) => ({
  fuel_grade_id, price_per_litre,
})

describe('computeReconciliation — tank lines', () => {
  it('variance is 0 when actual closing dip matches expected (no deliveries)', () => {
    // Tank T1 holds grade 95. Open=10000L, POS sold 2000L. Expected close=8000L. Actual=8000L → variance=0.
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 8000)],
      deliveries: [],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.expected_closing_dip).toBe(8000)
    expect(line.actual_closing_dip).toBe(8000)
    expect(line.variance_litres).toBe(0)
  })

  it('variance is positive when actual closing is less than expected (inventory loss)', () => {
    // Expected=8000L, actual=7800L → loss of 200L, variance=+200
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 7800)],
      deliveries: [],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.variance_litres).toBe(200)
  })

  it('variance is negative when actual closing exceeds expected (unexplained gain)', () => {
    // Expected=8000L, actual=8300L → gain of 300L, variance=-300
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 8300)],
      deliveries: [],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.variance_litres).toBe(-300)
  })

  it('delivery is added to expected closing dip', () => {
    // Open=10000, delivery=5000, POS sold=2000. Expected close=13000.
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 13000)],
      deliveries: [delivery('T1', 5000)],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.deliveries_received).toBe(5000)
    expect(line.expected_closing_dip).toBe(13000)
    expect(line.variance_litres).toBe(0)
  })

  it('multiple deliveries to same tank are summed', () => {
    // Two deliveries: 3000 + 2000 = 5000. Open=10000, POS=2000. Expected=13000.
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 13000)],
      deliveries: [delivery('T1', 3000), delivery('T1', 2000)],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.deliveries_received).toBe(5000)
    expect(line.expected_closing_dip).toBe(13000)
  })
})

describe('computeReconciliation — grade lines', () => {
  it('meter delta is closing minus opening for a single pump', () => {
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 8000)],
      deliveries: [],
      pumpReadings: [reading('P1', 50000, 52000)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.gradeLines.find(l => l.fuel_grade_id === '95')!
    expect(line.meter_delta).toBe(2000)
  })

  it('meter deltas are summed across multiple pumps of the same grade', () => {
    // P1: +1200, P2: +800 → total delta = 2000 for grade 95
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1'), pump('P2', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 8000)],
      deliveries: [],
      pumpReadings: [reading('P1', 50000, 51200), reading('P2', 20000, 20800)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.gradeLines.find(l => l.fuel_grade_id === '95')!
    expect(line.meter_delta).toBe(2000)
  })

  it('grade with pumps but no POS line has pos_litres_sold = 0', () => {
    // Grade D10 tank has a pump delta but no POS line was submitted
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95'), tank('T2', 'D10')],
      pumps: [pump('P1', 'T1'), pump('P2', 'T2')],
      openDips: [openDip('T1', 5000), openDip('T2', 8000)],
      closeDips: [closeDip('T1', 4000), closeDip('T2', 7500)],
      deliveries: [],
      pumpReadings: [reading('P1', 10000, 11000), reading('P2', 20000, 20500)],
      posLines: [posLine('95', 1000, 17000)],  // no D10 line
      prices: [price('95', 17.00), price('D10', 22.00)],
    }
    const result = computeReconciliation(inputs)
    const d10Line = result.gradeLines.find(l => l.fuel_grade_id === 'D10')!
    expect(d10Line.pos_litres_sold).toBe(0)
    expect(d10Line.meter_delta).toBe(500)
    expect(d10Line.variance_litres).toBe(500)
  })

  it('meter vs POS variance = meter_delta minus pos_litres_sold', () => {
    // Meter delta=2100, POS sold=2000 → variance=+100 (100L unaccounted by POS)
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 10000)],
      closeDips: [closeDip('T1', 7900)],
      deliveries: [],
      pumpReadings: [reading('P1', 50000, 52100)],
      posLines: [posLine('95', 2000, 34000)],
      prices: [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.gradeLines.find(l => l.fuel_grade_id === '95')!
    expect(line.meter_delta).toBe(2100)
    expect(line.pos_litres_sold).toBe(2000)
    expect(line.variance_litres).toBe(100)
  })
})

describe('computeReconciliation — financial', () => {
  it('expected revenue = litres sold × price per grade, summed across grades', () => {
    // 95: 1000L × R17 = R17000; D10: 500L × R22 = R11000. Total = R28000.
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95'), tank('T2', 'D10')],
      pumps: [pump('P1', 'T1'), pump('P2', 'T2')],
      openDips: [openDip('T1', 5000), openDip('T2', 5000)],
      closeDips: [closeDip('T1', 4000), closeDip('T2', 4500)],
      deliveries: [],
      pumpReadings: [reading('P1', 10000, 11000), reading('P2', 20000, 20500)],
      posLines: [posLine('95', 1000, 17000), posLine('D10', 500, 11000)],
      prices: [price('95', 17.00), price('D10', 22.00)],
    }
    const result = computeReconciliation(inputs)
    expect(result.expectedRevenue).toBe(28000)
  })

  it('revenue variance = expected minus POS reported revenue', () => {
    // Expected=R28000, POS reported=R27500 → variance=R500
    const inputs: ReconciliationInputs = {
      tanks: [tank('T1', '95'), tank('T2', 'D10')],
      pumps: [pump('P1', 'T1'), pump('P2', 'T2')],
      openDips: [openDip('T1', 5000), openDip('T2', 5000)],
      closeDips: [closeDip('T1', 4000), closeDip('T2', 4500)],
      deliveries: [],
      pumpReadings: [reading('P1', 10000, 11000), reading('P2', 20000, 20500)],
      posLines: [posLine('95', 1000, 16500), posLine('D10', 500, 11000)],
      prices: [price('95', 17.00), price('D10', 22.00)],
    }
    const result = computeReconciliation(inputs)
    // Expected = 1000×17 + 500×22 = 28000. POS reported = 16500+11000 = 27500.
    expect(result.posRevenue).toBe(27500)
    expect(result.revenueVariance).toBe(500)
  })

  it('uses the price snapshot passed in, not any other value', () => {
    // Same litres but different price passed in → different expected revenue
    const base = {
      tanks: [tank('T1', '95')],
      pumps: [pump('P1', 'T1')],
      openDips: [openDip('T1', 5000)],
      closeDips: [closeDip('T1', 4000)],
      deliveries: [],
      pumpReadings: [reading('P1', 10000, 11000)],
      posLines: [posLine('95', 1000, 17000)],
    }
    const result1 = computeReconciliation({ ...base, prices: [price('95', 17.00)] })
    const result2 = computeReconciliation({ ...base, prices: [price('95', 21.95)] })
    expect(result1.expectedRevenue).toBe(17000)
    expect(result2.expectedRevenue).toBeCloseTo(21950)
  })
})
