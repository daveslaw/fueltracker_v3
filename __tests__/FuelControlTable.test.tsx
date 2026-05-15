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

  it('collapsed day row shows dashes for opening dip, closing dip, acc. variance', () => {
    const entries = [makeDayEntry('2026-05-01', '95')]
    render(<FuelControlTable entries={entries} grades={GRADES} stationId="s1" />)
    const dayRow = screen.getByTestId('day-row-2026-05-01')
    const cells = within(dayRow).getAllByRole('cell')
    // col 1=date, col 2=opening dip, col 3=closing dip, col 4=deliveries,
    // col 5=POS litres, col 6=dip-calc, col 7=variance, col 8=acc. variance, col 9=GP
    expect(cells[1]).toHaveTextContent('—') // opening dip
    expect(cells[2]).toHaveTextContent('—') // closing dip
    expect(cells[7]).toHaveTextContent('—') // acc. variance
  })
})

// ── grade filter ──────────────────────────────────────────────────────────────
describe('FuelControlTable grade filter', () => {
  function makeShiftData(grade: string, posLitres: number, dipCalc: number, gp: number) {
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
      accumulated_variance: posLitres - dipCalc,
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
        { grade: '95',  rows: [{ type: 'shift', data: makeShiftData('95',  1000, 1100, 3000) }] },
        { grade: 'D10', rows: [{ type: 'shift', data: makeShiftData('D10', 2000, 2200, 6000) }] },
      ],
    }]
  }

  it('grade dropdown defaults to "All grades"', () => {
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    expect(screen.getByRole('combobox', { name: /grade/i })).toHaveValue('all')
  })

  it('grade dropdown lists all grades plus "All grades"', () => {
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    const select = screen.getByRole('combobox', { name: /grade/i })
    const options = within(select as HTMLElement).getAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual(['All grades', '95', 'D10'])
  })

  it('selecting a grade resets all expand state', async () => {
    const user = userEvent.setup()
    const entries = makeMultiGradeEntries()
    render(<FuelControlTable entries={entries} grades={['95', 'D10']} stationId="s1" />)
    // expand the day row
    await user.click(screen.getByText('2026-05-01'))
    // all-grades expanded: two shift rows labelled "AM · 95" and "AM · D10"
    expect(screen.getAllByText(/^AM/)).toHaveLength(2)
    // switch grade
    await user.selectOptions(screen.getByRole('combobox', { name: /grade/i }), '95')
    // row collapses on grade change
    expect(screen.queryByText(/^AM/)).toBeNull()
  })

  it('single-grade collapsed row shows that grade subtotal totals', async () => {
    const user = userEvent.setup()
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    await user.selectOptions(screen.getByRole('combobox', { name: /grade/i }), '95')
    const dayRow = screen.getByTestId('day-row-2026-05-01')
    // should show the 95-grade POS total (1 000 L), not the cross-grade 3 000 L
    expect(within(dayRow).getByText(/1.000 L/)).toBeInTheDocument()
  })

  it('all-grades expanded rows show grade label in shift cell', async () => {
    const user = userEvent.setup()
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    await user.click(screen.getByText('2026-05-01'))
    expect(screen.getByText('AM · 95')).toBeInTheDocument()
    expect(screen.getByText('AM · D10')).toBeInTheDocument()
  })

  it('single-grade expanded rows show shift cell without grade label', async () => {
    const user = userEvent.setup()
    render(<FuelControlTable entries={makeMultiGradeEntries()} grades={['95', 'D10']} stationId="s1" />)
    await user.selectOptions(screen.getByRole('combobox', { name: /grade/i }), '95')
    await user.click(screen.getByText('2026-05-01'))
    expect(screen.getByText('AM')).toBeInTheDocument()
    expect(screen.queryByText('AM · 95')).toBeNull()
  })
})
