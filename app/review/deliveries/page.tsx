import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeliveryForm } from './DeliveryForm'

export default async function DeliveriesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, role, station_id, is_active')
    .eq('user_id', user.id)
    .single()

  if (!profile?.is_active || !['supervisor', 'owner'].includes(profile.role ?? '')) {
    redirect('/login')
  }

  // For supervisor: scoped to their station. For owner: show all (TODO: add station picker).
  const stationId = profile.station_id as string

  const [{ data: station }, { data: tanks }, { data: deliveries }] = await Promise.all([
    supabase.from('stations').select('id, name').eq('id', stationId).single(),
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', stationId).order('label'),
    supabase
      .from('deliveries')
      .select('id, tank_id, litres_received, delivered_at, delivery_note_url')
      .eq('station_id', stationId)
      .order('delivered_at', { ascending: false })
      .limit(50),
  ])

  const tankLabel = (tankId: string) => tanks?.find(t => t.id === tankId)?.label ?? tankId
  const fmt = (n: number) => n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <main className="max-w-xl mx-auto p-4 space-y-8">
      <h1 className="text-xl font-semibold">
        Deliveries — {station?.name}
      </h1>

      {/* Record new delivery */}
      <section className="space-y-3">
        <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
          Record delivery
        </h2>
        <div className="border rounded-md p-4">
          <DeliveryForm stationId={stationId} tanks={tanks ?? []} />
        </div>
      </section>

      {/* Delivery history */}
      <section className="space-y-3">
        <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
          Recent deliveries
        </h2>
        {!deliveries?.length && (
          <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>
        )}
        <div className="border rounded-md divide-y text-sm">
          {(deliveries ?? []).map(d => (
            <div key={d.id} className="px-4 py-3 space-y-0.5">
              <div className="flex justify-between">
                <span className="font-medium">{tankLabel(d.tank_id)}</span>
                <span>{fmt(d.litres_received)} L</span>
              </div>
              <div className="text-muted-foreground text-xs">
                {new Date(d.delivered_at).toLocaleString('en-ZA')}
              </div>
              {d.delivery_note_url && (
                <a
                  href={d.delivery_note_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  View delivery note
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
