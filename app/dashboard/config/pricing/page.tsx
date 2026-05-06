import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetPriceForm } from './SetPriceForm'

export default async function PricingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/dashboard')

  const [{ data: grades }, { data: stations }, { data: history }] = await Promise.all([
    supabase.from('fuel_grades').select('id').order('id'),
    supabase.from('stations').select('id, name').order('name'),
    supabase
      .from('fuel_prices')
      .select('id, station_id, fuel_grade_id, sell_price_per_litre, cost_per_litre, valid_from, valid_to, set_by')
      .order('valid_from', { ascending: false })
      .limit(200),
  ])

  const fmt = (n: number) =>
    `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`

  const stationName = (id: string) =>
    stations?.find(s => s.id === id)?.name ?? id

  const formatRange = (row: { valid_from: string; valid_to: string | null }) => {
    const from = new Date(row.valid_from).toLocaleDateString('en-GB')
    const to   = row.valid_to ? new Date(row.valid_to).toLocaleDateString('en-GB') : 'open'
    return `${from} – ${to}`
  }

  // Group history by station for display
  const byStation = new Map<string, typeof history>()
  for (const row of history ?? []) {
    if (!byStation.has(row.station_id)) byStation.set(row.station_id, [])
    byStation.get(row.station_id)!.push(row)
  }

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-8">
      <h1 className="text-xl font-semibold">Fuel Prices</h1>

      {/* Set new price */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Add price entry
        </h2>
        <div className="border rounded-md p-4">
          <SetPriceForm grades={grades ?? []} stations={stations ?? []} />
        </div>
      </section>

      {/* Price history per station */}
      {(stations ?? []).map(station => {
        const rows = byStation.get(station.id) ?? []
        return (
          <section key={station.id} className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {station.name} — price history
            </h2>
            {!rows.length && (
              <p className="text-sm text-muted-foreground">No prices set yet.</p>
            )}
            <div className="border rounded-md divide-y text-sm">
              {rows.map(row => (
                <div key={row.id} className="px-4 py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">{row.fuel_grade_id}</span>
                    <span>Sell {fmt(row.sell_price_per_litre)} / Cost {fmt(row.cost_per_litre)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatRange(row)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
