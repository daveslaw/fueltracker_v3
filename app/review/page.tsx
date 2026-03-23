import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type StatusFilter = 'submitted' | 'approved' | 'flagged' | 'all'

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function ReviewPage({ searchParams }: Props) {
  const { status: rawStatus } = await searchParams
  const statusFilter: StatusFilter =
    ['submitted', 'approved', 'flagged', 'all'].includes(rawStatus ?? '')
      ? (rawStatus as StatusFilter)
      : 'submitted'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, station_id, is_active')
    .eq('user_id', user.id)
    .single()
  if (!profile?.is_active || !['supervisor', 'owner'].includes(profile.role ?? ''))
    redirect('/login')

  const statuses = statusFilter === 'all'
    ? ['submitted', 'approved', 'flagged']
    : [statusFilter]

  const { data: shifts } = await supabase
    .from('shifts')
    .select(`
      id, period, shift_date, status, submitted_at, flag_comment,
      stations ( name ),
      user_profiles!attendant_id ( first_name, last_name ),
      reconciliations ( revenue_variance )
    `)
    .in('status', statuses)
    .order('submitted_at', { ascending: false })
    .limit(50)

  const statusChip = (s: string) => {
    const colours: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-800',
      approved:  'bg-green-100 text-green-800',
      flagged:   'bg-red-100 text-red-800',
    }
    return colours[s] ?? 'bg-gray-100 text-gray-800'
  }

  const fmtR = (n: number | null) => {
    if (n == null) return '—'
    const abs = Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return n >= 0 ? `R ${abs}` : `-R ${abs}`
  }

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'Pending', value: 'submitted' },
    { label: 'Flagged', value: 'flagged' },
    { label: 'Approved', value: 'approved' },
    { label: 'All', value: 'all' },
  ]

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Shift Review</h1>

      <nav className="flex gap-2 border-b pb-2">
        {tabs.map(tab => (
          <Link
            key={tab.value}
            href={`/review?status=${tab.value}`}
            className={`px-3 py-1 rounded-md text-sm ${
              statusFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {!shifts?.length && (
        <p className="text-sm text-muted-foreground py-4 text-center">No shifts to review.</p>
      )}

      <div className="divide-y border rounded-md">
        {(shifts ?? []).map(shift => {
          const s = shift as any
          return (
            <Link
              key={shift.id}
              href={`/review/${shift.id}`}
              className="flex items-start justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm capitalize">
                    {shift.period} · {shift.shift_date}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusChip(shift.status)}`}>
                    {shift.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.stations?.name} · {s.user_profiles?.first_name} {s.user_profiles?.last_name}
                </div>
                {shift.flag_comment && (
                  <div className="text-xs text-red-600 italic">{shift.flag_comment}</div>
                )}
              </div>
              <div className="text-right text-sm shrink-0 ml-4">
                <div className={
                  s.reconciliations?.revenue_variance > 0 ? 'text-destructive' :
                  s.reconciliations?.revenue_variance < 0 ? 'text-amber-600' :
                  s.reconciliations?.revenue_variance === 0 ? 'text-green-600' :
                  'text-muted-foreground'
                }>
                  {fmtR(s.reconciliations?.revenue_variance ?? null)}
                </div>
                <div className="text-xs text-muted-foreground">revenue var.</div>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
