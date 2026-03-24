import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildTankTrendSeries, buildDeliveryMarkers, applyDateRangePreset } from '@/lib/tank-trends'
import { TankTrendChart } from './_components/TankTrendChart'

interface Props {
  searchParams: Promise<{
    station?: string
    preset?: string
    from?: string
    to?: string
  }>
}

export default async function TankTrendsPage({ searchParams }: Props) {
  const { station: stationId, preset, from, to } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const activePreset = (preset as '7d' | '30d' | 'custom') ?? '30d'
  const { from: fromDate, to: toDate } = applyDateRangePreset(activePreset, today, from, to)

  const { data: stations } = await supabase.from('stations').select('id, name').order('name')
  const activeStationId = stationId ?? stations?.[0]?.id
  if (!activeStationId) {
    return <main className="max-w-3xl mx-auto p-4"><p className="text-muted-foreground text-sm">No stations configured.</p></main>
  }
  const activeStation = (stations ?? []).find(s => s.id === activeStationId)

  // Tanks with capacity
  const { data: tanks } = await supabase
    .from('tanks')
    .select('id, label, capacity_litres, fuel_grade_id')
    .eq('station_id', activeStationId)
    .order('label')

  // Shifts in range (submitted/approved/flagged)
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, shift_date, period')
    .eq('station_id', activeStationId)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)
    .in('status', ['submitted', 'approved', 'flagged'])

  const shiftIds = (shifts ?? []).map(s => s.id)

  // Closing dip readings + deliveries in parallel
  const [dipResult, { data: deliveriesRaw }] = await Promise.all([
    shiftIds.length > 0
      ? supabase.from('dip_readings')
          .select('tank_id, litres, shift_id')
          .in('shift_id', shiftIds)
          .eq('type', 'close')
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('deliveries')
      .select('tank_id, litres_received, delivered_at')
      .eq('station_id', activeStationId)
      .gte('delivered_at', `${fromDate}T00:00:00Z`)
      .lte('delivered_at', `${toDate}T23:59:59Z`),
  ])

  const rawDips = dipResult.data ?? []

  // Build shift map: shiftId → { shift_date, period }
  const shiftMap = new Map((shifts ?? []).map(s => [s.id, { shift_date: s.shift_date, period: s.period }]))

  // Deduplicate to one close dip per (tank, date): prefer evening over morning
  const best = new Map<string, number>()
  for (const dip of rawDips) {
    const shift = shiftMap.get(dip.shift_id)
    if (!shift) continue
    const key = `${dip.tank_id}:${shift.shift_date}`
    const existing = best.get(key)
    if (existing === undefined || shift.period === 'evening') {
      best.set(key, dip.litres)
    }
  }

  const closingDips = [...best.entries()].map(([key, litres]) => {
    const [tank_id, shift_date] = key.split(':')
    return { tank_id, shift_date, litres }
  })

  const tankData = (tanks ?? []).map(t => ({
    id: t.id,
    label: `${t.label} (${t.fuel_grade_id})`,
    capacity_litres: t.capacity_litres,
  }))

  const series = buildTankTrendSeries(closingDips, tankData, fromDate, toDate)
  const deliveryMarkers = buildDeliveryMarkers(deliveriesRaw ?? [], fromDate, toDate)

  const stationParam = `station=${activeStationId}`

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
        <h1 className="text-xl font-semibold mt-1">Tank Level Trends</h1>
        <p className="text-sm text-muted-foreground">{activeStation?.name}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Station picker */}
        <form method="GET" action="/dashboard/tank-trends" className="flex gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Station</label>
            <select name="station" defaultValue={activeStationId} className="border rounded px-2 py-1.5 text-sm">
              {(stations ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <input type="hidden" name="preset" value={activePreset} />
          {activePreset === 'custom' && <input type="hidden" name="from" value={fromDate} />}
          {activePreset === 'custom' && <input type="hidden" name="to" value={toDate} />}
          <button type="submit" className="rounded bg-black px-3 py-1.5 text-sm text-white">Go</button>
        </form>

        {/* Preset tabs */}
        <div className="flex gap-1">
          {(['7d', '30d', 'custom'] as const).map(p => (
            <a
              key={p}
              href={`/dashboard/tank-trends?${stationParam}&preset=${p}${p === 'custom' ? `&from=${fromDate}&to=${toDate}` : ''}`}
              className={`px-3 py-1.5 text-sm rounded border ${activePreset === p ? 'bg-black text-white' : 'hover:bg-muted'}`}
            >
              {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Custom'}
            </a>
          ))}
        </div>

        {/* Custom date range */}
        {activePreset === 'custom' && (
          <form method="GET" action="/dashboard/tank-trends" className="flex gap-2 items-end">
            <input type="hidden" name="station" value={activeStationId} />
            <input type="hidden" name="preset" value="custom" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">From</label>
              <input type="date" name="from" defaultValue={fromDate} max={today} className="border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">To</label>
              <input type="date" name="to" defaultValue={toDate} max={today} className="border rounded px-2 py-1.5 text-sm" />
            </div>
            <button type="submit" className="rounded bg-black px-3 py-1.5 text-sm text-white">Apply</button>
          </form>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {fromDate} — {toDate} · closing dip per tank
        {deliveryMarkers.length > 0 && (
          <span className="ml-2 text-amber-600">· D = delivery event</span>
        )}
      </div>

      <TankTrendChart series={series} deliveries={deliveryMarkers} />
    </main>
  )
}
