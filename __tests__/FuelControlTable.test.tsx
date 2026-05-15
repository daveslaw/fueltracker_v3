import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FuelControlTable } from '../components/fuel-control-table'
import type { DayEntry } from '../lib/fuel-control-report'

function makeDayEntry(date: string, grade: string, overrides: Partial<DayEntry> = {}): DayEntry {
  return {
    date,
    allGradesSummary: {
      total_deliveries: 0,
      total_pos_litres: 1500,
      total_dip_calc:   1500,
      total_variance:   0,
      total_gp:         4500,
    },
    gradeGroups: [
      {
        grade,
        rows: [
          {
            type: 'shift',
            data: {
              shift_id:            `shift-${date}-am`,
              shift_date:          date,
              period:              'morning',
              status:              'closed',
              is_flagged:          false,
              fuel_grade_id:       grade,
              opening_dip:         20000,
              closing_dip:         18500,
              deliveries_litres:   0,
              delivery_note:       null,
              driver_name:         null,
              pos_litres:          1500,
              dip_calc_litres:     1500,
              variance_litres:     0,
              accumulated_variance: 0,
              sell_price:          17.00,
              cost_price:          14.00,
              gp_zar:              4500,
            },
          },
        ],
      },
    ],
    ...overrides,
  }
}

function makeShiftData(grade: string, posLitres: number, dipCalc: number, gp: number, accVariance?: number) {
  return {
    shift_id:            `shift-2026-05-01-${grade}`,
    shift_date:          '2026-05-01',
    period:              'morning' as const,
    status:              'closed',
    is_flagged:          false,
    fuel_grade_id:       grade,
    opening_dip:         20000,
    closing_dip:         18500,
    deliveries_litres:   0,
    delivery_note:       null,
    driver_name:         null,
    pos_litres:          posLitres,
    dip_calc_litres:     dipCalc,
    variance_litres:     posLitres - dipCalc,
    accumulated_variance: accVariance ?? (posLitres - dipCalc),
    sell_price:          17.00,
    cost_price:          14.00,
    gp_zar:              gp,
  }
}

function makeMultiGradeEntries(): DayEntry[] {
  // 95: 1000 L pos / 1100 dip-calc, D10: 2000 L pos / 2200 dip-calc — distinguishable
  return [{
    date: '2026-05-01',
    allGradesSummary: {
      total_deliveries: 0,
      total_pos_litres: 3000,
      total_dip_calc:   3300,
      total_variance:   -300,
      total_gp:         9000,
    },
    gradeGroups: [
      { grade: '95',  rows: [{ type: 'shift', data: makeShiftData('95',  1000, 1100, 3000, -100) }] },
      { grade: 'D10', rows: [{ type: 'shift', data: makeShiftData('D10', 2000, 2200, 6000, -200) }] },
    ],
  }]
}

const GRADES = ['95']

// ── expand / collapse ─────────────────────────────────────────────────────────
describe('FuelControlTable expand/collapse', () => {
  it('all day rows start collapsed — shift rows not visible', () => {
    const entries = [makeDayEntry('2026-05-01', '95'), makeDayEntry('2026-05-02', '95')]
    render(<FuelControlTable entries={entries} grades={GRADES} stationId="s1" />)
    expect(screen.queryByText('AM')).toBeNull()
    expect(screen.queryByText('PM')).toBeNull()
  })

  it('clicking a collapsed day row reveals its shift rows', async () => {
    const user = userEvent.setup()
    const entries = [makeDayEntry('2026-05-01', '95')]
    render(<FuelControlTable entries={entries} grades={GRADES} stationId="s1" />)
    await user.click(screen.getByText('2026-05-01'))
    expect(screen.getByText('AM')).toBeInTheDocument()
  })

  it('clicking an expanded day row collapses it again', async () => {
    const user = userEvent.setup()
    const entries = [makeDayEntry('2026-05-01', '95')]
    render(<FuelControlTable entries={entries} grades={GRADES} stationId="s1" />)
    await user.click(screen.getByText('2026-05-01'))
    await user.click(screen.getByText('2026-05-01'))
    expect(screen.queryByText('AM')).toBeNull()
  })

  it('expanding one day does not expand others', async () => {
    const user = userEvent.setup()
    const entries = [makeDayEntry('2026-05-01', '95'), makeDayEntry('2026-05-02', '95')]
    render(<FuelControlTable entries={entries} grades={GRADES} stationId="s1" />)
    await user.click(screen.getByText('2026-05-01'))
    // shift row for day 1 visible
    expect(screen.getByText('AM')).toBeInTheDocument()
    // day 2 collapsed — its shift row isn't rendered a second time
    const allAMs = screen.getAllByText('AM')
    expect(allAMs).toHaveLength(1)
  })

  it('collapsed day row: variance shows dash, acc. variance shows last shift running total', () => {
    const entries = [makeDayEntry('2026-05-01', '95')]
    render(<FuelControlTable entries={entries} grades={GRADES} stationId="s1" />)
    const dayRow = screen.getByTestId('day-row-2026-05-01')
    const cells = within(dayRow).getAllByRole('cell')
    // col 0=date, col 1=opening dip, col 2=closing dip, col 3=deliveries,
    // col 4=POS litres, col 5=dip-calc, col 6=variance, col 7=acc. variance, col 8=GP
    expect(cells[1]).toHaveTextContent('—') // opening dip
    expect(cells[2]).toHaveTextContent('—') // closing dip
    expect(cells[6]).toHaveTextContent('—') // variance — hidden on day row
    expect(cells[7]).toHaveTextContent('0 L') // acc. variance — last shift's running total
  })

  it('shift rows show variance and hide acc. variance', async () => {
    const user = userEvent.setup()
    const entries = [makeDayEntry('2026-05-01', '95')]
    render(<FuelControlTable entries={entries} grades={GRADES} stationId="s1" />)
    await user.click(screen.getByText('2026-05-01'))
    const shiftRows = screen.getAllByRole('row')
    // shift row is the one after the day row (index 2, after thead row and day row)
    const shiftRow = shiftRows.find(r => within(r).queryByText('AM'))!
    const cells = within(shiftRow).getAllByRole('cell')
    // col 6=variance shows value, col 7=acc. variance shows dash
    expect(cells[6]).not.toHaveTextContent('—') // variance present
    expect(cells[7]).toHaveTextContent('—')     // acc. variance hidden on shift row
  })
})

// ── grade filter ──────────────────────────────────────────────────────────────
describe('FuelControlTable grade filter', () => {
  it('grade dropdown defaults to first grade', () => {
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    expect(screen.getByRole('combobox', { name: /grade/i })).toHaveValue('95')
  })

  it('grade dropdown lists all grades with no "All grades" option', () => {
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    const select = screen.getByRole('combobox', { name: /grade/i })
    const options = within(select as HTMLElement).getAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual(['95', 'D10'])
  })

  it('selecting a grade resets all expand state', async () => {
    const user = userEvent.setup()
    const entries = makeMultiGradeEntries()
    render(<FuelControlTable entries={entries} grades={['95', 'D10']} stationId="s1" />)
    // expand the day row (default grade is 95)
    await user.click(screen.getByText('2026-05-01'))
    expect(screen.getByText('AM')).toBeInTheDocument()
    // switch grade — row should collapse
    await user.selectOptions(screen.getByRole('combobox', { name: /grade/i }), 'D10')
    expect(screen.queryByText('AM')).toBeNull()
  })

  it('collapsed day row shows the selected grade subtotal, not the cross-grade total', async () => {
    const user = userEvent.setup()
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    // default is 95 — day row should show 1 000 L (95 grade), not 3 000 L (all grades)
    const dayRow = screen.getByTestId('day-row-2026-05-01')
    expect(within(dayRow).getByText(/1.000 L/)).toBeInTheDocument()
    // switch to D10 — day row should show 2 000 L
    await user.selectOptions(screen.getByRole('combobox', { name: /grade/i }), 'D10')
    expect(within(dayRow).getByText(/2.000 L/)).toBeInTheDocument()
  })

  it('collapsed day row acc. variance shows the selected grade running total', async () => {
    const user = userEvent.setup()
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    const dayRow = screen.getByTestId('day-row-2026-05-01')
    const cells = within(dayRow).getAllByRole('cell')
    // 95 grade accumulated_variance = -100
    expect(cells[7]).toHaveTextContent('-100 L')
    // switch to D10 — accumulated_variance = -200
    await user.selectOptions(screen.getByRole('combobox', { name: /grade/i }), 'D10')
    expect(cells[7]).toHaveTextContent('-200 L')
  })

  it('expanded shift rows show AM/PM label without grade suffix', async () => {
    const user = userEvent.setup()
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    await user.click(screen.getByText('2026-05-01'))
    expect(screen.getByText('AM')).toBeInTheDocument()
    expect(screen.queryByText(/AM · /)).toBeNull()
  })
})
