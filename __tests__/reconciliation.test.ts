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

// ── Formula 1: Tank Inventory (per tank) ──────────────────────────────────────
//
// Expected Closing Dip = Opening Dip + Deliveries − Meter Delta
// variance_litres = actual − expected  (negative = loss)
//
// Meter Delta for a tank = Σ(close − open) for pumps where pump.tank_id = this tank

describe('computeReconciliation — tank lines', () => {
  it('uses meter delta (not POS litres) to compute expected closing dip', () => {
    // Meter delta = 2000L, POS litres = 1800L (they diverge).
    // New formula: expected = 10000 − 2000 = 8000. Actual = 8000. Variance = 0.
    // Old formula would have: expected = 10000 − 1800 = 8200. Variance = +200.
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 8000)],
      deliveries:   [],
      pumpReadings: [reading('P1', 100000, 102000)],  // delta = 2000
      posLines:     [posLine('95', 1800, 30600)],     // POS says 1800 — intentionally different
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.meter_delta).toBe(2000)
    expect(line.expected_closing_dip).toBe(8000)
    expect(line.variance_litres).toBe(0)
  })

  it('variance is negative when actual closing dip is less than expected (inventory loss)', () => {
    // Meter delta = 2000, opening = 10000, no deliveries. Expected = 8000. Actual = 7700.
    // variance = actual − expected = 7700 − 8000 = −300 (loss = negative)
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 7700)],
      deliveries:   [],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines:     [posLine('95', 2000, 34000)],
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.variance_litres).toBe(-300)
  })

  it('variance is positive when actual closing dip exceeds expected (unexplained gain)', () => {
    // Expected = 8000. Actual = 8400. variance = 8400 − 8000 = +400
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 8400)],
      deliveries:   [],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines:     [posLine('95', 2000, 34000)],
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.variance_litres).toBe(400)
  })

  it('only pumps mapped to this tank contribute to its meter_delta', () => {
    // T1 (95) has P1 (delta +2000). T2 (D10) has P2 (delta +500).
    // T1 meter_delta should be 2000 only, ignoring P2.
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95'), tank('T2', 'D10')],
      pumps:        [pump('P1', 'T1'), pump('P2', 'T2')],
      openDips:     [openDip('T1', 10000), openDip('T2', 8000)],
      closeDips:    [closeDip('T1', 8000), closeDip('T2', 7500)],
      deliveries:   [],
      pumpReadings: [reading('P1', 100000, 102000), reading('P2', 50000, 50500)],
      posLines:     [posLine('95', 2000, 34000), posLine('D10', 500, 11000)],
      prices:       [price('95', 17.00), price('D10', 22.00)],
    }
    const result = computeReconciliation(inputs)
    const t1 = result.tankLines.find(l => l.tank_id === 'T1')!
    const t2 = result.tankLines.find(l => l.tank_id === 'T2')!
    expect(t1.meter_delta).toBe(2000)
    expect(t2.meter_delta).toBe(500)
  })

  it('multiple pumps on the same tank are summed for meter_delta', () => {
    // P1: +1200, P2: +800 → T1 meter_delta = 2000
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1'), pump('P2', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 8000)],
      deliveries:   [],
      pumpReadings: [reading('P1', 50000, 51200), reading('P2', 20000, 20800)],
      posLines:     [posLine('95', 2000, 34000)],
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.meter_delta).toBe(2000)
    expect(line.expected_closing_dip).toBe(8000)
    expect(line.variance_litres).toBe(0)
  })

  it('delivery is added to expected closing dip', () => {
    // Open=10000, delivery=5000, meter delta=2000. Expected = 13000. Actual = 13000.
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 13000)],
      deliveries:   [delivery('T1', 5000)],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines:     [posLine('95', 2000, 34000)],
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.tankLines.find(l => l.tank_id === 'T1')!
    expect(line.deliveries_received).toBe(5000)
    expect(line.expected_closing_dip).toBe(13000)
    expect(line.variance_litres).toBe(0)
  })
})

// ── Formula 2: Pump Meter vs POS (per grade) ──────────────────────────────────
//
// variance_litres     = pos_litres_sold − meter_delta        (negative = unrecorded dispensing)
// expected_revenue_zar = meter_delta × price_per_litre
// variance_zar        = pos_revenue_zar − expected_revenue_zar (negative = revenue shortfall)

describe('computeReconciliation — grade lines', () => {
  it('variance_litres = pos_litres_sold − meter_delta (negative when pumps dispensed more than POS recorded)', () => {
    // Meter delta = 2100. POS sold = 2000. variance = 2000 − 2100 = −100 (unrecorded dispensing)
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 7900)],
      deliveries:   [],
      pumpReadings: [reading('P1', 50000, 52100)],
      posLines:     [posLine('95', 2000, 34000)],
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.gradeLines.find(l => l.fuel_grade_id === '95')!
    expect(line.meter_delta).toBe(2100)
    expect(line.pos_litres_sold).toBe(2000)
    expect(line.variance_litres).toBe(-100)
  })

  it('expected_revenue_zar = meter_delta × price_per_litre', () => {
    // Meter delta = 2000L × R17.00 = R34,000 expected
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 8000)],
      deliveries:   [],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines:     [posLine('95', 2000, 33000)],
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.gradeLines.find(l => l.fuel_grade_id === '95')!
    expect(line.expected_revenue_zar).toBe(34000)
  })

  it('variance_zar = pos_revenue_zar − expected_revenue_zar (negative = revenue shortfall)', () => {
    // Meter delta = 2000L. Expected revenue = 2000 × R17 = R34,000.
    // POS revenue = R33,000. variance = 33000 − 34000 = −R1,000 (shortfall)
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 10000)],
      closeDips:    [closeDip('T1', 8000)],
      deliveries:   [],
      pumpReadings: [reading('P1', 100000, 102000)],
      posLines:     [posLine('95', 2000, 33000)],
      prices:       [price('95', 17.00)],
    }
    const result = computeReconciliation(inputs)
    const line = result.gradeLines.find(l => l.fuel_grade_id === '95')!
    expect(line.pos_revenue_zar).toBe(33000)
    expect(line.variance_zar).toBe(-1000)
  })

  it('multiple grades are computed independently', () => {
    // 95: meter=1000, POS=1000, price=17 → variance_litres=0, revenue=17000, variance_zar=0
    // D10: meter=500, POS=480, price=22 → variance_litres=−20, revenue=11000, pos_revenue=10560
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95'), tank('T2', 'D10')],
      pumps:        [pump('P1', 'T1'), pump('P2', 'T2')],
      openDips:     [openDip('T1', 5000), openDip('T2', 8000)],
      closeDips:    [closeDip('T1', 4000), closeDip('T2', 7500)],
      deliveries:   [],
      pumpReadings: [reading('P1', 10000, 11000), reading('P2', 20000, 20500)],
      posLines:     [posLine('95', 1000, 17000), posLine('D10', 480, 10560)],
      prices:       [price('95', 17.00), price('D10', 22.00)],
    }
    const result = computeReconciliation(inputs)
    const g95  = result.gradeLines.find(l => l.fuel_grade_id === '95')!
    const gD10 = result.gradeLines.find(l => l.fuel_grade_id === 'D10')!

    expect(g95.variance_litres).toBe(0)
    expect(g95.expected_revenue_zar).toBe(17000)
    expect(g95.variance_zar).toBe(0)

    expect(gD10.variance_litres).toBe(-20)
    expect(gD10.expected_revenue_zar).toBe(11000)
    expect(gD10.variance_zar).toBe(-440)
  })

  it('grade with no POS line defaults pos_litres_sold and pos_revenue_zar to 0', () => {
    // D10 tank has a pump but no POS line submitted
    const inputs: ReconciliationInputs = {
      tanks:        [tank('T1', '95'), tank('T2', 'D10')],
      pumps:        [pump('P1', 'T1'), pump('P2', 'T2')],
      openDips:     [openDip('T1', 5000), openDip('T2', 8000)],
      closeDips:    [closeDip('T1', 4000), closeDip('T2', 7500)],
      deliveries:   [],
      pumpReadings: [reading('P1', 10000, 11000), reading('P2', 20000, 20500)],
      posLines:     [posLine('95', 1000, 17000)],  // no D10 line
      prices:       [price('95', 17.00), price('D10', 22.00)],
    }
    const result = computeReconciliation(inputs)
    const gD10 = result.gradeLines.find(l => l.fuel_grade_id === 'D10')!
    expect(gD10.pos_litres_sold).toBe(0)
    expect(gD10.pos_revenue_zar).toBe(0)
    expect(gD10.meter_delta).toBe(500)
    expect(gD10.variance_litres).toBe(-500)   // 0 − 500 = −500 (all dispensed, none recorded)
  })

  it('uses the price snapshot passed in', () => {
    // Same litres but different price → different expected_revenue_zar
    const base = {
      tanks:        [tank('T1', '95')],
      pumps:        [pump('P1', 'T1')],
      openDips:     [openDip('T1', 5000)],
      closeDips:    [closeDip('T1', 4000)],
      deliveries:   [],
      pumpReadings: [reading('P1', 10000, 11000)],
      posLines:     [posLine('95', 1000, 17000)],
    }
    const r1 = computeReconciliation({ ...base, prices: [price('95', 17.00)] })
    const r2 = computeReconciliation({ ...base, prices: [price('95', 21.95)] })
    expect(r1.gradeLines[0].expected_revenue_zar).toBe(17000)
    expect(r2.gradeLines[0].expected_revenue_zar).toBeCloseTo(21950)
  })
})
