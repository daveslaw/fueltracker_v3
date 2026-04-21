import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  searchParams: Promise<{
    station?: string
    from?: string
    to?: string
    period?: string
    status?: string
    supervisor?: string
  }>
}

export default async function ShiftHistoryPage({ searchParams }: Props) {
  const filters = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const fromDate = filters.from ?? sixtyDaysAgo
  const toDate   = filters.to   ?? today

  const [{ data: stations }, { data: supervisors }] = await Promise.all([
    supabase.from('stations').select('id, name').order('name'),
    supabase.from('user_profiles')
      .select('id, email')
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .order('email'),
  ])

  let query = supabase
    .from('shifts')
    .select(`
      id, shift_date, period, status, submitted_at,
      stations ( name ),
      user_profiles!supervisor_id ( email )
    `)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)
    .order('shift_date', { ascending: false })
    .order('period', { ascending: true })
    .limit(200)

  if (filters.station)    query = query.eq('station_id', filters.station)
  if (filters.period)     query = query.eq('period', filters.period)
  if (filters.status)     query = query.eq('status', filters.status)
  if (filters.supervisor) query = query.eq('supervisor_id', filters.supervisor)

  const { data: shifts, error: shiftsError } = await query
  if (shiftsError) console.error('[history] shifts query error:', shiftsError.message)

  // Load variance summary per shift
  const shiftIds = (shifts ?? []).map(s => s.id)
  const recsResult = shiftIds.length > 0
    ? await supabase.from('reconciliations')
        .select('shift_id, reconciliation_tank_lines(variance_litres), reconciliation_grade_lines(variance_zar)')
        .in('shift_id', shiftIds)
    : { data: [] as any[] }

  const recMap = new Map((recsResult.data ?? []).map((r: any) => [r.shift_id, r]))

  function varianceSummary(shiftId: string) {
    const rec = recMap.get(shiftId)
    if (!rec) return null
    const totalTankVar = (rec.reconciliation_tank_lines ?? []).reduce((s: number, l: any) => s + l.variance_litres, 0)
    const totalRevenueVar = (rec.reconciliation_grade_lines ?? []).reduce((s: number, l: any) => s + l.variance_zar, 0)
    return { tankVar: Math.round(totalTankVar * 100) / 100, revenueVar: Math.round(totalRevenueVar * 100) / 100 }
  }

  const statusColour = (s: string) =>
    s === 'closed'   ? 'bg-green-100 text-green-800' :
    s === 'flagged'  ? 'bg-red-100 text-red-800' :
    s === 'pending'  ? 'bg-blue-100 text-blue-800' :
    'bg-gray-100 text-gray-600'

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div>
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
        <h1 className="text-xl font-semibold mt-1">Shift History</h1>
      </div>

      {/* Filter form */}
      <form method="GET" action="/dashboard/history" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <input type="date" name="from" defaultValue={fromDate} max={today} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <input type="date" name="to" defaultValue={toDate} max={today} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Station</label>
          <select name="station" defaultValue={filters.station ?? ''} className="border rounded px-2 py-1.5 text-sm">
            <option value="">All stations</option>
            {(stations ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Period</label>
          <select name="period" defaultValue={filters.period ?? ''} className="border rounded px-2 py-1.5 text-sm">
            <option value="">All periods</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={filters.status ?? ''} className="border rounded px-2 py-1.5 text-sm">
            <option value="">All statuses</option>
            <option value="closed">Closed</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Supervisor</label>
          <select name="supervisor" defaultValue={filters.supervisor ?? ''} className="border rounded px-2 py-1.5 text-sm">
            <option value="">All supervisors</option>
            {(supervisors ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.email}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-black px-4 py-1.5 text-sm text-white">Filter</button>
      </form>

      <div className="border rounded-md text-sm overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/30">
            <tr className="text-muted-foreground text-xs">
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Station</th>
              <th className="text-left px-3 py-2">Period</th>
              <th className="text-left px-3 py-2">Supervisor</th>
              <th className="text-left px-3 py-2">Submitted</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Tank var (L)</th>
              <th className="text-right px-3 py-2">Rev var (ZAR)</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(shifts ?? []).length === 0 && (
              <tr><td colSpan={9} className="px-3 py-4 text-muted-foreground text-center">No shifts found.</td></tr>
            )}
            {(shifts ?? []).map(s => {
              const vs = varianceSummary(s.id)
              const ss = s as any
              const supervisorName = ss.user_profiles?.email ?? '—'
              const submittedAt = s.submitted_at ? (() => { const d = new Date(s.submitted_at); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })() : '—'
              return (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">{s.shift_date}</td>
                  <td className="px-3 py-2">{ss.stations?.name ?? '—'}</td>
                  <td className="px-3 py-2 capitalize">{s.period}</td>
                  <td className="px-3 py-2">{supervisorName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{submittedAt}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${statusColour(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right ${vs ? (vs.tankVar < 0 ? 'text-destructive' : vs.tankVar > 0 ? 'text-amber-600' : 'text-green-600') : 'text-muted-foreground'}`}>
                    {vs ? (vs.tankVar > 0 ? '+' : '') + vs.tankVar.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L' : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right ${vs ? (vs.revenueVar < 0 ? 'text-destructive' : vs.revenueVar > 0 ? 'text-amber-600' : 'text-green-600') : 'text-muted-foreground'}`}>
                    {vs ? (vs.revenueVar > 0 ? '+R ' : 'R ') + Math.abs(vs.revenueVar).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/history/${s.id}`} className="text-primary underline text-xs">View</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}
