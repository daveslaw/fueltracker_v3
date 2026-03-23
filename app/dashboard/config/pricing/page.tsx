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

  const [{ data: grades }, { data: history }] = await Promise.all([
    supabase.from('fuel_grades').select('id').order('id'),
    supabase
      .from('fuel_prices')
      .select('id, fuel_grade_id, price_per_litre, effective_from, set_by')
      .order('effective_from', { ascending: false })
      .limit(100),
  ])

  // Current price per grade = first row per grade in the history (ordered desc)
  const currentByGrade = new Map<string, number>()
  for (const row of history ?? []) {
    if (!currentByGrade.has(row.fuel_grade_id)) {
      currentByGrade.set(row.fuel_grade_id, row.price_per_litre)
    }
  }

  const fmt = (n: number) =>
    `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`

  return (
    <main className="max-w-xl mx-auto p-4 space-y-8">
      <h1 className="text-xl font-semibold">Fuel Prices</h1>

      {/* Current prices summary */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Current prices
        </h2>
        <div className="border rounded-md divide-y text-sm">
          {(grades ?? []).map(g => (
            <div key={g.id} className="px-4 py-3 flex justify-between">
              <span className="font-medium">{g.id}</span>
              <span>{currentByGrade.has(g.id) ? fmt(currentByGrade.get(g.id)!) : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Set new price */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Set new price
        </h2>
        <div className="border rounded-md p-4">
          <SetPriceForm grades={grades ?? []} />
        </div>
      </section>

      {/* Full history */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Price history
        </h2>
        {!history?.length && (
          <p className="text-sm text-muted-foreground">No prices set yet.</p>
        )}
        <div className="border rounded-md divide-y text-sm">
          {(history ?? []).map(row => (
            <div key={row.id} className="px-4 py-3">
              <div className="flex justify-between">
                <span className="font-medium">{row.fuel_grade_id}</span>
                <span>{fmt(row.price_per_litre)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Effective {new Date(row.effective_from).toLocaleString('en-ZA')}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
