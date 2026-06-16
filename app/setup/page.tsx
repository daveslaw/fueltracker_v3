import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SetupForm } from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: stations } = await supabase.from('stations').select('id, name').order('name')

  async function assignStation(formData: FormData) {
    'use server'
    const stationId = formData.get('station_id') as string
    if (!stationId) return
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect(`/login?station=${stationId}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Device Setup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Assign this tablet to a station. Staff will see a PIN login for that station.
          </p>
        </div>
        <SetupForm stations={stations ?? []} onAssign={assignStation} />
      </div>
    </main>
  )
}
