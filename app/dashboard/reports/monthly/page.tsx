import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildMonthlyReport, monthToDateRange } from '@/lib/aggregate-reports'
import type { RawReconciliation } from '@/lib/aggregate-reports'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

interface Props {
  searchParams: Promise<{ station?: string; month?: string }>
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function fmtV(n: number, unit: 'L' | 'R') {
  const sign = n > 0 ? '+' : ''
  const abs = Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}${unit === 'R' ? 'R ' : ''}${abs}${unit === 'L' ? ' L' : ''}`
}

function varColour(n: number) {
  return n > 0 ? 'text-destructive' : n < 0 ? 'text-amber-600' : 'text-green-600'
}

export default async function MonthlyReportPage({ searchParams }: Props) {
  const { station: stationId, month } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const selectedMonth = month ?? currentMonth()
  const { data: stations } = await supabase.from('stations').select('id, name').order('name')
  const activeStationId = stationId ?? stations?.[0]?.id
  if (!activeStationId) {
    return <main className="max-w-3xl mx-auto p-4"><p className="text-muted-foreground text-sm">No stations configured.</p></main>
  }
  const activeStation = (stations ?? []).find(s => s.id === activeStationId)

  const { startDate: firstDay, endDate: lastDay } = monthToDateRange(selectedMonth)

  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, shift_date, period, status')
    .eq('station_id', activeStationId)
    .gte('shift_date', firstDay)
    .lte('shift_date', lastDay)

  const shiftIds = (shifts ?? []).map(s => s.id)
  const recsResult = shiftIds.length > 0
    ? await supabase.from('reconciliations')
        .select('shift_id, reconciliation_tank_lines(variance_litres), reconciliation_pump_lines(variance_litres, variance_zar)')
        .in('shift_id', shiftIds)
    : { data: [] as RawReconciliation[] }

  const report = buildMonthlyReport(shifts ?? [], recsResult.data ?? [], selectedMonth, activeStationId)

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <Breadcrumb>
        <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink href="/dashboard/reports">Reports</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage>Monthly</BreadcrumbPage></BreadcrumbItem>
      </Breadcrumb>
      <div>
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
        <h1 className="text-xl font-semibold mt-1">Monthly Report</h1>
        <p className="text-sm text-muted-foreground">{activeStation?.name}</p>
      </div>

      <form method="GET" action="/dashboard/reports/monthly" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Station</label>
          <select name="station" defaultValue={activeStationId} className="border rounded px-2 py-1.5 text-sm">
            {(stations ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Month</label>
          <input type="month" name="month" defaultValue={selectedMonth} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded bg-black px-4 py-1.5 text-sm text-white">View</button>
        <a
          href={`/dashboard/reports/export?type=monthly&station=${activeStationId}&month=${selectedMonth}`}
          className="rounded border px-4 py-1.5 text-sm"
        >
          Export CSV
        </a>
      </form>

      <div className="border rounded-md text-sm overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/30">
            <tr className="text-muted-foreground text-xs">
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-center px-3 py-2">Morning</th>
              <th className="text-center px-3 py-2">Evening</th>
              <th className="text-right px-3 py-2">Tank var (L)</th>
              <th className="text-right px-3 py-2">Meter var (L)</th>
              <th className="text-right px-3 py-2">Revenue var (ZAR)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {report.rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-muted-foreground text-center">No data for this month.</td></tr>
            )}
            {report.rows.map(row => (
              <tr key={row.date}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/dashboard/reports?station=${activeStationId}&date=${row.date}`} className="underline text-primary">
                    {row.date}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center text-xs capitalize">{row.morningStatus.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-center text-xs capitalize">{row.eveningStatus.replace(/_/g, ' ')}</td>
                <td className={`px-3 py-2 text-right ${varColour(row.tankVarianceLitres)}`}>{fmtV(row.tankVarianceLitres, 'L')}</td>
                <td className={`px-3 py-2 text-right ${varColour(row.gradeVarianceLitres)}`}>{fmtV(row.gradeVarianceLitres, 'L')}</td>
                <td className={`px-3 py-2 text-right ${varColour(row.revenueVarianceZar)}`}>{fmtV(row.revenueVarianceZar, 'R')}</td>
              </tr>
            ))}
            {report.rows.length > 0 && (
              <tr className="border-t-2 font-semibold bg-muted/30">
                <td className="px-3 py-2" colSpan={3}>Total</td>
                <td className={`px-3 py-2 text-right ${varColour(report.totals.tankVarianceLitres)}`}>
                  {fmtV(report.totals.tankVarianceLitres, 'L')}
                </td>
                <td className={`px-3 py-2 text-right ${varColour(report.totals.gradeVarianceLitres)}`}>
                  {fmtV(report.totals.gradeVarianceLitres, 'L')}
                </td>
                <td className={`px-3 py-2 text-right ${varColour(report.totals.revenueVarianceZar)}`}>
                  {fmtV(report.totals.revenueVarianceZar, 'R')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
