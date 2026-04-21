import { signOut } from '@/app/(auth)/login/actions'
import { createClient } from '@/lib/supabase/server'

export default async function ShiftLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let stationName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('station_id')
      .eq('user_id', user.id)
      .single()
    if (profile?.station_id) {
      const { data: station } = await supabase
        .from('stations')
        .select('name')
        .eq('id', profile.station_id)
        .single()
      stationName = station?.name ?? null
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b">
        <div className="max-w-lg mx-auto px-6 py-3 flex items-center justify-between">
          {stationName
            ? <span className="text-sm font-medium text-gray-700">{stationName}</span>
            : <span />
          }
          <form action={signOut}>
            <button type="submit"
              className="rounded border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Log out
            </button>
          </form>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
